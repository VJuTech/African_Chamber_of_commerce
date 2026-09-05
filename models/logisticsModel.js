/* ******************************************
 * logisticsModel.js - ACC Chapter 21 shipment lifecycle and delivery audit model.
 * Keeps shipment state linked to the existing Chapter 18 order model.
 *******************************************/
const fs = require("fs");
const path = require("path");
const orderModel = require("./orderModel");

// Keep operational audit and notification records in the existing application log directory.
const logisticsAuditPath = path.join(__dirname, "..", "logs", "logistics-audit.log");
const logisticsNotificationPath = path.join(__dirname, "..", "logs", "logistics-notifications.log");
fs.mkdirSync(path.dirname(logisticsAuditPath), { recursive: true });

// Define the delivery methods and statuses supported by Chapter 21.
const deliveryMethods = ["standard", "express", "pickup", "third_party"];
const deliveryStatuses = ["pending", "dispatched", "in_transit", "out_for_delivery", "delivered", "failed_delivery"];
const logisticsProviders = ["Seller-managed delivery", "DHL", "Local courier", "ACC pickup point"];
const shipments = [];
const auditEntries = [];
const notificationEntries = [];

// Write a structured audit entry for every logistics mutation.
function logAudit(eventType, details = {}) {
  const entry = { id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, eventType, details, createdAt: new Date().toISOString() };
  auditEntries.push(entry);
  fs.appendFileSync(logisticsAuditPath, `${JSON.stringify(entry)}\n`);
  return entry;
}

// Record notification events for downstream email, SMS, or push delivery services.
function logNotification(type, shipment) {
  const entry = { id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, type, shipmentId: shipment.id, orderId: shipment.orderId, createdAt: new Date().toISOString() };
  notificationEntries.push(entry);
  fs.appendFileSync(logisticsNotificationPath, `${JSON.stringify(entry)}\n`);
  return entry;
}

// Generate stable human-readable identifiers for shipments and tracking references.
function generateIdentifier(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

// Normalize records before they are returned to controllers or views.
function normalizeShipment(shipment) {
  return { ...shipment, orderId: Number(shipment.orderId), sellerId: Number(shipment.sellerId), buyerId: Number(shipment.buyerId) };
}

// Ensure a buyer can select only one supported delivery method during checkout.
async function selectDeliveryMethod(buyerId, orderId, deliveryMethod) {
  const method = String(deliveryMethod || "").trim().toLowerCase();
  if (!deliveryMethods.includes(method)) return { success: false, message: "Select a supported delivery method." };
  const result = await orderModel.updateDeliveryMethod(buyerId, orderId, method);
  if (!result.success) return result;
  logAudit("delivery_method_selected", { orderId: result.order.id, buyerId, deliveryMethod: method, outcome: "success" });
  return result;
}

// Create one shipment for a confirmed order and generate its tracking number.
async function createShipment(sellerId, orderId, payload = {}) {
  const order = await orderModel.getOrderById(orderId);
  if (!order) return { success: false, message: "Order not found." };
  if (Number(order.sellerId) !== Number(sellerId)) return { success: false, message: "You are not the assigned seller for this order." };
  if (shipments.some((shipment) => Number(shipment.orderId) === Number(orderId))) return { success: false, message: "A shipment already exists for this order." };
  if (order.status === "cancelled") return { success: false, message: "Cancelled orders cannot be shipped." };

  const shipment = {
    id: generateIdentifier("SHP"),
    orderId: Number(order.id),
    buyerId: Number(order.buyerId),
    sellerId: Number(order.sellerId),
    deliveryMethod: String(payload.deliveryMethod || order.deliveryMethod || "standard").trim().toLowerCase(),
    carrier: String(payload.carrier || "Seller-managed delivery").trim(),
    trackingNumber: String(payload.trackingNumber || generateIdentifier("TRK")).trim(),
    estimatedDeliveryDate: payload.estimatedDeliveryDate || null,
    status: "pending",
    deliveryAddress: order.shippingAddress,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deliveredAt: null,
    deliveryConfirmedAt: null,
  };

  if (!deliveryMethods.includes(shipment.deliveryMethod)) return { success: false, message: "Select a supported delivery method." };
  if (!logisticsProviders.includes(shipment.carrier) && !shipment.carrier) return { success: false, message: "A logistics provider is required." };
  shipments.push(shipment);
  logAudit("shipment_created", { shipmentId: shipment.id, orderId: shipment.orderId, sellerId, outcome: "success" });
  logNotification("shipment_created", shipment);
  return { success: true, shipment: normalizeShipment(shipment), message: "Shipment created successfully." };
}

// Return a shipment while enforcing the relationship to the requested order.
async function getShipmentByOrderId(orderId) {
  const shipment = shipments.find((entry) => Number(entry.orderId) === Number(orderId));
  return shipment ? normalizeShipment(shipment) : null;
}

// Return shipments visible to a buyer or seller.
async function getShipmentsForUser(userId) {
  return shipments.filter((shipment) => Number(shipment.buyerId) === Number(userId) || Number(shipment.sellerId) === Number(userId)).map(normalizeShipment);
}

// Update a shipment status and emit the required notification event.
async function updateDeliveryStatus(actorId, shipmentId, status, details = "") {
  const shipment = shipments.find((entry) => String(entry.id) === String(shipmentId));
  const normalizedStatus = String(status || "").trim().toLowerCase();
  if (!shipment) return { success: false, message: "Shipment not found." };
  if (Number(shipment.sellerId) !== Number(actorId)) return { success: false, message: "Only the seller or logistics provider can update shipment status." };
  if (!deliveryStatuses.includes(normalizedStatus)) return { success: false, message: "Unsupported delivery status." };

  shipment.status = normalizedStatus;
  shipment.statusDetails = String(details || "").trim();
  shipment.updatedAt = new Date().toISOString();
  if (normalizedStatus === "delivered") shipment.deliveredAt = shipment.updatedAt;
  if (normalizedStatus === "delivered") {
    await orderModel.updateOrderStatus(actorId, shipment.orderId, "delivered", "Shipment delivered successfully.");
  }
  logAudit(normalizedStatus === "failed_delivery" ? "delivery_failed" : "shipment_status_updated", { shipmentId: shipment.id, orderId: shipment.orderId, actorId, status: normalizedStatus, details: shipment.statusDetails, outcome: "success" });
  logNotification(normalizedStatus, shipment);
  return { success: true, shipment: normalizeShipment(shipment), message: "Delivery status updated successfully." };
}

// Allow the buyer to record receipt after the shipment is delivered.
async function confirmDelivery(buyerId, shipmentId) {
  const shipment = shipments.find((entry) => String(entry.id) === String(shipmentId));
  if (!shipment) return { success: false, message: "Shipment not found." };
  if (Number(shipment.buyerId) !== Number(buyerId)) return { success: false, message: "You can only confirm your own delivery." };
  if (shipment.status !== "delivered") return { success: false, message: "Delivery can be confirmed after it is marked delivered." };

  shipment.deliveryConfirmedAt = new Date().toISOString();
  shipment.updatedAt = shipment.deliveryConfirmedAt;
  logAudit("delivery_completed", { shipmentId: shipment.id, orderId: shipment.orderId, buyerId, outcome: "success" });
  logNotification("delivery_confirmed", shipment);
  return { success: true, shipment: normalizeShipment(shipment), message: "Delivery confirmed successfully." };
}

// Expose audit records for operational review and automated tests.
async function getAuditLog() {
  return [...auditEntries];
}

// Expose notification records for integration with a future notification provider.
async function getNotificationLog() {
  return [...notificationEntries];
}

module.exports = { deliveryMethods, deliveryStatuses, logisticsProviders, selectDeliveryMethod, createShipment, getShipmentByOrderId, getShipmentsForUser, updateDeliveryStatus, confirmDelivery, getAuditLog, getNotificationLog, shipments };
