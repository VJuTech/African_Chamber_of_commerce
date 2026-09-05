/*
 * procurementModel.js - ACC Chapter 22 procurement and B2B sourcing workflow.
 * This operational model follows the existing lightweight in-memory module pattern
 * while exposing audit, notification, payment, and logistics integration references.
 */
const fs = require("fs");
const path = require("path");

// Keep procurement audit and notification records in the shared application log directory.
const auditLogPath = path.join(__dirname, "..", "logs", "procurement-audit.log");
const notificationLogPath = path.join(__dirname, "..", "logs", "procurement-notifications.log");
fs.mkdirSync(path.dirname(auditLogPath), { recursive: true });

// Define the controlled vocabulary used by the procurement workflow and UI.
const procurementVisibilities = ["open", "restricted"];
const procurementStatuses = ["draft", "open", "closed", "under_evaluation", "awarded", "cancelled"];
const quotationStatuses = ["pending", "accepted", "rejected"];

// Store active workflow records and append-only operational records for this process.
const rfqs = [];
const quotations = [];
const procurementOrders = [];
const auditEntries = [];
const notificationEntries = [];

// Generate readable references that can be shared in buyer and supplier communication.
function generateReference(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

// Write an auditable event for every important procurement mutation.
function logAudit(eventType, details = {}) {
  const entry = { id: generateReference("AUD"), eventType, details, createdAt: new Date().toISOString() };
  auditEntries.push(entry);
  fs.appendFileSync(auditLogPath, `${JSON.stringify(entry)}\n`);
  return entry;
}

// Record notification intent for a future email, SMS, or push delivery service.
function logNotification(type, recipientId, details = {}) {
  const entry = { id: generateReference("NOT"), type, recipientId: Number(recipientId), details, createdAt: new Date().toISOString() };
  notificationEntries.push(entry);
  fs.appendFileSync(notificationLogPath, `${JSON.stringify(entry)}\n`);
  return entry;
}

// Normalize public records so templates and tests receive stable field types.
function normalizeRFQ(record) {
  return { ...record, id: Number(record.id), buyerId: Number(record.buyerId), quantityRequired: Number(record.quantityRequired), budgetAmount: record.budgetAmount === null ? null : Number(record.budgetAmount), supplierIds: [...(record.supplierIds || [])].map(Number) };
}

// Normalize quotations and preserve the relationship to the parent request.
function normalizeQuotation(record) {
  return { ...record, id: Number(record.id), rfqId: Number(record.rfqId), supplierId: Number(record.supplierId), quotedPrice: Number(record.quotedPrice) };
}

// Normalize awarded procurement orders and their payment/logistics hand-off references.
function normalizeProcurementOrder(record) {
  return { ...record, id: Number(record.id), buyerId: Number(record.buyerId), supplierId: Number(record.supplierId), quotationId: Number(record.quotationId), orderAmount: Number(record.orderAmount) };
}

// Validate the buyer payload before creating a request in draft state.
async function createRFQ(buyerId, payload = {}) {
  const title = String(payload.title || "").trim();
  const description = String(payload.description || "").trim();
  const category = String(payload.category || "").trim();
  const quantityRequired = Number(payload.quantityRequired || 0);
  const deadline = String(payload.deadline || "").trim();
  const visibility = String(payload.visibility || "open").trim().toLowerCase();
  const supplierIds = String(payload.supplierIds || "").split(",").map((value) => Number(value.trim())).filter(Boolean);
  const budgetAmount = payload.budgetAmount === "" || payload.budgetAmount === undefined ? null : Number(payload.budgetAmount);

  if (!buyerId || !title || !description || !category || !quantityRequired || quantityRequired <= 0 || !deadline) return { success: false, message: "Title, description, category, quantity, and deadline are required." };
  if (!procurementVisibilities.includes(visibility)) return { success: false, message: "Select an open or restricted procurement type." };
  if (Number.isNaN(budgetAmount) || (budgetAmount !== null && budgetAmount < 0)) return { success: false, message: "Budget must be a valid positive amount or left blank." };
  if (Number.isNaN(new Date(deadline).getTime())) return { success: false, message: "Enter a valid procurement deadline." };

  const rfq = {
    id: rfqs.length + 1,
    reference: generateReference("RFQ"),
    buyerId: Number(buyerId),
    title,
    description,
    category,
    quantityRequired,
    unitOfMeasurement: String(payload.unitOfMeasurement || "units").trim(),
    budgetAmount,
    budgetCurrency: String(payload.budgetCurrency || "USD").trim().toUpperCase(),
    deliveryLocation: String(payload.deliveryLocation || "").trim(),
    deadline,
    visibility,
    supplierIds,
    status: "draft",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  rfqs.push(rfq);
  logAudit("request_created", { rfqId: rfq.id, rfqReference: rfq.reference, buyerId: rfq.buyerId, outcome: "success" });
  return { success: true, rfq: normalizeRFQ(rfq), message: "Procurement request created as a draft." };
}

// Publish a buyer-owned draft and make it eligible for supplier discovery.
async function publishRFQ(buyerId, rfqId) {
  const rfq = rfqs.find((entry) => Number(entry.id) === Number(rfqId));
  if (!rfq) return { success: false, message: "Procurement request not found." };
  if (Number(rfq.buyerId) !== Number(buyerId)) return { success: false, message: "Only the buyer can publish this request." };
  if (rfq.status !== "draft") return { success: false, message: "Only draft requests can be published." };
  rfq.status = "open";
  rfq.updatedAt = new Date().toISOString();
  logAudit("request_published", { rfqId: rfq.id, buyerId, outcome: "success" });
  logNotification("new_request_published", rfq.visibility === "restricted" ? rfq.supplierIds[0] || buyerId : 0, { rfqId: rfq.id, title: rfq.title, visibility: rfq.visibility });
  return { success: true, rfq: normalizeRFQ(rfq), message: "Procurement request published successfully." };
}

// Return only open requests a supplier is allowed to see.
async function getAvailableRFQs(supplierId) {
  return rfqs.filter((rfq) => ["open", "under_evaluation"].includes(rfq.status) && (rfq.visibility === "open" || rfq.supplierIds.includes(Number(supplierId)))).map(normalizeRFQ);
}

// Return all requests owned by a buyer for dashboard management.
async function getBuyerRFQs(buyerId) {
  return rfqs.filter((rfq) => Number(rfq.buyerId) === Number(buyerId)).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map(normalizeRFQ);
}

// Resolve a request and enforce visibility for non-owner viewers.
async function getRFQById(rfqId, viewerId) {
  const rfq = rfqs.find((entry) => Number(entry.id) === Number(rfqId));
  if (!rfq) return null;
  const isBuyer = Number(rfq.buyerId) === Number(viewerId);
  const canView = isBuyer || (["open", "under_evaluation"].includes(rfq.status) && (rfq.visibility === "open" || rfq.supplierIds.includes(Number(viewerId))));
  if (!canView) return null;
  return normalizeRFQ(rfq);
}

// Submit one supplier quotation while the request is open and before its deadline.
async function submitQuotation(supplierId, rfqId, payload = {}) {
  const rfq = rfqs.find((entry) => Number(entry.id) === Number(rfqId));
  const quotedPrice = Number(payload.quotedPrice || 0);
  if (!rfq) return { success: false, message: "Procurement request not found." };
  if (Number(rfq.buyerId) === Number(supplierId)) return { success: false, message: "A buyer cannot bid on its own request." };
  if (!["open", "under_evaluation"].includes(rfq.status)) return { success: false, message: "This procurement request is not accepting bids." };
  if (new Date(rfq.deadline).getTime() < Date.now()) return { success: false, message: "The bid deadline has passed." };
  if (rfq.visibility === "restricted" && !rfq.supplierIds.includes(Number(supplierId))) return { success: false, message: "This request is restricted to invited suppliers." };
  if (!quotedPrice || quotedPrice <= 0) return { success: false, message: "Enter a valid quotation amount." };
  if (quotations.some((quote) => Number(quote.rfqId) === Number(rfqId) && Number(quote.supplierId) === Number(supplierId))) return { success: false, message: "You have already submitted a quotation for this request." };

  const quotation = { id: quotations.length + 1, reference: generateReference("QTE"), rfqId: Number(rfqId), supplierId: Number(supplierId), quotedPrice, currency: String(payload.currency || rfq.budgetCurrency).trim().toUpperCase(), deliveryTimeframe: String(payload.deliveryTimeframe || "").trim(), termsConditions: String(payload.termsConditions || "").trim(), status: "pending", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  quotations.push(quotation);
  rfq.status = "under_evaluation";
  rfq.updatedAt = new Date().toISOString();
  logAudit("bid_submitted", { rfqId: rfq.id, quotationId: quotation.id, supplierId, outcome: "success" });
  logNotification("bid_submitted", rfq.buyerId, { rfqId: rfq.id, quotationId: quotation.id, supplierId });
  return { success: true, quotation: normalizeQuotation(quotation), message: "Quotation submitted successfully." };
}

// Return the quotations for an authorized buyer or an individual supplier.
async function getQuotationsForRFQ(rfqId, viewerId) {
  const rfq = rfqs.find((entry) => Number(entry.id) === Number(rfqId));
  if (!rfq || Number(rfq.buyerId) !== Number(viewerId)) return [];
  return quotations.filter((quote) => Number(quote.rfqId) === Number(rfqId)).map(normalizeQuotation);
}

// Return a supplier's submitted bids for dashboard visibility.
async function getSupplierQuotations(supplierId) {
  return quotations.filter((quote) => Number(quote.supplierId) === Number(supplierId)).map(normalizeQuotation);
}

// Award one quotation, reject the others, and create the fulfillment hand-off record.
async function awardQuotation(buyerId, rfqId, quotationId) {
  const rfq = rfqs.find((entry) => Number(entry.id) === Number(rfqId));
  const quotation = quotations.find((entry) => Number(entry.id) === Number(quotationId) && Number(entry.rfqId) === Number(rfqId));
  if (!rfq || !quotation) return { success: false, message: "Request or quotation not found." };
  if (Number(rfq.buyerId) !== Number(buyerId)) return { success: false, message: "Only the buyer can award this request." };
  if (!["open", "under_evaluation"].includes(rfq.status)) return { success: false, message: "This request is no longer available for award." };

  quotation.status = "accepted";
  // Reject competing quotations and notify each supplier of the evaluation outcome.
  quotations.filter((entry) => Number(entry.rfqId) === Number(rfqId) && Number(entry.id) !== Number(quotationId)).forEach((entry) => {
    entry.status = "rejected";
    logNotification("bid_rejected", entry.supplierId, { rfqId: rfq.id, quotationId: entry.id });
  });
  rfq.status = "awarded";
  rfq.updatedAt = new Date().toISOString();
  const procurementOrder = { id: procurementOrders.length + 1, reference: generateReference("PO"), rfqId: rfq.id, quotationId: quotation.id, buyerId: rfq.buyerId, supplierId: quotation.supplierId, orderAmount: quotation.quotedPrice, currency: quotation.currency, paymentStatus: "pending", deliveryStatus: "pending", status: "confirmed", createdAt: new Date().toISOString(), paymentPath: `/payments?procurementOrderId=${procurementOrders.length + 1}`, logisticsPath: `/logistics?procurementOrderId=${procurementOrders.length + 1}` };
  procurementOrders.push(procurementOrder);
  logAudit("award_made", { rfqId: rfq.id, quotationId: quotation.id, procurementOrderId: procurementOrder.id, buyerId, supplierId: quotation.supplierId, outcome: "success" });
  logNotification("bid_accepted", quotation.supplierId, { rfqId: rfq.id, quotationId: quotation.id, procurementOrderId: procurementOrder.id });
  return { success: true, order: normalizeProcurementOrder(procurementOrder), message: "Procurement awarded and fulfillment hand-off created." };
}

// Close an active request and make all future bids fail validation.
async function closeRFQ(buyerId, rfqId) {
  const rfq = rfqs.find((entry) => Number(entry.id) === Number(rfqId));
  if (!rfq) return { success: false, message: "Procurement request not found." };
  if (Number(rfq.buyerId) !== Number(buyerId)) return { success: false, message: "Only the buyer can close this request." };
  if (!["open", "under_evaluation"].includes(rfq.status)) return { success: false, message: "This request cannot be closed in its current state." };
  rfq.status = "closed";
  rfq.updatedAt = new Date().toISOString();
  logAudit("request_closed", { rfqId: rfq.id, buyerId, outcome: "success" });
  logNotification("request_closed", rfq.buyerId, { rfqId: rfq.id });
  return { success: true, rfq: normalizeRFQ(rfq), message: "Procurement request closed successfully." };
}

// Expose immutable snapshots for audit reviews, notifications, and integration checks.
async function getAuditLog() { return [...auditEntries]; }
async function getNotificationLog() { return [...notificationEntries]; }
async function getProcurementOrdersForUser(userId) { return procurementOrders.filter((order) => Number(order.buyerId) === Number(userId) || Number(order.supplierId) === Number(userId)).map(normalizeProcurementOrder); }

// Export the complete Chapter 22 service surface for controllers and tests.
module.exports = { procurementVisibilities, procurementStatuses, quotationStatuses, createRFQ, publishRFQ, getAvailableRFQs, getBuyerRFQs, getRFQById, submitQuotation, getQuotationsForRFQ, getSupplierQuotations, awardQuotation, closeRFQ, getAuditLog, getNotificationLog, getProcurementOrdersForUser, rfqs, quotations, procurementOrders };
