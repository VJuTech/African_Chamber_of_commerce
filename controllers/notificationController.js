/* Chapter 25 HTTP handlers for the notification inbox, read state, preferences, and live stream. */
const notificationModel = require("../models/notificationModel");

// Render the chronological notification inbox and current delivery policy.
function notificationsPage(req, res, next) {
  try {
    const userId = req.session.user.id;
    return res.render("notifications/index", {
      title: "Notifications",
      user: req.session.user,
      notifications: notificationModel.getNotificationsForUser(userId),
      preferences: notificationModel.getPreferences(userId),
      message: req.query.message || "",
      error: "",
      pageScript: "/scripts/notifications.js",
    });
  } catch (error) {
    return next(error);
  }
}

// Mark a notification as read and return to the inbox with a clear outcome.
function markNotificationRead(req, res, next) {
  try {
    const result = notificationModel.markAsRead(req.session.user.id, req.params.id);
    return res.redirect(`/notifications?message=${encodeURIComponent(result.message || "Notification marked as read.")}`);
  } catch (error) {
    return next(error);
  }
}

// Persist channel, type, enablement, and frequency preferences from the settings form.
function updateNotificationPreferences(req, res, next) {
  try {
    const channels = Array.isArray(req.body.channels) ? req.body.channels : req.body.channels ? [req.body.channels] : [];
    const types = Array.isArray(req.body.types) ? req.body.types : req.body.types ? [req.body.types] : [];
    notificationModel.savePreferences(req.session.user.id, {
      enabled: req.body.enabled === "true",
      channels,
      types,
      frequency: req.body.frequency,
      maxPerHour: req.body.maxPerHour,
    });
    return res.redirect("/notifications?message=" + encodeURIComponent("Notification preferences saved."));
  } catch (error) {
    return next(error);
  }
}

// Keep an authenticated Server-Sent Events connection for instant in-app alerts.
function notificationStream(req, res) {
  const userId = req.session.user.id;
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
  res.write(`event: ready\ndata: ${JSON.stringify({ connected: true })}\n\n`);
  const unsubscribe = notificationModel.subscribe(userId, (notification) => {
    res.write(`event: notification\ndata: ${JSON.stringify(notification)}\n\n`);
  });
  const heartbeat = setInterval(() => res.write(": heartbeat\n\n"), 25 * 1000);
  req.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
    res.end();
  });
}

module.exports = { notificationsPage, markNotificationRead, updateNotificationPreferences, notificationStream };
