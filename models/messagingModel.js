const pool = require("../database/connection");
const notificationModel = require("./notificationModel");

async function logMessagingAudit(eventType, details = {}) {
  const result = await pool.query("INSERT INTO messaging_audit_logs (event_type, user_id, details) VALUES ($1, $2, $3) RETURNING id, event_type, details, created_at", [eventType, details.userId || details.senderId || null, details]);
  const row = result.rows[0];
  return { id: String(row.id), eventType: row.event_type, timestamp: new Date(row.created_at).toISOString(), details: row.details || {} };
}

async function logMessagingNotification(type, payload = {}) {
  const result = await pool.query("INSERT INTO messaging_notifications (notification_type, user_id, payload) VALUES ($1, $2, $3) RETURNING id, notification_type, payload, created_at", [type, payload.recipientId || payload.userId || null, payload]);
  const row = result.rows[0];
  await notificationModel.generateFromEvent(type, payload);
  return { id: String(row.id), type: row.notification_type, timestamp: new Date(row.created_at).toISOString(), payload: row.payload || {} };
}

function normalizeMessage(record = {}) {
  return {
    id: Number(record.id),
    conversationId: Number(record.conversation_id),
    senderId: Number(record.sender_id),
    receiverId: Number(record.receiver_id),
    text: record.text || "",
    attachments: Array.isArray(record.attachments) ? record.attachments : [],
    type: record.type || "text",
    status: record.status || "sent",
    createdAt: record.created_at ? new Date(record.created_at).toISOString() : new Date().toISOString(),
    deletedFor: Array.isArray(record.deleted_for) ? record.deleted_for.map(Number) : [],
  };
}

function normalizeConversation(record = {}, lastMessage = null) {
  return {
    id: Number(record.id),
    participantA: Number(record.participant_a),
    participantB: Number(record.participant_b),
    type: record.type || "user_to_user",
    subject: record.subject || "Conversation",
    createdAt: new Date(record.created_at).toISOString(),
    updatedAt: new Date(record.updated_at).toISOString(),
    lastMessage: lastMessage ? normalizeMessage(lastMessage) : null,
  };
}

async function createConversation(participantA, participantB, payload = {}) {
  const sourceId = Number(participantA); const targetId = Number(participantB);
  if (!sourceId || !targetId || sourceId === targetId) return { success: false, message: "A valid conversation participant pair is required." };
  const blocked = await pool.query("SELECT 1 FROM messaging_blocks WHERE (user_id = $1 AND target_id = $2) OR (user_id = $2 AND target_id = $1) LIMIT 1", [sourceId, targetId]);
  if (blocked.rowCount) return { success: false, message: "One or both users are blocked from messaging." };
  const existing = await pool.query("SELECT c.*, $1::integer AS participant_a, $2::integer AS participant_b FROM conversations c JOIN conversation_participants p1 ON p1.conversation_id = c.id JOIN conversation_participants p2 ON p2.conversation_id = c.id WHERE p1.user_id = $1 AND p2.user_id = $2 AND (SELECT COUNT(*) FROM conversation_participants WHERE conversation_id = c.id) = 2 LIMIT 1", [sourceId, targetId]);
  if (existing.rowCount) { const conversation = normalizeConversation(existing.rows[0]); return { success: true, ...conversation, conversation, message: "Conversation already exists." }; }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const created = await client.query("INSERT INTO conversations (type, subject) VALUES ($1, $2) RETURNING *", [payload.type || "user_to_user", payload.subject || "New conversation"]);
    const row = created.rows[0];
    await client.query("INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1, $2), ($1, $3)", [row.id, sourceId, targetId]);
    await client.query("COMMIT");
    row.participant_a = sourceId; row.participant_b = targetId;
    const conversation = normalizeConversation(row);
    await logMessagingAudit("conversation_created", { participantA: sourceId, participantB: targetId, type: row.type, outcome: "success", userId: sourceId });
    await logMessagingNotification("conversation_created", { senderId: sourceId, recipientId: targetId, subject: row.subject });
    return { success: true, ...conversation, conversation, message: "Conversation started successfully." };
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}

async function getConversations(userId) {
  const result = await pool.query(`SELECT c.*, (SELECT user_id FROM conversation_participants WHERE conversation_id = c.id AND user_id <> $1 LIMIT 1) AS participant_a, $1::integer AS participant_b, m.id AS message_id, m.conversation_id AS message_conversation_id, m.sender_id AS message_sender_id, m.receiver_id AS message_receiver_id, m.text AS message_text, m.attachments AS message_attachments, m.type AS message_type, m.status AS message_status, m.created_at AS message_created_at FROM conversations c JOIN conversation_participants cp ON cp.conversation_id = c.id LEFT JOIN LATERAL (SELECT * FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) m ON TRUE WHERE cp.user_id = $1 ORDER BY c.updated_at DESC`, [Number(userId)]);
  return result.rows.map((row) => normalizeConversation(row, row.message_id ? { id: row.message_id, conversation_id: row.message_conversation_id, sender_id: row.message_sender_id, receiver_id: row.message_receiver_id, text: row.message_text, attachments: row.message_attachments, type: row.message_type, status: row.message_status, created_at: row.message_created_at } : null));
}

async function getConversationById(conversationId, userId) {
  const access = await pool.query("SELECT c.*, (SELECT user_id FROM conversation_participants WHERE conversation_id = c.id AND user_id <> $2 LIMIT 1) AS participant_a, $2::integer AS participant_b FROM conversations c JOIN conversation_participants cp ON cp.conversation_id = c.id WHERE c.id = $1 AND cp.user_id = $2", [Number(conversationId), Number(userId)]);
  if (!access.rowCount) return { success: false, message: "Conversation not found." };
  const unread = await pool.query("SELECT COUNT(*)::integer AS count FROM messages WHERE conversation_id = $1 AND receiver_id = $2 AND status <> 'read'", [Number(conversationId), Number(userId)]);
  const messages = await pool.query("SELECT m.*, COALESCE(array_agg(md.user_id) FILTER (WHERE md.user_id IS NOT NULL), '{}') AS deleted_for FROM messages m LEFT JOIN message_deletions md ON md.message_id = m.id WHERE m.conversation_id = $1 AND NOT EXISTS (SELECT 1 FROM message_deletions hidden WHERE hidden.message_id = m.id AND hidden.user_id = $2) GROUP BY m.id ORDER BY m.created_at", [Number(conversationId), Number(userId)]);
  await pool.query("UPDATE messages SET status = 'read' WHERE conversation_id = $1 AND receiver_id = $2 AND status <> 'read'", [Number(conversationId), Number(userId)]);
  const normalized = messages.rows.map(normalizeMessage);
  return { success: true, conversation: normalizeConversation(access.rows[0], normalized[normalized.length - 1] || null), messages: normalized, notificationCount: Number(unread.rows[0].count) };
}

async function sendMessage(senderId, conversationId, payload = {}) {
  const sourceId = Number(senderId); const threadId = Number(conversationId);
  const found = await pool.query("SELECT c.*, (SELECT user_id FROM conversation_participants WHERE conversation_id = c.id AND user_id <> $2 LIMIT 1) AS receiver_id, (SELECT user_id FROM conversation_participants WHERE conversation_id = c.id AND user_id <> $2 LIMIT 1) AS participant_a, $2::integer AS participant_b FROM conversations c JOIN conversation_participants cp ON cp.conversation_id = c.id WHERE c.id = $1 AND cp.user_id = $2", [threadId, sourceId]);
  if (!found.rowCount) return { success: false, message: "Conversation not found." };
  const conversation = found.rows[0]; const receiverId = Number(conversation.receiver_id);
  const blocked = await pool.query("SELECT 1 FROM messaging_blocks WHERE (user_id = $1 AND target_id = $2) OR (user_id = $2 AND target_id = $1) LIMIT 1", [sourceId, receiverId]);
  if (blocked.rowCount) return { success: false, message: "Messaging is blocked between these participants." };
  const text = (payload.text || "").trim(); const attachments = Array.isArray(payload.attachments) ? payload.attachments : [];
  if (!text && !attachments.length) return { success: false, message: "A message or attachment is required." };
  const type = attachments.length || (payload.type && payload.type !== "text") ? "attachment" : "text";
  const created = await pool.query("INSERT INTO messages (conversation_id, sender_id, receiver_id, text, attachments, type, status) VALUES ($1, $2, $3, $4, $5, $6, 'delivered') RETURNING *", [threadId, sourceId, receiverId, text, JSON.stringify(attachments), type]);
  await pool.query("UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1", [threadId]);
  await logMessagingAudit("message_sent", { conversationId: threadId, senderId: sourceId, receiverId, outcome: "success", userId: sourceId });
  await logMessagingNotification("new_message", { conversationId: threadId, senderId: sourceId, recipientId: receiverId, text });
  return { success: true, message: normalizeMessage(created.rows[0]), conversation: normalizeConversation(conversation), notification: { recipientId: receiverId, type: "new_message" } };
}

async function deleteMessage(userId, messageId, mode = "self") {
  const currentUserId = Number(userId); const result = await pool.query("SELECT * FROM messages WHERE id = $1", [Number(messageId)]);
  if (!result.rowCount) return { success: false, message: "Message not found." };
  if (mode === "all") {
    if (Number(result.rows[0].sender_id) !== currentUserId) return { success: false, message: "Only the sender can delete for everyone." };
    await pool.query("UPDATE messages SET status = 'deleted' WHERE id = $1", [Number(messageId)]);
    await logMessagingAudit("message_deleted_for_all", { messageId, userId: currentUserId, outcome: "success" });
    return { success: true, message: "Message deleted for all participants." };
  }
  await pool.query("INSERT INTO message_deletions (message_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [Number(messageId), currentUserId]);
  await logMessagingAudit("message_deleted_for_self", { messageId, userId: currentUserId, outcome: "success" });
  return { success: true, message: "Message deleted for you only." };
}

async function blockMessagingUser(userId, targetId, reason = "") {
  const actorId = Number(userId); const blockedUserId = Number(targetId);
  if (!actorId || !blockedUserId || actorId === blockedUserId) return { success: false, message: "A valid target user is required." };
  const result = await pool.query("INSERT INTO messaging_blocks (user_id, target_id, reason) VALUES ($1, $2, $3) ON CONFLICT (user_id, target_id) DO NOTHING RETURNING *", [actorId, blockedUserId, reason]);
  if (!result.rowCount) return { success: true, message: "This user is already blocked from messaging." };
  const row = result.rows[0];
  await logMessagingAudit("message_blocked", { userId: actorId, targetId: blockedUserId, reason, outcome: "success" });
  return { success: true, block: { id: Number(row.id), userId: Number(row.user_id), targetId: Number(row.target_id), reason: row.reason, createdAt: new Date(row.created_at).toISOString() }, message: "User blocked from messaging." };
}

async function getMessagingAuditLog(limit = 20) { const result = await pool.query("SELECT id, event_type, details, created_at FROM messaging_audit_logs ORDER BY created_at DESC, id DESC LIMIT $1", [Number(limit)]); return result.rows.map((row) => ({ id: String(row.id), eventType: row.event_type, timestamp: new Date(row.created_at).toISOString(), details: row.details || {} })); }
async function getNotifications(userId) { const result = await pool.query("SELECT id, notification_type, payload, created_at FROM messaging_notifications WHERE user_id = $1 OR payload->>'senderId' = $2 ORDER BY created_at DESC LIMIT 8", [Number(userId), String(Number(userId))]); return result.rows.map((row) => ({ id: String(row.id), type: row.notification_type, timestamp: new Date(row.created_at).toISOString(), payload: row.payload || {} })); }

module.exports = {
  createConversation,
  getConversations,
  getConversationById,
  sendMessage,
  deleteMessage,
  blockMessagingUser,
  getMessagingAuditLog,
  getNotifications,
};
