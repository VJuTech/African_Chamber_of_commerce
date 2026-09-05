/*
 * disputeModel.js - ACC Chapter 24 dispute resolution lifecycle.
 * The service adds structured trust protection around existing orders and contracts.
 */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const orderModel = require("./orderModel");
const paymentModel = require("./paymentModel");
const contractModel = require("./contractModel");

// Keep dispute audit and notification records in the shared application log directory.
const auditLogPath = path.join(__dirname, "..", "logs", "disputes-audit.log");
const notificationLogPath = path.join(__dirname, "..", "logs", "disputes-notifications.log");
fs.mkdirSync(path.dirname(auditLogPath), { recursive: true });

// Define the controlled vocabularies used throughout the dispute workflow.
const disputeStatuses = ["open", "under_review", "in_mediation", "resolved", "escalated", "closed"];
const resolutionTypes = ["refund", "replacement", "partial_compensation", "no_action"];
const evidenceTypes = ["document", "image", "communication_log", "transaction_history"];

// Store operational records in the repository's established lightweight module pattern.
const disputes = [];
const evidence = [];
const auditEntries = [];
const notificationEntries = [];

// Generate readable references for cases and evidence records.
function generateReference(prefix) { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`; }

// Append a structured audit event for every important state transition.
function logAudit(eventType, userId, details = {}) {
  const entry = { id: generateReference("AUD"), eventType, userId: Number(userId || 0), details, createdAt: new Date().toISOString() };
  auditEntries.push(entry);
  fs.appendFileSync(auditLogPath, `${JSON.stringify(entry)}\n`);
  return entry;
}

// Record notification intent for the platform notification service.
function logNotification(type, recipientId, details = {}) {
  const entry = { id: generateReference("NOT"), type, recipientId: Number(recipientId || 0), details, createdAt: new Date().toISOString() };
  notificationEntries.push(entry);
  fs.appendFileSync(notificationLogPath, `${JSON.stringify(entry)}\n`);
  return entry;
}

// Identify moderator-capable accounts without changing the existing account schema.
function isModerator(user) { return Boolean(user && ["admin", "moderator", "platform_admin", "dispute_officer"].includes(String(user.role || "").toLowerCase())); }

// Normalize a dispute while keeping linked identifiers predictable for consumers.
function normalizeDispute(dispute) { return { ...dispute, id: Number(dispute.id), partyIds: [...dispute.partyIds].map(Number), orderId: dispute.orderId ? Number(dispute.orderId) : null, contractId: dispute.contractId ? Number(dispute.contractId) : null, moderatorId: dispute.moderatorId ? Number(dispute.moderatorId) : null }; }

// Resolve the parties and linked payment from an existing order or contract.
async function resolveReference(payload) {
  const orderId = Number(payload.orderId || 0) || null;
  const contractId = Number(payload.contractId || 0) || null;
  if (!orderId && !contractId) return { success: false, message: "Link the dispute to an order or contract." };
  if (orderId) {
    const order = await orderModel.getOrderById(orderId);
    if (!order) return { success: false, message: "The linked order was not found." };
    return { success: true, orderId, partyIds: [Number(order.buyerId), Number(order.sellerId)], paymentId: null };
  }
  const contract = await contractModel.getContractById(contractId, Number(payload.creatorId));
  if (!contract) return { success: false, message: "The linked contract was not found or is not accessible." };
  return { success: true, contractId, partyIds: contract.partyIds, paymentId: contract.paymentId || null };
}

// Create an open case from a linked order or contract.
async function createDispute(creatorId, payload = {}) {
  const issueDescription = String(payload.issueDescription || payload.reason || "").trim();
  if (!creatorId || !issueDescription) return { success: false, message: "A clear dispute description is required." };
  const reference = await resolveReference({ ...payload, creatorId });
  if (!reference.success) return reference;
  if (!reference.partyIds.includes(Number(creatorId))) return { success: false, message: "Only a linked transaction party can raise this dispute." };
  const dispute = { id: disputes.length + 1, reference: generateReference("DSP"), orderId: reference.orderId || null, contractId: reference.contractId || null, paymentId: Number(payload.paymentId || reference.paymentId || 0) || null, partyIds: reference.partyIds, raisedBy: Number(creatorId), issueDescription, status: "open", resolutionType: null, resolutionDetails: "", moderatorId: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), resolvedAt: null, closedAt: null };
  disputes.push(dispute);
  logAudit("dispute_created", creatorId, { disputeId: dispute.id, orderId: dispute.orderId, contractId: dispute.contractId, outcome: "success" });
  dispute.partyIds.filter((partyId) => partyId !== Number(creatorId)).forEach((partyId) => logNotification("dispute_raised", partyId, { disputeId: dispute.id, reference: dispute.reference }));
  return { success: true, dispute: normalizeDispute(dispute), message: "Dispute created and the opposing party was notified." };
}

// Return only cases where a party participates, with optional moderator access.
async function getDisputesForUser(userId, user = null) { return disputes.filter((dispute) => isModerator(user) || dispute.partyIds.includes(Number(userId))).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).map(normalizeDispute); }

// Enforce party or moderator access to a case.
async function getDisputeById(disputeId, userId, user = null) { const dispute = disputes.find((entry) => Number(entry.id) === Number(disputeId)); return dispute && (isModerator(user) || dispute.partyIds.includes(Number(userId))) ? normalizeDispute(dispute) : null; }

// Assign a moderator and move the case into structured review.
async function assignModerator(moderatorUser, disputeId, moderatorId) {
  const dispute = disputes.find((entry) => Number(entry.id) === Number(disputeId));
  if (!dispute || !isModerator(moderatorUser)) return { success: false, message: "Moderator access is required." };
  dispute.moderatorId = Number(moderatorId || moderatorUser.id);
  dispute.status = "under_review";
  dispute.updatedAt = new Date().toISOString();
  logAudit("status_changed", moderatorUser.id, { disputeId: dispute.id, status: dispute.status, moderatorId: dispute.moderatorId });
  dispute.partyIds.forEach((partyId) => logNotification("status_updated", partyId, { disputeId: dispute.id, status: dispute.status }));
  return { success: true, dispute: normalizeDispute(dispute), message: "Dispute assigned for review." };
}

// Add secure evidence metadata supplied by the private upload adapter or a message export.
async function submitEvidence(userId, disputeId, payload = {}) {
  const dispute = disputes.find((entry) => Number(entry.id) === Number(disputeId));
  const evidenceType = String(payload.evidenceType || "document").trim().toLowerCase();
  if (!dispute || !dispute.partyIds.includes(Number(userId))) return { success: false, message: "Only a dispute party can submit evidence." };
  if (!["open", "under_review", "in_mediation", "escalated"].includes(dispute.status)) return { success: false, message: "Evidence cannot be added after resolution." };
  if (!evidenceTypes.includes(evidenceType) || !payload.fileName && !payload.content) return { success: false, message: "Provide supported evidence content." };
  const record = { id: evidence.length + 1, reference: generateReference("EVD"), disputeId: dispute.id, submittedBy: Number(userId), evidenceType, fileName: String(payload.fileName || "").trim(), storageName: String(payload.storageName || "").trim(), content: String(payload.content || "").trim(), checksum: crypto.createHash("sha256").update(String(payload.storageName || payload.content || payload.fileName)).digest("hex"), createdAt: new Date().toISOString() };
  evidence.push(record);
  dispute.updatedAt = record.createdAt;
  logAudit("evidence_submitted", userId, { disputeId: dispute.id, evidenceId: record.id, evidenceType });
  dispute.partyIds.filter((partyId) => partyId !== Number(userId)).forEach((partyId) => logNotification("evidence_submitted", partyId, { disputeId: dispute.id, evidenceId: record.id }));
  return { success: true, evidence: { ...record, storageName: undefined }, message: "Evidence submitted securely." };
}

// Start mediation and make the existing messaging dependency visible in the case state.
async function initiateMediation(moderatorUser, disputeId) {
  const dispute = disputes.find((entry) => Number(entry.id) === Number(disputeId));
  if (!dispute || !isModerator(moderatorUser)) return { success: false, message: "Moderator access is required." };
  dispute.status = "in_mediation";
  dispute.updatedAt = new Date().toISOString();
  logAudit("status_changed", moderatorUser.id, { disputeId: dispute.id, status: dispute.status, dependency: "messaging" });
  dispute.partyIds.forEach((partyId) => logNotification("status_updated", partyId, { disputeId: dispute.id, status: dispute.status }));
  return { success: true, dispute: normalizeDispute(dispute), message: "Dispute moved into mediation." };
}

// Resolve a case and execute a refund when a valid linked payment is available.
async function resolveDispute(moderatorUser, disputeId, resolutionType, details = "") {
  const dispute = disputes.find((entry) => Number(entry.id) === Number(disputeId));
  const normalizedType = String(resolutionType || "").trim().toLowerCase();
  if (!dispute || !isModerator(moderatorUser)) return { success: false, message: "Moderator access is required." };
  if (!resolutionTypes.includes(normalizedType)) return { success: false, message: "Select a supported resolution type." };
  dispute.resolutionType = normalizedType;
  dispute.resolutionDetails = String(details || "").trim();
  dispute.status = "resolved";
  dispute.resolvedAt = new Date().toISOString();
  dispute.updatedAt = dispute.resolvedAt;
  let refund = null;
  if (normalizedType === "refund" && dispute.paymentId) refund = await paymentModel.refundPayment(dispute.raisedBy, dispute.paymentId, `Dispute ${dispute.reference} resolved by refund.`);
  logAudit("resolution_executed", moderatorUser.id, { disputeId: dispute.id, resolutionType: normalizedType, refundSuccess: refund ? refund.success : false });
  dispute.partyIds.forEach((partyId) => logNotification("status_updated", partyId, { disputeId: dispute.id, status: dispute.status, resolutionType: normalizedType }));
  return { success: true, dispute: normalizeDispute(dispute), refund, message: "Dispute resolution recorded." };
}

// Escalate an unresolved case to a higher authority.
async function escalateDispute(moderatorUser, disputeId, reason = "") {
  const dispute = disputes.find((entry) => Number(entry.id) === Number(disputeId));
  if (!dispute || !isModerator(moderatorUser)) return { success: false, message: "Moderator access is required." };
  if (["resolved", "closed"].includes(dispute.status)) return { success: false, message: "Resolved cases cannot be escalated." };
  dispute.status = "escalated";
  dispute.updatedAt = new Date().toISOString();
  logAudit("status_changed", moderatorUser.id, { disputeId: dispute.id, status: dispute.status, reason: String(reason || "").trim() });
  dispute.partyIds.forEach((partyId) => logNotification("status_updated", partyId, { disputeId: dispute.id, status: dispute.status }));
  return { success: true, dispute: normalizeDispute(dispute), message: "Dispute escalated for higher review." };
}

// Close a resolved case without removing its history.
async function closeDispute(moderatorUser, disputeId) {
  const dispute = disputes.find((entry) => Number(entry.id) === Number(disputeId));
  if (!dispute || !isModerator(moderatorUser)) return { success: false, message: "Moderator access is required." };
  if (dispute.status !== "resolved") return { success: false, message: "Only resolved disputes can be closed." };
  dispute.status = "closed";
  dispute.closedAt = new Date().toISOString();
  dispute.updatedAt = dispute.closedAt;
  logAudit("status_changed", moderatorUser.id, { disputeId: dispute.id, status: dispute.status });
  // Notify every participant when the resolved case is formally closed.
  dispute.partyIds.forEach((partyId) => logNotification("status_updated", partyId, { disputeId: dispute.id, status: dispute.status }));
  return { success: true, dispute: normalizeDispute(dispute), message: "Dispute closed successfully." };
}

// Return party-authorized evidence records without exposing private storage names.
async function getEvidence(disputeId, userId, user = null) { const dispute = disputes.find((entry) => Number(entry.id) === Number(disputeId)); if (!dispute || (!isModerator(user) && !dispute.partyIds.includes(Number(userId)))) return []; return evidence.filter((entry) => Number(entry.disputeId) === Number(disputeId)).map((entry) => ({ ...entry, storageName: undefined })); }
async function getAuditLog() { return [...auditEntries]; }
async function getNotificationLog() { return [...notificationEntries]; }

// Export the full Chapter 24 service surface.
module.exports = { disputeStatuses, resolutionTypes, evidenceTypes, isModerator, createDispute, getDisputesForUser, getDisputeById, assignModerator, submitEvidence, initiateMediation, resolveDispute, escalateDispute, closeDispute, getEvidence, getAuditLog, getNotificationLog, disputes, evidence };
