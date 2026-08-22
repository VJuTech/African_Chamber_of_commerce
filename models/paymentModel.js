/* ******************************************
 * paymentModel.js - Payment processing engine for ACC Chapter 19.
 * Supports initiation, gateway processing, order linkage, refunds, audit logging, and multi-currency tracking.
 *******************************************/
const fs = require("fs");
const path = require("path");

const auditLogPath = path.join(__dirname, "..", "logs", "payments-audit.log");
const gatewayLogPath = path.join(__dirname, "..", "logs", "payments-gateway.log");
const refundLogPath = path.join(__dirname, "..", "logs", "payments-refunds.log");

fs.mkdirSync(path.dirname(auditLogPath), { recursive: true });
fs.mkdirSync(path.dirname(gatewayLogPath), { recursive: true });
fs.mkdirSync(path.dirname(refundLogPath), { recursive: true });

const fallbackPayments = [
  {
    id: 1,
    buyerId: 10,
    sellerId: 2,
    orderId: 1,
    transactionId: "TXN-ACC-1001",
    paymentReference: "ACC-REF-1001",
    amount: 24.5,
    currency: "USD",
    paymentMethod: "card",
    provider: "paystack",
    status: "successful",
    refundStatus: "not_requested",
    gatewayResponse: "approved",
    gatewayReference: "PS-90001",
    initiatedAt: new Date().toISOString(),
    processedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    failureReason: "",
    notes: "Initial sample payment.",
  },
];

const fallbackAuditLog = [];

function normalizePayment(record = {}) {
  return {
    id: Number(record.id),
    buyerId: Number(record.buyerId || 0),
    sellerId: Number(record.sellerId || 0),
    orderId: Number(record.orderId || 0),
    transactionId: record.transactionId || `TXN-${Date.now()}`,
    paymentReference: record.paymentReference || `REF-${Date.now()}`,
    amount: Number(record.amount || 0),
    currency: record.currency || "USD",
    paymentMethod: record.paymentMethod || "card",
    provider: record.provider || "paystack",
    status: record.status || "initiated",
    refundStatus: record.refundStatus || "not_requested",
    gatewayResponse: record.gatewayResponse || "pending",
    gatewayReference: record.gatewayReference || "",
    initiatedAt: record.initiatedAt || new Date().toISOString(),
    processedAt: record.processedAt || null,
    updatedAt: record.updatedAt || record.initiatedAt || new Date().toISOString(),
    failureReason: record.failureReason || "",
    notes: record.notes || "",
  };
}

function logPaymentAudit(eventType, details = {}) {
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

function logGatewayEvent(provider, payload = {}) {
  const entry = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    provider,
    timestamp: new Date().toISOString(),
    payload,
  };

  fs.appendFileSync(gatewayLogPath, `${JSON.stringify(entry)}\n`);
  return entry;
}

function logRefundEvent(paymentId, payload = {}) {
  const entry = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    paymentId,
    timestamp: new Date().toISOString(),
    payload,
  };

  fs.appendFileSync(refundLogPath, `${JSON.stringify(entry)}\n`);
  return entry;
}

async function initiatePayment(buyerId, payload = {}) {
  if (!buyerId) {
    return { success: false, message: "Buyer authentication is required to initiate payment." };
  }

  const orderId = Number(payload.orderId || 0);
  const amount = Number(payload.amount || 0);
  const currency = String(payload.currency || "USD").trim().toUpperCase();
  const paymentMethod = String(payload.paymentMethod || "card").trim().toLowerCase();
  const provider = String(payload.provider || "paystack").trim().toLowerCase();
  const paymentReference = String(payload.paymentReference || `ACC-${Date.now()}`).trim();
  const orderNumber = String(payload.orderNumber || `ORD-${Date.now()}`).trim();

  if (!orderId || !amount || amount <= 0) {
    return { success: false, message: "A valid order and amount are required to initiate payment." };
  }

  const payment = {
    id: fallbackPayments.length + 1,
    buyerId: Number(buyerId),
    sellerId: Number(payload.sellerId || 0),
    orderId,
    transactionId: `TXN-${Date.now()}`,
    paymentReference,
    amount,
    currency,
    paymentMethod,
    provider,
    status: "initiated",
    refundStatus: "not_requested",
    gatewayResponse: "initiated",
    gatewayReference: "",
    initiatedAt: new Date().toISOString(),
    processedAt: null,
    updatedAt: new Date().toISOString(),
    failureReason: "",
    notes: `Payment initiated for ${orderNumber}.`,
  };

  fallbackPayments.push(payment);
  logPaymentAudit("payment_initiated", { paymentId: payment.id, buyerId, orderId, amount, currency, status: payment.status, outcome: "success" });
  logGatewayEvent(provider, { paymentId: payment.id, paymentReference, orderId, amount, currency, paymentMethod, status: payment.status });

  return {
    success: true,
    payment: normalizePayment(payment),
    message: "Payment has been initiated successfully.",
  };
}

async function processGatewayPayment(provider, paymentId, payload = {}) {
  const payment = fallbackPayments.find((entry) => Number(entry.id) === Number(paymentId));

  if (!payment) {
    return { success: false, message: "Payment not found." };
  }

  const providerName = String(provider || payment.provider || "paystack").trim().toLowerCase();
  const gatewayStatus = String(payload.status || "pending").trim().toLowerCase();
  const gatewayReference = String(payload.gatewayReference || payload.reference || "").trim();

  payment.provider = providerName;
  payment.gatewayReference = gatewayReference || payment.gatewayReference;
  payment.gatewayResponse = gatewayStatus;
  payment.updatedAt = new Date().toISOString();

  if (gatewayStatus === "success" || gatewayStatus === "successful") {
    payment.status = "successful";
    payment.processedAt = new Date().toISOString();
    payment.notes = "Payment succeeded and order can proceed.";
  } else if (gatewayStatus === "pending") {
    payment.status = "pending";
    payment.notes = "Payment is pending confirmation from the gateway.";
  } else {
    payment.status = "failed";
    payment.failureReason = payload.reason || "Payment gateway declined the transaction.";
    payment.notes = payment.failureReason;
  }

  logPaymentAudit("payment_status_updated", { paymentId: payment.id, provider: payment.provider, gatewayStatus, gatewayReference, outcome: payment.status === "successful" ? "success" : "warning" });
  logGatewayEvent(payment.provider, { paymentId: payment.id, gatewayStatus, gatewayReference, amount: payment.amount, currency: payment.currency });

  return {
    success: true,
    payment: normalizePayment(payment),
    message: payment.status === "successful" ? "Payment processed successfully." : payment.status === "failed" ? "Payment failed." : "Payment is pending.",
  };
}

async function updatePaymentStatus(paymentId, nextStatus, payload = {}) {
  const payment = fallbackPayments.find((entry) => Number(entry.id) === Number(paymentId));

  if (!payment) {
    return { success: false, message: "Payment not found." };
  }

  const status = String(nextStatus || "").trim().toLowerCase();
  const validStatuses = ["initiated", "pending", "successful", "failed", "refunded"];

  if (!validStatuses.includes(status)) {
    return { success: false, message: "Unsupported payment status." };
  }

  payment.status = status;
  payment.gatewayResponse = status;
  payment.updatedAt = new Date().toISOString();

  if (status === "failed") {
    payment.failureReason = payload.reason || "Transaction failed.";
  }

  if (status === "successful") {
    payment.processedAt = payment.processedAt || new Date().toISOString();
  }

  if (status === "refunded") {
    payment.refundStatus = "refunded";
  }

  logPaymentAudit("payment_status_updated", { paymentId: payment.id, status, failureReason: payment.failureReason, outcome: "success" });

  return {
    success: true,
    payment: normalizePayment(payment),
    message: "Payment status updated successfully.",
  };
}

async function linkPaymentToOrder(paymentId, orderId) {
  const payment = fallbackPayments.find((entry) => Number(entry.id) === Number(paymentId));

  if (!payment) {
    return { success: false, message: "Payment not found." };
  }

  payment.orderId = Number(orderId || payment.orderId || 0);
  payment.updatedAt = new Date().toISOString();

  logPaymentAudit("payment_linked_to_order", { paymentId: payment.id, orderId: payment.orderId, outcome: "success" });

  return {
    success: true,
    payment: normalizePayment(payment),
    message: "Payment linked to order successfully.",
  };
}

async function refundPayment(userId, paymentId, reason = "") {
  const payment = fallbackPayments.find((entry) => Number(entry.id) === Number(paymentId));

  if (!payment) {
    return { success: false, message: "Payment not found." };
  }

  if (Number(payment.buyerId) !== Number(userId)) {
    return { success: false, message: "Only the buyer can request a refund for this payment." };
  }

  payment.status = "refunded";
  payment.refundStatus = "refunded";
  payment.updatedAt = new Date().toISOString();
  payment.notes = reason ? `Refund processed: ${reason}` : "Refund processed.";

  logPaymentAudit("payment_refunded", { paymentId: payment.id, buyerId: userId, reason, amount: payment.amount, outcome: "success" });
  logRefundEvent(payment.id, { paymentId: payment.id, buyerId: userId, amount: payment.amount, reason });

  return {
    success: true,
    payment: normalizePayment(payment),
    message: "Refund processed successfully.",
  };
}

async function getUserPayments(userId) {
  return fallbackPayments
    .filter((entry) => Number(entry.buyerId) === Number(userId) || Number(entry.sellerId) === Number(userId))
    .sort((a, b) => new Date(b.initiatedAt) - new Date(a.initiatedAt))
    .map((entry) => normalizePayment(entry));
}

async function getPaymentById(paymentId) {
  const payment = fallbackPayments.find((entry) => Number(entry.id) === Number(paymentId));
  return payment ? normalizePayment(payment) : null;
}

async function getPaymentAuditLog() {
  return [...fallbackAuditLog];
}

module.exports = {
  initiatePayment,
  processGatewayPayment,
  updatePaymentStatus,
  linkPaymentToOrder,
  refundPayment,
  getUserPayments,
  getPaymentById,
  getPaymentAuditLog,
  fallbackPayments,
};
