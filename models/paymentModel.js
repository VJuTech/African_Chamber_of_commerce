/* ******************************************
 * paymentModel.js - Payment processing engine for ACC Chapter 19.
 * Supports initiation, gateway processing, order linkage, refunds, audit logging, and multi-currency tracking.
 *******************************************/
const pool = require("../database/connection");
const complianceModel = require("./complianceModel");

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

const paymentColumns = `id, buyer_id AS "buyerId", seller_id AS "sellerId", order_id AS "orderId", transaction_id AS "transactionId", payment_reference AS "paymentReference", amount, currency, payment_method AS "paymentMethod", provider, status, refund_status AS "refundStatus", gateway_response AS "gatewayResponse", gateway_reference AS "gatewayReference", initiated_at AS "initiatedAt", processed_at AS "processedAt", updated_at AS "updatedAt", failure_reason AS "failureReason", notes`;
async function paymentById(id, client = pool) { const result = await client.query(`SELECT ${paymentColumns} FROM payments WHERE id = $1`, [id]); return result.rows[0] ? normalizePayment(result.rows[0]) : null; }
async function paymentAudit(client, paymentId, userId, eventType, details = {}, outcome = "success") { const result = await client.query("INSERT INTO payment_audit_logs (payment_id,user_id,event_type,outcome,details) VALUES ($1,$2,$3,$4,$5) RETURNING id,event_type AS \"eventType\",outcome,details,created_at AS \"createdAt\"", [paymentId || null, userId || null, eventType, outcome, details]); return result.rows[0]; }
async function initiatePayment(buyerId, payload = {}) { if (!buyerId) return { success: false, message: "Buyer authentication is required to initiate payment." }; const orderId = Number(payload.orderId || 0), amount = Number(payload.amount || 0); if (!orderId || amount <= 0) return { success: false, message: "A valid order and amount are required to initiate payment." }; const client = await pool.connect(); try { await client.query("BEGIN"); const payment = await client.query(`INSERT INTO payments (buyer_id,seller_id,order_id,transaction_id,payment_reference,amount,currency,payment_method,provider,status,refund_status,gateway_response,notes) VALUES ($1,COALESCE(NULLIF($2,0),(SELECT seller_id FROM orders WHERE id=$3)),$3,$4,$5,$6,$7,$8,$9,'initiated','not_requested','initiated',$10) RETURNING ${paymentColumns}`, [buyerId, Number(payload.sellerId || 0), orderId, `TXN-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, String(payload.paymentReference || `ACC-${Date.now()}`), amount, String(payload.currency || "USD").toUpperCase(), String(payload.paymentMethod || "card").toLowerCase(), String(payload.provider || "paystack").toLowerCase(), `Payment initiated for ${String(payload.orderNumber || `ORD-${Date.now()}`)}.`]); const record = normalizePayment(payment.rows[0]); await paymentAudit(client, record.id, buyerId, "payment_initiated", { paymentId: record.id, orderId, amount, currency: record.currency }); await client.query("INSERT INTO payment_gateway_events (payment_id,provider,status,reference,payload) VALUES ($1,$2,$3,$4,$5)", [record.id, record.provider, "initiated", record.paymentReference, { orderId, amount }]); await client.query("COMMIT"); return { success: true, payment: record, message: "Payment has been initiated successfully." }; } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); } }
async function updatePayment(paymentId, values, eventType, userId, details = {}) { const client = await pool.connect(); try { await client.query("BEGIN"); const set = Object.keys(values).map((key, i) => `${key}=$${i + 2}`).join(","); const result = await client.query(`UPDATE payments SET ${set},updated_at=CURRENT_TIMESTAMP WHERE id=$1 RETURNING ${paymentColumns}`, [paymentId, ...Object.values(values)]); if (!result.rows[0]) { await client.query("ROLLBACK"); return { success: false, message: "Payment not found." }; } const record = normalizePayment(result.rows[0]); await paymentAudit(client, record.id, userId, eventType, { paymentId: record.id, ...details }); await client.query("COMMIT"); return { success: true, payment: record, message: "Payment status updated successfully." }; } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); } }
async function processGatewayPayment(provider, paymentId, payload = {}) { const payment = await paymentById(paymentId); if (!payment) return { success: false, message: "Payment not found." }; const gatewayStatus = String(payload.status || "pending").toLowerCase(), status = ["success", "successful"].includes(gatewayStatus) ? "successful" : gatewayStatus === "pending" ? "pending" : "failed"; const values = { provider: String(provider || payment.provider).toLowerCase(), gateway_reference: String(payload.gatewayReference || payload.reference || payment.gatewayReference), gateway_response: gatewayStatus, status, processed_at: status === "successful" ? new Date() : payment.processedAt, failure_reason: status === "failed" ? (payload.reason || "Payment gateway declined the transaction.") : payment.failureReason }; const result = await updatePayment(paymentId, values, "payment_status_updated", null, { provider: values.provider, gatewayStatus, gatewayReference: values.gateway_reference }); const client = await pool.connect(); try { await client.query("INSERT INTO payment_gateway_events (payment_id,provider,status,reference,payload) VALUES ($1,$2,$3,$4,$5)", [paymentId, values.provider, gatewayStatus, values.gateway_reference, payload]); } finally { client.release(); } result.message = status === "successful" ? "Payment processed successfully." : status === "failed" ? "Payment failed." : "Payment is pending."; return result; }
async function updatePaymentStatus(paymentId, nextStatus, payload = {}) { const status = String(nextStatus || "").toLowerCase(); if (!["initiated", "pending", "successful", "failed", "refunded"].includes(status)) return { success: false, message: "Unsupported payment status." }; return updatePayment(paymentId, { status, gateway_response: status, failure_reason: status === "failed" ? (payload.reason || "Transaction failed.") : null, processed_at: status === "successful" ? new Date() : null, refund_status: status === "refunded" ? "refunded" : "not_requested" }, "payment_status_updated", null, { status }); }
async function retryPayment(userId, paymentId) { const payment = await paymentById(paymentId); if (!payment) return { success: false, message: "Payment not found." }; if (payment.buyerId !== Number(userId)) return { success: false, message: "Only the buyer can retry this payment." }; if (payment.status !== "failed") return { success: false, message: "Only failed payments can be retried." }; const result = await updatePayment(paymentId, { status: "initiated", gateway_response: "retry_pending", failure_reason: null, processed_at: null }, "payment_retry_requested", userId, { paymentId, retry: true }); const client = await pool.connect(); try { await client.query("INSERT INTO payment_gateway_events (payment_id,provider,status,reference,payload) VALUES ($1,$2,'retry_pending',$3,$4)", [paymentId, payment.provider, payment.paymentReference, { retry: true, userId: Number(userId) }]); } finally { client.release(); } result.message = "Payment retry has been initiated."; return result; }
async function linkPaymentToOrder(paymentId, orderId) { return updatePayment(paymentId, { order_id: Number(orderId) }, "payment_linked_to_order", null, { orderId: Number(orderId) }); }
async function refundPayment(userId, paymentId, reason = "") { const payment = await paymentById(paymentId); if (!payment) return { success: false, message: "Payment not found." }; if (payment.buyerId !== Number(userId)) return { success: false, message: "Only the buyer can request a refund for this payment." }; const client = await pool.connect(); try { await client.query("BEGIN"); const result = await client.query(`UPDATE payments SET status='refunded',refund_status='refunded',notes=$2,updated_at=CURRENT_TIMESTAMP WHERE id=$1 RETURNING ${paymentColumns}`, [paymentId, reason ? `Refund processed: ${reason}` : "Refund processed."]); const record = normalizePayment(result.rows[0]); await client.query("INSERT INTO payment_refunds (payment_id,buyer_id,amount,reason,status,processed_at) VALUES ($1,$2,$3,$4,'processed',CURRENT_TIMESTAMP)", [paymentId, userId, record.amount, reason]); await paymentAudit(client, paymentId, userId, "payment_refunded", { paymentId, buyerId: userId, amount: record.amount, reason }); await client.query("COMMIT"); return { success: true, payment: record, message: "Refund processed successfully." }; } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); } }
async function getUserPayments(userId) { const result = await pool.query(`SELECT ${paymentColumns} FROM payments WHERE buyer_id=$1 OR seller_id=$1 ORDER BY initiated_at DESC`, [userId]); return result.rows.map(normalizePayment); }
async function getPaymentById(paymentId) { return paymentById(paymentId); }
async function getPaymentAuditLog() { const result = await pool.query("SELECT id,payment_id AS \"paymentId\",user_id AS \"userId\",event_type AS \"eventType\",outcome,details,created_at AS \"createdAt\" FROM payment_audit_logs ORDER BY created_at,id"); return result.rows; }

module.exports = {
  initiatePayment,
  processGatewayPayment,
  updatePaymentStatus,
  retryPayment,
  linkPaymentToOrder,
  refundPayment,
  getUserPayments,
  getPaymentById,
  getPaymentAuditLog,
};
