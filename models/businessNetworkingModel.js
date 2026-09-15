const pool = require("../database/connection");
const notificationModel = require("./notificationModel");

async function logNetworkingAudit(eventType, details = {}) {
  const result = await pool.query(
    `INSERT INTO audit_logs (event_type, user_id, outcome, details)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [eventType, details.userId || details.senderId || details.receiverId || null, details.outcome || "success", details]
  );
  return result.rows[0];
}

function logNetworkingNotification(type, payload = {}) {
  return notificationModel.generateFromEvent(type, payload);
}

function normalizeConnection(record = {}) {
  return {
    id: record.id,
    senderId: record.sender_id || record.senderId || null,
    receiverId: record.receiver_id || record.receiverId || null,
    status: record.status || "pending",
    message: record.message || "",
    targetType: record.target_type || record.targetType || "user",
    createdAt: record.created_at || record.createdAt || null,
    updatedAt: record.updated_at || record.updatedAt || null,
  };
}

function normalizeBlock(record = {}) {
  return { id: record.id, userId: record.user_id, targetId: record.target_id, reason: record.reason || "", createdAt: record.created_at || null };
}

function normalizeReport(record = {}) {
  return { id: record.id, userId: record.user_id, targetId: record.target_id, reportType: record.report_type, details: record.details || "", createdAt: record.created_at || null };
}

async function sendConnectionRequest(senderId, targetId, payload = {}) {
  if (!senderId || !targetId) {
    return { success: false, message: "Sender and target are required." };
  }

  if (Number(senderId) === Number(targetId)) {
    return { success: false, message: "You cannot send a connection request to yourself." };
  }

  const targetType = payload.targetType || "user";
  const message = String(payload.message || "").trim();
  const blocked = await pool.query(`SELECT 1 FROM business_connection_blocks WHERE user_id = $1 AND target_id = $2 LIMIT 1`, [senderId, targetId]);
  if (blocked.rows.length) return { success: false, message: "This connection request cannot be sent because the target is blocked." };
  const existing = await pool.query(`SELECT 1 FROM business_connections WHERE sender_id = $1 AND receiver_id = $2 AND status <> 'rejected' LIMIT 1`, [senderId, targetId]);
  if (existing.rows.length) return { success: false, message: "A duplicate connection request already exists." };
  const result = await pool.query(
    `INSERT INTO business_connections (sender_id, receiver_id, target_type, status, message) VALUES ($1, $2, $3, 'pending', $4) RETURNING *`,
    [senderId, targetId, targetType, message]
  );
  const connection = normalizeConnection(result.rows[0]);
  await logNetworkingAudit("connection_request_sent", { senderId, targetId, targetType, outcome: "success" });
  logNetworkingNotification("new_connection_request", { senderId, targetId, targetType, message });
  return { success: true, connection, message: "Connection request sent successfully." };
}

async function acceptConnectionRequest(receiverId, connectionId) {
  const result = await pool.query(`UPDATE business_connections SET status = 'accepted', updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND receiver_id = $2 AND status = 'pending' RETURNING *`, [connectionId, receiverId]);
  if (!result.rows.length) return { success: false, message: "Connection request not found or you do not have permission to accept it." };
  const connection = normalizeConnection(result.rows[0]);
  await logNetworkingAudit("connection_request_accepted", { receiverId, connectionId, outcome: "success" });
  logNetworkingNotification("request_accepted", { receiverId, connectionId, senderId: connection.senderId });
  return { success: true, connection, message: "Connection request accepted." };
}

async function rejectConnectionRequest(receiverId, connectionId) {
  const result = await pool.query(`UPDATE business_connections SET status = 'rejected', updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND receiver_id = $2 AND status = 'pending' RETURNING *`, [connectionId, receiverId]);
  if (!result.rows.length) return { success: false, message: "Connection request not found or you do not have permission to reject it." };
  const connection = normalizeConnection(result.rows[0]);
  await logNetworkingAudit("connection_request_rejected", { receiverId, connectionId, outcome: "success" });
  logNetworkingNotification("request_rejected", { receiverId, connectionId, senderId: connection.senderId });
  return { success: true, connection, message: "Connection request rejected." };
}

async function getConnectionRequests(userId) {
  const result = await pool.query(`SELECT * FROM business_connections WHERE (receiver_id = $1 OR sender_id = $1) AND status = 'pending' ORDER BY created_at DESC`, [userId]);
  return {
    incoming: result.rows.filter((row) => Number(row.receiver_id) === Number(userId)).map(normalizeConnection),
    outgoing: result.rows.filter((row) => Number(row.sender_id) === Number(userId)).map(normalizeConnection),
  };
}

async function getConnections(userId) {
  const result = await pool.query(`SELECT * FROM business_connections WHERE (sender_id = $1 OR receiver_id = $1) AND status = 'accepted' ORDER BY updated_at DESC`, [userId]);
  return result.rows.map(normalizeConnection);
}

async function blockConnectionTarget(userId, targetId, reason = "") {
  const result = await pool.query(`INSERT INTO business_connection_blocks (user_id, target_id, reason) VALUES ($1, $2, $3) ON CONFLICT (user_id, target_id) DO NOTHING RETURNING *`, [userId, targetId, String(reason || "").trim()]);
  if (!result.rows.length) return { success: false, message: "This target is already blocked." };
  const block = normalizeBlock(result.rows[0]);
  await logNetworkingAudit("connection_blocked", { userId, targetId, reason, outcome: "success" });
  return { success: true, block, message: "Target blocked successfully." };
}

async function reportConnectionIssue(userId, targetId, reportType, details) {
  const result = await pool.query(`INSERT INTO business_connection_reports (user_id, target_id, report_type, details) VALUES ($1, $2, $3, $4) RETURNING *`, [userId, targetId, String(reportType || "misconduct").trim(), String(details || "").trim()]);
  const report = normalizeReport(result.rows[0]);
  await logNetworkingAudit("connection_report_submitted", { userId, targetId, reportType, outcome: "success" });
  return { success: true, report, message: "Abuse report recorded and sent for review." };
}

async function getConnectionSuggestions(userId) {
  const result = await pool.query(`SELECT u.id, u.name FROM users u WHERE u.id <> $1 AND NOT EXISTS (SELECT 1 FROM business_connections c WHERE (c.sender_id = $1 AND c.receiver_id = u.id) OR (c.receiver_id = $1 AND c.sender_id = u.id)) AND NOT EXISTS (SELECT 1 FROM business_connection_blocks b WHERE b.user_id = $1 AND b.target_id = u.id) ORDER BY u.name ASC LIMIT 5`, [userId]);
  return result.rows.map((row) => ({ id: row.id, name: row.name || `Suggested connection ${row.id}`, reason: "Shared industry or location interest", targetId: row.id }));
}

module.exports = {
  sendConnectionRequest,
  acceptConnectionRequest,
  rejectConnectionRequest,
  getConnectionRequests,
  getConnections,
  blockConnectionTarget,
  reportConnectionIssue,
  getConnectionSuggestions,
  logNetworkingAudit,
  logNetworkingNotification,
};
