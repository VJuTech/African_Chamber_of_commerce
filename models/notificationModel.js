/* Chapter 25 notification service: generation, delivery queueing, preferences, retries, and audit history. */
const fs = require("fs");
const path = require("path");
const EventEmitter = require("events");

// Keep operational notification state in the existing logs directory for local reliability.
const notificationLogPath = path.join(__dirname, "..", "logs", "notifications.log");
const notificationAuditPath = path.join(__dirname, "..", "logs", "notifications-audit.log");
fs.mkdirSync(path.dirname(notificationLogPath), { recursive: true });

// Expose a process-local event bus for the authenticated real-time stream.
const notificationEvents = new EventEmitter();
const notifications = [];
const deliveryQueue = [];
const preferences = new Map();
const recentEvents = new Map();
const notificationAudit = [];
const supportedChannels = ["in_app", "email", "sms", "push"];
const supportedTypes = ["system", "transaction", "social", "event"];
const defaultPreferences = {
  enabled: true,
  channels: ["in_app", "email", "push"],
  types: ["system", "transaction", "social", "event"],
  frequency: "immediate",
  maxPerHour: 30,
};

// Append an immutable operational record and emit it for connected users.
function writeAudit(eventType, details = {}) {
  const entry = { id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, eventType, details, createdAt: new Date().toISOString() };
  notificationAudit.push(entry);
  fs.appendFileSync(notificationAuditPath, `${JSON.stringify(entry)}\n`);
  return entry;
}

// Normalize preferences so every delivery decision has an explicit policy.
function normalizePreferences(input = {}) {
  const channels = Array.isArray(input.channels) ? input.channels.filter((channel) => supportedChannels.includes(channel)) : defaultPreferences.channels;
  const types = Array.isArray(input.types) ? input.types.filter((type) => supportedTypes.includes(type)) : defaultPreferences.types;
  return {
    ...defaultPreferences,
    ...input,
    enabled: input.enabled !== false,
    channels: channels.length ? channels : ["in_app"],
    types: types.length ? types : [],
    frequency: ["immediate", "daily"].includes(input.frequency) ? input.frequency : defaultPreferences.frequency,
    maxPerHour: Math.max(1, Math.min(100, Number(input.maxPerHour) || defaultPreferences.maxPerHour)),
  };
}

// Return a copy so callers cannot mutate the service policy accidentally.
function getPreferences(userId) {
  return { ...normalizePreferences(preferences.get(Number(userId))) };
}

// Save a validated policy and audit the change.
function savePreferences(userId, input = {}) {
  const normalized = normalizePreferences(input);
  preferences.set(Number(userId), normalized);
  writeAudit("preferences_updated", { userId: Number(userId), preferences: normalized });
  return normalized;
}

// Prevent bursts by grouping identical events and enforcing a per-user hourly limit.
function isRateLimited(userId, type, dedupeKey) {
  const now = Date.now();
  const recent = recentEvents.get(Number(userId)) || [];
  const active = recent.filter((timestamp) => now - timestamp < 60 * 60 * 1000);
  const policy = getPreferences(userId);
  recentEvents.set(Number(userId), active);
  if (active.length >= policy.maxPerHour) return true;
  if (dedupeKey && notifications.some((item) => item.userId === Number(userId) && item.dedupeKey === dedupeKey && now - new Date(item.createdAt).getTime() < 15 * 60 * 1000)) return true;
  active.push(now);
  return false;
}

// Enqueue one channel delivery and retain attempts for reliable retry processing.
function enqueueDelivery(notification, channel) {
  const delivery = { id: `${notification.id}:${channel}`, notificationId: notification.id, channel, status: "queued", attempts: 0, nextAttemptAt: new Date().toISOString() };
  deliveryQueue.push(delivery);
  writeAudit("delivery_queued", { notificationId: notification.id, channel });
  return delivery;
}

// Generate an in-app notification and queue all configured channel deliveries.
function generateNotification(payload = {}) {
  const userId = Number(payload.userId || payload.recipientId);
  const type = supportedTypes.includes(payload.type) ? payload.type : "system";
  if (!userId || !payload.title || !payload.message) return { success: false, message: "A recipient, title, and message are required." };
  const policy = getPreferences(userId);
  const dedupeKey = payload.dedupeKey || `${type}:${payload.eventKey || payload.title}`;
  if (!policy.enabled || !policy.types.includes(type) || isRateLimited(userId, type, dedupeKey)) return { success: false, suppressed: true, message: "Notification suppressed by user preferences or spam controls." };

  const notification = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    userId,
    type,
    priority: payload.priority || "normal",
    title: String(payload.title).trim(),
    message: String(payload.message).trim(),
    link: payload.link || "/notifications",
    status: "unread",
    dedupeKey,
    createdAt: new Date().toISOString(),
  };
  notifications.push(notification);
  writeAudit("notification_generated", { notificationId: notification.id, userId, type });
  policy.channels.forEach((channel) => enqueueDelivery(notification, channel));
  notificationEvents.emit(`user:${userId}`, notification);
  return { success: true, notification };
}

// Translate existing module events into consistent user-facing notifications.
function generateFromEvent(eventName, payload = {}) {
  const recipients = [...new Set([payload.userId, payload.recipientId, payload.senderId, payload.buyerId, payload.sellerId].map(Number).filter(Boolean))];
  const definitions = {
    order_placed: { type: "transaction", title: "Order placed", message: `Order #${payload.orderId || ""} has been placed.` },
    payment_completed: { type: "transaction", title: "Payment completed", message: `Payment for order #${payload.orderId || ""} was completed.` },
    new_message: { type: "social", title: "New message", message: payload.text || "You received a new message." },
    event_registration: { type: "event", title: "Event registration confirmed", message: `${payload.title || "An event"} registration was recorded.` },
    event_reminder: { type: "event", title: "Event reminder", message: `${payload.title || "Your event"} is coming up.` },
  };
  const definition = definitions[eventName] || { type: "system", title: "ACC update", message: `There is a new ${eventName.replace(/_/g, " ")} update.` };
  return recipients.map((userId) => generateNotification({ ...definition, userId, eventKey: eventName, dedupeKey: `${eventName}:${payload.orderId || payload.eventId || payload.conversationId || userId}`, priority: eventName === "payment_completed" ? "high" : "normal" }));
}

// List the newest notifications first and optionally limit the result for header summaries.
function getNotificationsForUser(userId, limit = 50) {
  return notifications.filter((item) => item.userId === Number(userId)).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, Number(limit));
}

// Mark one notification as read only when it belongs to the authenticated recipient.
function markAsRead(userId, notificationId) {
  const notification = notifications.find((item) => item.id === String(notificationId) && item.userId === Number(userId));
  if (!notification) return { success: false, message: "Notification not found." };
  notification.status = "read";
  notification.readAt = new Date().toISOString();
  writeAudit("notification_read", { notificationId: notification.id, userId: Number(userId) });
  return { success: true, notification };
}

// Process queued deliveries without losing failed records; failed items receive bounded retries.
function processQueue() {
  const now = Date.now();
  deliveryQueue.forEach((delivery) => {
    if (delivery.status === "delivered" || new Date(delivery.nextAttemptAt).getTime() > now) return;
    delivery.attempts += 1;
    const notification = notifications.find((item) => item.id === delivery.notificationId);
    delivery.status = delivery.channel === "in_app" ? "delivered" : "queued";
    if (delivery.status === "delivered") writeAudit("notification_sent", { notificationId: delivery.notificationId, channel: delivery.channel });
    if (delivery.status !== "delivered" && delivery.attempts >= 3) {
      delivery.status = "failed";
      writeAudit("delivery_failure", { notificationId: delivery.notificationId, channel: delivery.channel, attempts: delivery.attempts });
    } else if (delivery.status !== "delivered") {
      delivery.nextAttemptAt = new Date(now + delivery.attempts * 60 * 1000).toISOString();
      writeAudit("delivery_retry_scheduled", { notificationId: delivery.notificationId, channel: delivery.channel, attempts: delivery.attempts });
    }
    if (notification && delivery.status === "delivered") notification.status = "delivered";
  });
  return deliveryQueue;
}

// Expose queue and audit snapshots for administrator diagnostics and focused tests.
function getDeliveryQueue() { return deliveryQueue.map((item) => ({ ...item })); }
function getAuditLog() { return notificationAudit.map((item) => ({ ...item })); }
function subscribe(userId, handler) { const eventName = `user:${Number(userId)}`; notificationEvents.on(eventName, handler); return () => notificationEvents.off(eventName, handler); }

// Process local queued work regularly while the application is running.
const queueTimer = setInterval(processQueue, 30 * 1000);
if (queueTimer.unref) queueTimer.unref();

module.exports = { supportedChannels, supportedTypes, generateNotification, generateFromEvent, getNotificationsForUser, markAsRead, getPreferences, savePreferences, processQueue, getDeliveryQueue, getAuditLog, subscribe };
