/* ******************************************
 * orderModel.js - Order lifecycle, status tracking, cancellation, refunds, disputes, and audit logging for ACC Chapter 18.
 * Keeps the order engine lightweight and in-memory while still supporting transactional flow and audit history.
 *******************************************/
const fs = require("fs");
const path = require("path");

const auditLogPath = path.join(__dirname, "..", "logs", "orders-audit.log");
const notificationLogPath = path.join(__dirname, "..", "logs", "orders-notifications.log");
const disputeLogPath = path.join(__dirname, "..", "logs", "orders-disputes.log");
fs.mkdirSync(path.dirname(auditLogPath), { recursive: true });
fs.mkdirSync(path.dirname(notificationLogPath), { recursive: true });
fs.mkdirSync(path.dirname(disputeLogPath), { recursive: true });

const fallbackOrders = [
  {
    id: 1,
    buyerId: 10,
    sellerId: 2,
    listingId: 1,
    listingTitle: "Organic Coffee Beans",
    quantity: 1,
    unitPrice: 24.5,
    totalPrice: 24.5,
    currency: "USD",
    paymentMethod: "card",
    paymentStatus: "paid",
    status: "completed",
    deliveryMethod: "Courier",
    shippingAddress: "12 Brook Road, Nairobi",
    trackingDetails: "Delivered to destination",
    notes: "Sample completed order",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    cancelledAt: null,
    refundedAt: null,
    disputeId: null,
  },
];

const fallbackDisputes = [];
const fallbackAuditLog = [];

function logOrderAudit(eventType, details = {}) {
  const entry = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    eventType,
    timestamp: new Date().toISOString(),
    details,
  };

  fallbackAuditLog.push(entry);
  fs.appendFileSync(auditLogPath, `${JSON.stringify(entry)}\n`);
  return entry;
}

function logOrderNotification(type, payload = {}) {
  const entry = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type,
    timestamp: new Date().toISOString(),
    payload,
  };

  fs.appendFileSync(notificationLogPath, `${JSON.stringify(entry)}\n`);
  return entry;
}

function normalizeOrder(record = {}) {
  return {
    id: Number(record.id),
    buyerId: Number(record.buyerId || 0),
    sellerId: Number(record.sellerId || 0),
    listingId: Number(record.listingId || 0),
    listingTitle: record.listingTitle || "Listing",
    quantity: Number(record.quantity || 1),
    unitPrice: Number(record.unitPrice || 0),
    totalPrice: Number(record.totalPrice || 0),
    currency: record.currency || "USD",
    paymentMethod: record.paymentMethod || "card",
    paymentStatus: record.paymentStatus || "pending",
    status: record.status || "pending",
    deliveryMethod: record.deliveryMethod || "standard",
    shippingAddress: record.shippingAddress || "",
    trackingDetails: record.trackingDetails || "Awaiting fulfillment",
    notes: record.notes || "",
    createdAt: record.createdAt || new Date().toISOString(),
    updatedAt: record.updatedAt || record.createdAt || new Date().toISOString(),
    cancelledAt: record.cancelledAt || null,
    refundedAt: record.refundedAt || null,
    disputeId: record.disputeId || null,
  };
}

function statusOptions() {
  return ["pending", "confirmed", "processing", "shipped", "delivered", "completed", "cancelled"];
}

function calculateTotal(quantity, unitPrice) {
  return Number(quantity || 0) * Number(unitPrice || 0);
}

async function createOrder(buyerId, payload = {}) {
  if (!buyerId) {
    return { success: false, message: "Buyer authentication is required to place an order." };
  }

  const sellerId = Number(payload.sellerId || 0);
  const listingId = Number(payload.listingId || 0);
  const listingTitle = String(payload.listingTitle || "").trim();
  const quantity = Number(payload.quantity || 0);
  const unitPrice = Number(payload.unitPrice || 0);
  const currency = String(payload.currency || "USD").trim().toUpperCase();
  const paymentMethod = String(payload.paymentMethod || "card").trim().toLowerCase();
  const shippingAddress = String(payload.shippingAddress || "").trim();
  const deliveryMethod = String(payload.deliveryMethod || "standard").trim();

  if (!sellerId || !listingId || !listingTitle || !quantity || quantity <= 0 || !unitPrice || !shippingAddress) {
    return { success: false, message: "Order details are incomplete. Please provide a valid listing, quantity, price, seller, and delivery address." };
  }

  const order = {
    id: fallbackOrders.length + 1,
    buyerId: Number(buyerId),
    sellerId,
    listingId,
    listingTitle,
    quantity,
    unitPrice,
    totalPrice: calculateTotal(quantity, unitPrice),
    currency,
    paymentMethod,
    paymentStatus: "pending",
    status: "pending",
    deliveryMethod,
    shippingAddress,
    trackingDetails: "Order created and awaiting confirmation.",
    notes: String(payload.notes || "").trim(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    cancelledAt: null,
    refundedAt: null,
    disputeId: null,
  };

  fallbackOrders.push(order);
  logOrderAudit("order_created", { orderId: order.id, buyerId: order.buyerId, sellerId: order.sellerId, status: order.status, outcome: "success" });
  logOrderNotification("order_placed", { orderId: order.id, buyerId: order.buyerId, sellerId: order.sellerId, title: order.listingTitle });

  return { success: true, order: normalizeOrder(order), message: "Order placed successfully." };
}

async function confirmOrder(sellerId, orderId) {
  const order = fallbackOrders.find((entry) => Number(entry.id) === Number(orderId));

  if (!order) {
    return { success: false, message: "Order not found." };
  }

  if (Number(order.sellerId) !== Number(sellerId)) {
    return { success: false, message: "You are not the assigned seller for this order." };
  }

  if (order.status === "cancelled") {
    return { success: false, message: "Cancelled orders cannot be confirmed." };
  }

  order.status = "confirmed";
  order.paymentStatus = "paid";
  order.trackingDetails = "Order confirmed and being prepared for fulfillment.";
  order.updatedAt = new Date().toISOString();

  logOrderAudit("order_confirmed", { orderId: order.id, sellerId, status: order.status, outcome: "success" });
  logOrderNotification("order_confirmed", { orderId: order.id, buyerId: order.buyerId, sellerId: order.sellerId });

  return { success: true, order: normalizeOrder(order), message: "Order confirmed successfully." };
}

async function updateOrderStatus(actorId, orderId, nextStatus, details = "") {
  const order = fallbackOrders.find((entry) => Number(entry.id) === Number(orderId));

  if (!order) {
    return { success: false, message: "Order not found." };
  }

  const normalizedStatus = String(nextStatus || "").trim().toLowerCase();
  if (!statusOptions().includes(normalizedStatus)) {
    return { success: false, message: "Unsupported order status." };
  }

  const isSeller = Number(order.sellerId) === Number(actorId);
  const isBuyer = Number(order.buyerId) === Number(actorId);
  if (!isSeller && !isBuyer) {
    return { success: false, message: "You do not have permission to update this order." };
  }

  if (normalizedStatus === "cancelled") {
    if (order.status === "completed" || order.status === "delivered") {
      return { success: false, message: "Completed or delivered orders cannot be cancelled." };
    }
    order.status = "cancelled";
    order.cancelledAt = new Date().toISOString();
    order.paymentStatus = "refund_pending";
  } else {
    if (order.status === "cancelled") {
      return { success: false, message: "Cancelled orders cannot be reactivated." };
    }
    order.status = normalizedStatus;
    if (normalizedStatus === "delivered") {
      order.paymentStatus = "paid";
    }
    if (normalizedStatus === "completed") {
      order.paymentStatus = "paid";
    }
  }

  order.trackingDetails = details || `Status updated to ${normalizedStatus}.`;
  order.updatedAt = new Date().toISOString();

  logOrderAudit("order_status_updated", { orderId: order.id, actorId, status: order.status, outcome: "success" });
  logOrderNotification(order.status === "cancelled" ? "order_cancelled" : `order_${order.status}`, { orderId: order.id, buyerId: order.buyerId, sellerId: order.sellerId });

  return { success: true, order: normalizeOrder(order), message: "Order status updated successfully." };
}

async function cancelOrder(buyerId, orderId, reason = "") {
  const order = fallbackOrders.find((entry) => Number(entry.id) === Number(orderId));

  if (!order) {
    return { success: false, message: "Order not found." };
  }

  if (Number(order.buyerId) !== Number(buyerId)) {
    return { success: false, message: "You can only cancel your own orders." };
  }

  if (order.status === "completed" || order.status === "delivered") {
    return { success: false, message: "Completed or delivered orders cannot be cancelled." };
  }

  if (order.status === "cancelled") {
    return { success: false, message: "This order has already been cancelled." };
  }

  order.status = "cancelled";
  order.cancelledAt = new Date().toISOString();
  order.paymentStatus = "refund_pending";
  order.trackingDetails = reason ? `Cancelled by buyer: ${reason}` : "Cancelled by buyer.";
  order.updatedAt = new Date().toISOString();

  logOrderAudit("order_cancelled", { orderId: order.id, buyerId, reason, outcome: "success" });
  logOrderNotification("order_cancelled", { orderId: order.id, buyerId: order.buyerId, sellerId: order.sellerId, reason });

  return { success: true, order: normalizeOrder(order), message: "Order cancelled successfully." };
}

async function processRefund(adminUserId, orderId, reason = "") {
  const order = fallbackOrders.find((entry) => Number(entry.id) === Number(orderId));

  if (!order) {
    return { success: false, message: "Order not found." };
  }

  if (order.status !== "cancelled") {
    return { success: false, message: "Refunds are available only for cancelled orders." };
  }

  order.paymentStatus = "refunded";
  order.refundedAt = new Date().toISOString();
  order.updatedAt = new Date().toISOString();
  order.trackingDetails = reason ? `Refund processed: ${reason}` : "Refund processed for cancelled order.";

  logOrderAudit("refund_processed", { orderId: order.id, adminUserId, reason, outcome: "success" });
  logOrderNotification("refund_processed", { orderId: order.id, buyerId: order.buyerId, sellerId: order.sellerId, amount: order.totalPrice });

  return { success: true, order: normalizeOrder(order), message: "Refund processed successfully." };
}

async function getOrderHistory(userId) {
  return fallbackOrders
    .filter((entry) => Number(entry.buyerId) === Number(userId) || Number(entry.sellerId) === Number(userId))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map((entry) => normalizeOrder(entry));
}

async function getSellerOrders(sellerId) {
  return fallbackOrders
    .filter((entry) => Number(entry.sellerId) === Number(sellerId))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map((entry) => normalizeOrder(entry));
}

async function getOrderById(orderId) {
  const order = fallbackOrders.find((entry) => Number(entry.id) === Number(orderId));
  return order ? normalizeOrder(order) : null;
}

// Persist a buyer's selected delivery method on the existing order lifecycle.
async function updateDeliveryMethod(buyerId, orderId, deliveryMethod) {
  const order = fallbackOrders.find((entry) => Number(entry.id) === Number(orderId));
  if (!order) return { success: false, message: "Order not found." };
  if (Number(order.buyerId) !== Number(buyerId)) return { success: false, message: "You can only select delivery for your own order." };

  order.deliveryMethod = deliveryMethod;
  order.updatedAt = new Date().toISOString();
  logOrderAudit("delivery_method_selected", { orderId: order.id, buyerId, deliveryMethod, outcome: "success" });
  return { success: true, order: normalizeOrder(order), message: "Delivery method saved successfully." };
}

async function raiseDispute(buyerId, orderId, reason = "") {
  const order = fallbackOrders.find((entry) => Number(entry.id) === Number(orderId));

  if (!order) {
    return { success: false, message: "Order not found." };
  }

  if (Number(order.buyerId) !== Number(buyerId)) {
    return { success: false, message: "You can only raise a dispute for your own order." };
  }

  const dispute = {
    id: fallbackDisputes.length + 1,
    orderId: Number(orderId),
    buyerId: Number(buyerId),
    sellerId: Number(order.sellerId),
    reason: String(reason || "").trim() || "Order issue reported by buyer.",
    status: "open",
    createdAt: new Date().toISOString(),
  };

  fallbackDisputes.push(dispute);
  order.disputeId = dispute.id;
  logOrderAudit("dispute_raised", { orderId: dispute.orderId, buyerId, sellerId: dispute.sellerId, reason: dispute.reason, outcome: "success" });
  fs.appendFileSync(disputeLogPath, `${JSON.stringify(dispute)}\n`);

  return { success: true, dispute, message: "Dispute submitted successfully." };
}

async function getOrderAuditLog() {
  return [...fallbackAuditLog];
}

module.exports = {
  createOrder,
  confirmOrder,
  updateOrderStatus,
  cancelOrder,
  processRefund,
  getOrderHistory,
  getSellerOrders,
  getOrderById,
  updateDeliveryMethod,
  raiseDispute,
  getOrderAuditLog,
  fallbackOrders,
};
