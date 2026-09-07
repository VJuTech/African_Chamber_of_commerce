/* PostgreSQL-backed order lifecycle for ACC Chapter 18. */
const pool = require("../database/connection");
const notificationModel = require("./notificationModel");

const statusValues = ["pending", "confirmed", "processing", "shipped", "delivered", "completed", "cancelled"];
const orderColumns = `id, buyer_id AS "buyerId", seller_id AS "sellerId", listing_id AS "listingId", listing_title AS "listingTitle", quantity, unit_price AS "unitPrice", total_price AS "totalPrice", currency, payment_method AS "paymentMethod", payment_status AS "paymentStatus", status, delivery_method AS "deliveryMethod", shipping_address AS "shippingAddress", tracking_details AS "trackingDetails", notes, created_at AS "createdAt", updated_at AS "updatedAt", cancelled_at AS "cancelledAt", refunded_at AS "refundedAt", dispute_id AS "disputeId"`;

async function recordAudit(client, orderId, userId, eventType, details = {}, outcome = "success") {
  const result = await client.query("INSERT INTO order_audit_logs (order_id, user_id, event_type, outcome, details) VALUES ($1, $2, $3, $4, $5) RETURNING id, event_type AS \"eventType\", outcome, details, created_at AS \"createdAt\"", [orderId || null, userId || null, eventType, outcome, details]);
  return result.rows[0];
}

function logOrderNotification(type, payload = {}) {
  const entry = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type,
    timestamp: new Date().toISOString(),
    payload,
  };

  notificationModel.generateFromEvent(type, payload);
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

async function dbOrder(id) { const result = await pool.query(`SELECT ${orderColumns} FROM orders WHERE id = $1`, [id]); return result.rows[0] ? normalizeOrder(result.rows[0]) : null; }
async function dbAudit(client, orderId, userId, eventType, details = {}) { return recordAudit(client, orderId, userId, eventType, details); }
async function dbMutate(actorId, orderId, values, eventType, message, notificationType, details = {}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const current = await client.query(`SELECT ${orderColumns} FROM orders WHERE id = $1 FOR UPDATE`, [orderId]);
    if (!current.rows[0]) { await client.query("ROLLBACK"); return { success: false, message: "Order not found." }; }
    const set = Object.keys(values).map((key, index) => `${key} = $${index + 2}`).join(", ");
    const result = await client.query(`UPDATE orders SET ${set}, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING ${orderColumns}`, [orderId, ...Object.values(values)]);
    const order = normalizeOrder(result.rows[0]); await dbAudit(client, order.id, actorId, eventType, { orderId: order.id, actorId, status: order.status, ...details }); await client.query("COMMIT");
    if (notificationType) notificationModel.generateFromEvent(notificationType, { orderId: order.id, buyerId: order.buyerId, sellerId: order.sellerId }); return { success: true, order, message };
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}
async function createOrder(buyerId, payload = {}) {
  if (!buyerId) return { success: false, message: "Buyer authentication is required to place an order." }; const sellerId = Number(payload.sellerId || 0), listingId = Number(payload.listingId || 0), quantity = Number(payload.quantity || 0), unitPrice = Number(payload.unitPrice || 0), title = String(payload.listingTitle || "").trim(), address = String(payload.shippingAddress || "").trim();
  if (!sellerId || !listingId || !title || quantity <= 0 || unitPrice <= 0 || !address) return { success: false, message: "Order details are incomplete. Please provide a valid listing, quantity, price, seller, and delivery address." }; const client = await pool.connect();
  try { await client.query("BEGIN"); const result = await client.query(`INSERT INTO orders (buyer_id,seller_id,listing_id,listing_title,quantity,unit_price,total_price,currency,payment_method,delivery_method,shipping_address,tracking_details,notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING ${orderColumns}`, [buyerId, sellerId, listingId, title, quantity, unitPrice, quantity * unitPrice, String(payload.currency || "USD").toUpperCase(), String(payload.paymentMethod || "card").toLowerCase(), String(payload.deliveryMethod || "standard"), address, "Order created and awaiting confirmation.", String(payload.notes || "")]); const order = normalizeOrder(result.rows[0]); await dbAudit(client, order.id, buyerId, "order_created", { orderId: order.id, buyerId, sellerId }); await client.query("COMMIT"); notificationModel.generateFromEvent("order_placed", { orderId: order.id, buyerId, sellerId, title }); return { success: true, order, message: "Order placed successfully." }; } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}
async function confirmOrder(sellerId, orderId) { const order = await dbOrder(orderId); if (!order) return { success: false, message: "Order not found." }; if (order.sellerId !== Number(sellerId)) return { success: false, message: "You are not the assigned seller for this order." }; if (order.status === "cancelled") return { success: false, message: "Cancelled orders cannot be confirmed." }; return dbMutate(sellerId, orderId, { status: "confirmed", payment_status: "paid", tracking_details: "Order confirmed and being prepared for fulfillment." }, "order_confirmed", "Order confirmed successfully.", "order_confirmed"); }
async function updateOrderStatus(actorId, orderId, nextStatus, details = "") { const status = String(nextStatus || "").toLowerCase(); if (!statusValues.includes(status)) return { success: false, message: "Unsupported order status." }; const order = await dbOrder(orderId); if (!order) return { success: false, message: "Order not found." }; if (order.buyerId !== Number(actorId) && order.sellerId !== Number(actorId)) return { success: false, message: "You do not have permission to update this order." }; if (status === "cancelled" && ["completed", "delivered"].includes(order.status)) return { success: false, message: "Completed or delivered orders cannot be cancelled." }; if (status !== "cancelled" && order.status === "cancelled") return { success: false, message: "Cancelled orders cannot be reactivated." }; const values = { status, tracking_details: details || `Status updated to ${status}.` }; if (status === "cancelled") Object.assign(values, { cancelled_at: new Date(), payment_status: "refund_pending" }); if (["delivered", "completed"].includes(status)) values.payment_status = "paid"; return dbMutate(actorId, orderId, values, "order_status_updated", "Order status updated successfully.", status === "cancelled" ? "order_cancelled" : `order_${status}`); }
async function cancelOrder(buyerId, orderId, reason = "") { const order = await dbOrder(orderId); if (!order) return { success: false, message: "Order not found." }; if (order.buyerId !== Number(buyerId)) return { success: false, message: "You can only cancel your own orders." }; if (["completed", "delivered"].includes(order.status)) return { success: false, message: "Completed or delivered orders cannot be cancelled." }; if (order.status === "cancelled") return { success: false, message: "This order has already been cancelled." }; return dbMutate(buyerId, orderId, { status: "cancelled", cancelled_at: new Date(), payment_status: "refund_pending", tracking_details: reason ? `Cancelled by buyer: ${reason}` : "Cancelled by buyer." }, "order_cancelled", "Order cancelled successfully.", "order_cancelled", { reason }); }
async function processRefund(adminUserId, orderId, reason = "") { const order = await dbOrder(orderId); if (!order) return { success: false, message: "Order not found." }; if (order.status !== "cancelled") return { success: false, message: "Refunds are available only for cancelled orders." }; return dbMutate(adminUserId, orderId, { payment_status: "refunded", refunded_at: new Date(), tracking_details: reason ? `Refund processed: ${reason}` : "Refund processed for cancelled order." }, "refund_processed", "Refund processed successfully.", "refund_processed", { reason, adminUserId }); }
async function getOrderHistory(userId) { const result = await pool.query(`SELECT ${orderColumns} FROM orders WHERE buyer_id = $1 OR seller_id = $1 ORDER BY created_at DESC`, [userId]); return result.rows.map(normalizeOrder); }
async function getSellerOrders(sellerId) { const result = await pool.query(`SELECT ${orderColumns} FROM orders WHERE seller_id = $1 ORDER BY created_at DESC`, [sellerId]); return result.rows.map(normalizeOrder); }
async function getOrderById(orderId) { return dbOrder(orderId); }
async function updateDeliveryMethod(buyerId, orderId, deliveryMethod) { const order = await dbOrder(orderId); if (!order) return { success: false, message: "Order not found." }; if (order.buyerId !== Number(buyerId)) return { success: false, message: "You can only select delivery for your own order." }; return dbMutate(buyerId, orderId, { delivery_method: deliveryMethod }, "delivery_method_selected", "Delivery method saved successfully.", null, { deliveryMethod }); }
async function raiseDispute(buyerId, orderId, reason = "") { const client = await pool.connect(); try { await client.query("BEGIN"); const order = await client.query("SELECT id,buyer_id,seller_id FROM orders WHERE id=$1 FOR UPDATE", [orderId]); if (!order.rows[0]) { await client.query("ROLLBACK"); return { success: false, message: "Order not found." }; } if (Number(order.rows[0].buyer_id) !== Number(buyerId)) { await client.query("ROLLBACK"); return { success: false, message: "You can only raise a dispute for your own order." }; } const dispute = await client.query("INSERT INTO order_disputes (order_id,buyer_id,seller_id,reason) VALUES ($1,$2,$3,$4) RETURNING id,order_id AS \"orderId\",buyer_id AS \"buyerId\",seller_id AS \"sellerId\",reason,status,created_at AS \"createdAt\"", [orderId, buyerId, order.rows[0].seller_id, String(reason || "").trim() || "Order issue reported by buyer."]); await client.query("UPDATE orders SET dispute_id=$1,updated_at=CURRENT_TIMESTAMP WHERE id=$2", [dispute.rows[0].id, orderId]); await dbAudit(client, orderId, buyerId, "dispute_raised", { orderId, buyerId, sellerId: order.rows[0].seller_id, reason: dispute.rows[0].reason }); await client.query("COMMIT"); return { success: true, dispute: dispute.rows[0], message: "Dispute submitted successfully." }; } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); } }
async function getOrderAuditLog() { const result = await pool.query("SELECT id,order_id AS \"orderId\",user_id AS \"userId\",event_type AS \"eventType\",outcome,details,created_at AS \"createdAt\" FROM order_audit_logs ORDER BY created_at,id"); return result.rows; }

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
};
