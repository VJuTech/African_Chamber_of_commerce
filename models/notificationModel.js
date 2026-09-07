/* Chapter 25 notification service. PostgreSQL is the source of truth. */
const EventEmitter = require("events");
const pool = require("../database/connection");

const notificationEvents = new EventEmitter();
const supportedChannels = ["in_app", "email", "sms", "push"];
const supportedTypes = ["system", "transaction", "social", "event"];
const defaultPreferences = { enabled: true, channels: ["in_app", "email", "push"], types: supportedTypes, frequency: "immediate", maxPerHour: 30 };

function normalizePreferences(input = {}) {
  const channels = Array.isArray(input.channels) ? input.channels.filter((channel) => supportedChannels.includes(channel)) : defaultPreferences.channels;
  const types = Array.isArray(input.types) ? input.types.filter((type) => supportedTypes.includes(type)) : defaultPreferences.types;
  return { ...defaultPreferences, ...input, enabled: input.enabled !== false, channels: channels.length ? channels : ["in_app"], types: types.length ? types : [], frequency: ["immediate", "daily"].includes(input.frequency) ? input.frequency : defaultPreferences.frequency, maxPerHour: Math.max(1, Math.min(100, Number(input.maxPerHour) || defaultPreferences.maxPerHour)) };
}

function mapNotification(row) {
  if (!row) return null;
  return { id: String(row.id), userId: Number(row.user_id), type: row.notification_type, priority: row.priority, title: row.title, message: row.message, link: row.link, status: row.status, dedupeKey: row.dedupe_key, createdAt: new Date(row.created_at).toISOString(), ...(row.read_at ? { readAt: new Date(row.read_at).toISOString() } : {}) };
}

async function writeAudit(eventType, details = {}, notificationId = null, userId = null, channel = null, client = pool) {
  const result = await client.query(`INSERT INTO notification_audit_logs (notification_id, user_id, event_type, channel, details) VALUES ($1, $2, $3, $4, $5) RETURNING id, event_type, details, created_at`, [notificationId, userId, eventType, channel, details]);
  const row = result.rows[0];
  return { id: String(row.id), eventType: row.event_type, details: row.details || {}, createdAt: new Date(row.created_at).toISOString() };
}

async function getPreferences(userId) {
  const result = await pool.query("SELECT enabled, channels, notification_types, frequency, max_per_hour FROM notification_preferences WHERE user_id = $1", [Number(userId)]);
  const row = result.rows[0];
  return normalizePreferences(row ? { enabled: row.enabled, channels: row.channels, types: row.notification_types, frequency: row.frequency, maxPerHour: row.max_per_hour } : {});
}

async function savePreferences(userId, input = {}) {
  const normalized = normalizePreferences(input);
  await pool.query(`INSERT INTO notification_preferences (user_id, enabled, channels, notification_types, frequency, max_per_hour, updated_at) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP) ON CONFLICT (user_id) DO UPDATE SET enabled = EXCLUDED.enabled, channels = EXCLUDED.channels, notification_types = EXCLUDED.notification_types, frequency = EXCLUDED.frequency, max_per_hour = EXCLUDED.max_per_hour, updated_at = CURRENT_TIMESTAMP`, [Number(userId), normalized.enabled, JSON.stringify(normalized.channels), JSON.stringify(normalized.types), normalized.frequency, normalized.maxPerHour]);
  await writeAudit("preferences_updated", { userId: Number(userId), preferences: normalized }, null, Number(userId));
  return normalized;
}

async function isRateLimited(userId, dedupeKey, policy, client = pool) {
  const result = await client.query("SELECT COUNT(*)::integer AS count FROM notifications WHERE user_id = $1 AND created_at >= CURRENT_TIMESTAMP - INTERVAL '1 hour'", [Number(userId)]);
  if (Number(result.rows[0].count) >= policy.maxPerHour) return true;
  if (!dedupeKey) return false;
  const duplicate = await client.query("SELECT 1 FROM notifications WHERE user_id = $1 AND dedupe_key = $2 AND created_at >= CURRENT_TIMESTAMP - INTERVAL '15 minutes' LIMIT 1", [Number(userId), dedupeKey]);
  return duplicate.rowCount > 0;
}

async function generateNotification(payload = {}) {
  const userId = Number(payload.userId || payload.recipientId);
  const type = supportedTypes.includes(payload.type) ? payload.type : "system";
  if (!userId || !payload.title || !payload.message) return { success: false, message: "A recipient, title, and message are required." };
  const policy = await getPreferences(userId);
  const dedupeKey = payload.dedupeKey || `${type}:${payload.eventKey || payload.title}`;
  if (!policy.enabled || !policy.types.includes(type) || await isRateLimited(userId, dedupeKey, policy)) return { success: false, suppressed: true, message: "Notification suppressed by user preferences or spam controls." };
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query("INSERT INTO notifications (user_id, notification_type, priority, title, message, link, status, dedupe_key) VALUES ($1, $2, $3, $4, $5, $6, 'unread', $7) RETURNING *", [userId, type, payload.priority || "normal", String(payload.title).trim(), String(payload.message).trim(), payload.link || "/notifications", dedupeKey]);
    const notification = mapNotification(result.rows[0]);
    for (const channel of policy.channels) {
      await client.query("INSERT INTO notification_deliveries (notification_id, channel) VALUES ($1, $2) ON CONFLICT DO NOTHING", [notification.id, channel]);
      await writeAudit("delivery_queued", { notificationId: notification.id, channel }, notification.id, userId, channel, client);
    }
    await writeAudit("notification_generated", { notificationId: notification.id, userId, type }, notification.id, userId, null, client);
    await client.query("COMMIT");
    notificationEvents.emit(`user:${userId}`, notification);
    return { success: true, notification };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function generateFromEvent(eventName, payload = {}) {
  const recipients = [...new Set([payload.userId, payload.recipientId, payload.senderId, payload.buyerId, payload.sellerId].map(Number).filter(Boolean))];
  const definitions = { order_placed: { type: "transaction", title: "Order placed", message: `Order #${payload.orderId || ""} has been placed.` }, payment_completed: { type: "transaction", title: "Payment completed", message: `Payment for order #${payload.orderId || ""} was completed.` }, new_message: { type: "social", title: "New message", message: payload.text || "You received a new message." }, event_registration: { type: "event", title: "Event registration confirmed", message: `${payload.title || "An event"} registration was recorded.` }, event_reminder: { type: "event", title: "Event reminder", message: `${payload.title || "Your event"} is coming up.` } };
  const definition = definitions[eventName] || { type: "system", title: "ACC update", message: `There is a new ${eventName.replace(/_/g, " ")} update.` };
  return Promise.all(recipients.map((userId) => generateNotification({ ...definition, userId, eventKey: eventName, dedupeKey: `${eventName}:${payload.orderId || payload.eventId || payload.conversationId || userId}`, priority: eventName === "payment_completed" ? "high" : "normal" })));
}

async function getNotificationsForUser(userId, limit = 50) { const result = await pool.query("SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2", [Number(userId), Number(limit)]); return result.rows.map(mapNotification); }

async function markAsRead(userId, notificationId) {
  const result = await pool.query("UPDATE notifications SET status = 'read', read_at = CURRENT_TIMESTAMP WHERE id = $1 AND user_id = $2 RETURNING *", [notificationId, Number(userId)]);
  if (!result.rowCount) return { success: false, message: "Notification not found." };
  const notification = mapNotification(result.rows[0]);
  await writeAudit("notification_read", { notificationId: notification.id, userId: Number(userId) }, notification.id, Number(userId));
  return { success: true, notification };
}

async function processQueue() {
  const result = await pool.query("SELECT * FROM notification_deliveries WHERE status IN ('queued', 'retry') AND next_attempt_at <= CURRENT_TIMESTAMP ORDER BY id");
  for (const delivery of result.rows) {
    const attempts = Number(delivery.attempts) + 1;
    if (delivery.channel === "in_app") {
      await pool.query("UPDATE notification_deliveries SET status = 'delivered', attempts = $1, delivered_at = CURRENT_TIMESTAMP WHERE id = $2", [attempts, delivery.id]);
      await pool.query("UPDATE notifications SET status = CASE WHEN status = 'unread' THEN 'delivered' ELSE status END WHERE id = $1", [delivery.notification_id]);
      await writeAudit("notification_sent", { notificationId: String(delivery.notification_id), channel: delivery.channel }, delivery.notification_id, null, delivery.channel);
    } else if (attempts >= 3) {
      await pool.query("UPDATE notification_deliveries SET status = 'failed', attempts = $1 WHERE id = $2", [attempts, delivery.id]);
      await writeAudit("delivery_failure", { notificationId: String(delivery.notification_id), channel: delivery.channel, attempts }, delivery.notification_id, null, delivery.channel);
    } else {
      await pool.query("UPDATE notification_deliveries SET status = 'retry', attempts = $1, next_attempt_at = CURRENT_TIMESTAMP + ($2 * INTERVAL '1 minute') WHERE id = $3", [attempts, attempts, delivery.id]);
      await writeAudit("delivery_retry_scheduled", { notificationId: String(delivery.notification_id), channel: delivery.channel, attempts }, delivery.notification_id, null, delivery.channel);
    }
  }
  return getDeliveryQueue();
}

async function getDeliveryQueue() { const result = await pool.query("SELECT id, notification_id, channel, status, attempts, next_attempt_at FROM notification_deliveries ORDER BY id"); return result.rows.map((row) => ({ id: String(row.id), notificationId: String(row.notification_id), channel: row.channel, status: row.status, attempts: Number(row.attempts), nextAttemptAt: new Date(row.next_attempt_at).toISOString() })); }
async function getAuditLog() { const result = await pool.query("SELECT id, event_type, details, created_at FROM notification_audit_logs ORDER BY created_at DESC, id DESC"); return result.rows.map((row) => ({ id: String(row.id), eventType: row.event_type, details: row.details || {}, createdAt: new Date(row.created_at).toISOString() })); }
function subscribe(userId, handler) { const eventName = `user:${Number(userId)}`; notificationEvents.on(eventName, handler); return () => notificationEvents.off(eventName, handler); }

const queueTimer = setInterval(() => { processQueue().catch((error) => console.error("Notification queue processing failed:", error.message)); }, 30 * 1000);
if (queueTimer.unref) queueTimer.unref();

module.exports = { supportedChannels, supportedTypes, generateNotification, generateFromEvent, getNotificationsForUser, markAsRead, getPreferences, savePreferences, processQueue, getDeliveryQueue, getAuditLog, subscribe };
