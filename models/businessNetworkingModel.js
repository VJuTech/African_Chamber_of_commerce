const fs = require("fs");
const path = require("path");
const pool = require("../database/connection");

const networkingAuditLogPath = path.join(__dirname, "..", "logs", "business-networking-audit.log");
const networkingNotificationLogPath = path.join(__dirname, "..", "logs", "business-networking-notifications.log");
const networkingReportsLogPath = path.join(__dirname, "..", "logs", "business-networking-reports.log");
fs.mkdirSync(path.dirname(networkingAuditLogPath), { recursive: true });
fs.mkdirSync(path.dirname(networkingNotificationLogPath), { recursive: true });
fs.mkdirSync(path.dirname(networkingReportsLogPath), { recursive: true });

const fallbackConnections = [
  {
    id: 1,
    senderId: 1,
    receiverId: 2,
    status: "accepted",
    createdAt: new Date().toISOString(),
    message: "Interested in exploring trade partnership opportunities.",
    targetType: "user",
  },
  {
    id: 2,
    senderId: 3,
    receiverId: 1,
    status: "pending",
    createdAt: new Date().toISOString(),
    message: "Would like to connect for procurement collaboration.",
    targetType: "business",
  },
];

const fallbackBlocks = [];
const fallbackReports = [];

function logNetworkingAudit(eventType, details = {}) {
  const entry = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    eventType,
    timestamp: new Date().toISOString(),
    details,
  };

  fs.appendFileSync(networkingAuditLogPath, `${JSON.stringify(entry)}\n`);
  return entry;
}

function logNetworkingNotification(type, payload = {}) {
  const entry = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type,
    timestamp: new Date().toISOString(),
    payload,
  };

  fs.appendFileSync(networkingNotificationLogPath, `${JSON.stringify(entry)}\n`);
  return entry;
}

function normalizeConnection(record = {}) {
  return {
    id: record.id,
    senderId: record.sender_id || record.senderId || null,
    receiverId: record.receiver_id || record.receiverId || null,
    status: record.status || "pending",
    message: record.message || "",
    targetType: record.target_type || record.targetType || "user",
    createdAt: record.created_at || record.createdAt || new Date().toISOString(),
    updatedAt: record.updated_at || record.updatedAt || new Date().toISOString(),
  };
}

async function sendConnectionRequest(senderId, targetId, payload = {}) {
  if (!senderId || !targetId) {
    return { success: false, message: "Sender and target are required." };
  }

  const targetType = payload.targetType || "user";
  const message = (payload.message || "").trim();

  if (fallbackBlocks.some((entry) => Number(entry.userId) === Number(senderId) && Number(entry.targetId) === Number(targetId))) {
    return { success: false, message: "This connection request cannot be sent because the target is blocked." };
  }

  try {
    const existing = await pool.query(
      `SELECT * FROM business_connections WHERE sender_id = $1 AND receiver_id = $2 LIMIT 1`,
      [senderId, targetId]
    );

    if (existing.rows.length > 0) {
      return { success: false, message: "A duplicate connection request already exists." };
    }
  } catch (error) {
    const duplicate = fallbackConnections.find(
      (entry) => Number(entry.senderId) === Number(senderId) && Number(entry.receiverId) === Number(targetId) && entry.status !== "rejected"
    );

    if (duplicate) {
      return { success: false, message: "A duplicate connection request already exists." };
    }
  }

  const record = {
    id: fallbackConnections.length + 1,
    senderId,
    receiverId: targetId,
    status: "pending",
    message,
    targetType,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  fallbackConnections.push(record);
  logNetworkingAudit("connection_request_sent", { senderId, targetId, targetType, outcome: "success" });
  logNetworkingNotification("new_connection_request", { senderId, targetId, targetType, message });

  return { success: true, connection: normalizeConnection(record), message: "Connection request sent successfully." };
}

async function acceptConnectionRequest(receiverId, connectionId) {
  const entry = fallbackConnections.find((item) => Number(item.id) === Number(connectionId) && Number(item.receiverId) === Number(receiverId));

  if (!entry) {
    return { success: false, message: "Connection request not found or you do not have permission to accept it." };
  }

  entry.status = "accepted";
  entry.updatedAt = new Date().toISOString();
  logNetworkingAudit("connection_request_accepted", { receiverId, connectionId, outcome: "success" });
  logNetworkingNotification("request_accepted", { receiverId, connectionId });

  return { success: true, connection: normalizeConnection(entry), message: "Connection request accepted." };
}

async function rejectConnectionRequest(receiverId, connectionId) {
  const entry = fallbackConnections.find((item) => Number(item.id) === Number(connectionId) && Number(item.receiverId) === Number(receiverId));

  if (!entry) {
    return { success: false, message: "Connection request not found or you do not have permission to reject it." };
  }

  entry.status = "rejected";
  entry.updatedAt = new Date().toISOString();
  logNetworkingAudit("connection_request_rejected", { receiverId, connectionId, outcome: "success" });
  logNetworkingNotification("request_rejected", { receiverId, connectionId });

  return { success: true, connection: normalizeConnection(entry), message: "Connection request rejected." };
}

async function getConnectionRequests(userId) {
  const incoming = fallbackConnections.filter((item) => Number(item.receiverId) === Number(userId) && item.status === "pending");
  const outgoing = fallbackConnections.filter((item) => Number(item.senderId) === Number(userId) && item.status === "pending");

  return {
    incoming: incoming.map(normalizeConnection),
    outgoing: outgoing.map(normalizeConnection),
  };
}

async function getConnections(userId) {
  const records = fallbackConnections.filter((item) => {
    const isSender = Number(item.senderId) === Number(userId);
    const isReceiver = Number(item.receiverId) === Number(userId);
    return (isSender || isReceiver) && item.status === "accepted";
  });

  return records.map(normalizeConnection);
}

async function blockConnectionTarget(userId, targetId, reason = "") {
  const alreadyBlocked = fallbackBlocks.some((entry) => Number(entry.userId) === Number(userId) && Number(entry.targetId) === Number(targetId));
  if (alreadyBlocked) {
    return { success: false, message: "This target is already blocked." };
  }

  const blockEntry = {
    id: fallbackBlocks.length + 1,
    userId,
    targetId,
    reason,
    createdAt: new Date().toISOString(),
  };

  fallbackBlocks.push(blockEntry);
  logNetworkingAudit("connection_blocked", { userId, targetId, reason, outcome: "success" });

  return { success: true, block: blockEntry, message: "Target blocked successfully." };
}

async function reportConnectionIssue(userId, targetId, reportType, details) {
  const record = {
    id: fallbackReports.length + 1,
    userId,
    targetId,
    reportType,
    details,
    createdAt: new Date().toISOString(),
  };

  fallbackReports.push(record);
  fs.appendFileSync(networkingReportsLogPath, `${JSON.stringify(record)}\n`);
  logNetworkingAudit("connection_report_submitted", { userId, targetId, reportType, outcome: "success" });

  return { success: true, report: record, message: "Abuse report recorded and sent for review." };
}

async function getConnectionSuggestions(userId) {
  const current = fallbackConnections.filter((item) => Number(item.senderId) === Number(userId) || Number(item.receiverId) === Number(userId));
  const relatedIds = new Set();

  current.forEach((item) => {
    relatedIds.add(Number(item.senderId));
    relatedIds.add(Number(item.receiverId));
  });

  const suggestions = fallbackConnections
    .filter((item) => {
      const isSender = Number(item.senderId) === Number(userId);
      const isReceiver = Number(item.receiverId) === Number(userId);
      return !(isSender || isReceiver) && !relatedIds.has(Number(item.senderId)) && !relatedIds.has(Number(item.receiverId));
    })
    .slice(0, 5)
    .map((item) => ({
      id: item.id,
      name: `Suggested connection ${item.id}`,
      reason: "Shared industry or location interest",
      targetId: item.senderId,
    }));

  return suggestions;
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
