/* Chapter 25 focused acceptance test for generation, preferences, reads, queueing, retries, and audit events. */
const assert = require("assert/strict");
const notificationModel = require("../models/notificationModel");

// Verify a normal transaction notification is generated and delivered in-app.
const generated = notificationModel.generateNotification({
  userId: 25,
  type: "transaction",
  title: "Order placed",
  message: "Order #25 has been placed.",
  eventKey: "order-25",
});
assert.equal(generated.success, true);
assert.equal(generated.notification.status, "unread");
assert.ok(notificationModel.getNotificationsForUser(25).length >= 1);
assert.ok(notificationModel.getDeliveryQueue().some((delivery) => delivery.notificationId === generated.notification.id));

// Confirm read state is scoped to the notification recipient.
const read = notificationModel.markAsRead(25, generated.notification.id);
assert.equal(read.success, true);
assert.equal(read.notification.status, "read");
assert.equal(notificationModel.markAsRead(26, generated.notification.id).success, false);

// Confirm preferences can disable a category and suppress its generated alert.
notificationModel.savePreferences(26, { enabled: true, channels: ["in_app"], types: ["system"], frequency: "immediate", maxPerHour: 10 });
const suppressed = notificationModel.generateNotification({ userId: 26, type: "social", title: "New message", message: "A message arrived." });
assert.equal(suppressed.success, false);
assert.equal(suppressed.suppressed, true);

// Confirm a supported event fans out to every distinct participant.
const eventResults = notificationModel.generateFromEvent("new_message", { senderId: 30, recipientId: 31, conversationId: 5, text: "Please review the quote." });
assert.equal(eventResults.length, 2);
assert.ok(eventResults.every((result) => result.success));

// Confirm queue processing records successful in-app delivery and audit activity.
notificationModel.processQueue();
assert.ok(notificationModel.getDeliveryQueue().some((delivery) => delivery.notificationId === generated.notification.id && delivery.status === "delivered"));
assert.ok(notificationModel.getAuditLog().some((entry) => entry.eventType === "notification_generated"));
assert.ok(notificationModel.getAuditLog().some((entry) => entry.eventType === "notification_read"));
assert.ok(notificationModel.getAuditLog().some((entry) => entry.eventType === "notification_sent"));

console.log("Chapter 25 notification tests passed");
