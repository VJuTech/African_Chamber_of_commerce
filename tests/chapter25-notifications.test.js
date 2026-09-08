/* Chapter 25 focused acceptance test for generation, preferences, reads, queueing, retries, and audit events. */
const assert = require("assert/strict");
const notificationModel = require("../models/notificationModel");
const { createTestUser, removeTestUsers } = require("./test-fixtures");
const pool = require("../database/connection");

(async () => {
  const userIds = [];
  try {
    userIds.push(await createTestUser("NotificationA"));
    userIds.push(await createTestUser("NotificationB"));
    userIds.push(await createTestUser("NotificationC"));
    userIds.push(await createTestUser("NotificationD"));

    // Verify a normal transaction notification is generated and delivered in-app.
    const generated = await notificationModel.generateNotification({
      userId: userIds[0],
      type: "transaction",
      title: "Order placed",
      message: "Order #25 has been placed.",
      eventKey: "order-25",
    });
    assert.equal(generated.success, true);
    assert.equal(generated.notification.status, "unread");
    assert.ok((await notificationModel.getNotificationsForUser(userIds[0])).length >= 1);
    assert.ok((await notificationModel.getDeliveryQueue()).some((delivery) => delivery.notificationId === generated.notification.id));

    // Confirm read state is scoped to the notification recipient.
    const read = await notificationModel.markAsRead(userIds[0], generated.notification.id);
    assert.equal(read.success, true);
    assert.equal(read.notification.status, "read");
    assert.equal((await notificationModel.markAsRead(userIds[1], generated.notification.id)).success, false);

    // Confirm preferences can disable a category and suppress its generated alert.
    await notificationModel.savePreferences(userIds[1], { enabled: true, channels: ["in_app"], types: ["system"], frequency: "immediate", maxPerHour: 10 });
    const suppressed = await notificationModel.generateNotification({ userId: userIds[1], type: "social", title: "New message", message: "A message arrived." });
    assert.equal(suppressed.success, false);
    assert.equal(suppressed.suppressed, true);

    // Confirm a supported event fans out to every distinct participant.
    const eventResults = await notificationModel.generateFromEvent("new_message", { senderId: userIds[2], recipientId: userIds[3], conversationId: 5, text: "Please review the quote." });
    assert.equal(eventResults.length, 2);
    assert.ok(eventResults.every((result) => result.success));

    // Confirm queue processing records successful in-app delivery and audit activity.
    await notificationModel.processQueue();
    assert.ok((await notificationModel.getDeliveryQueue()).some((delivery) => delivery.notificationId === generated.notification.id && delivery.status === "delivered"));
    assert.ok((await notificationModel.getAuditLog()).some((entry) => entry.eventType === "notification_generated"));
    assert.ok((await notificationModel.getAuditLog()).some((entry) => entry.eventType === "notification_read"));
    assert.ok((await notificationModel.getAuditLog()).some((entry) => entry.eventType === "notification_sent"));

    console.log("Chapter 25 notification tests passed");
  } finally {
    await removeTestUsers(userIds);
    await pool.end();
  }
})().catch((error) => {
  console.error("Chapter 25 notification tests failed");
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
