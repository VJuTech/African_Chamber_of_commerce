/* Chapter 25 authenticated routes for inbox actions, preferences, and live delivery. */
const express = require("express");
const { ensureAuthenticated, ensureVerifiedAccount } = require("../controllers/accountController");
const { notificationsPage, markNotificationRead, updateNotificationPreferences, notificationStream } = require("../controllers/notificationController");

const router = express.Router();

// Render the user notification center in chronological order.
router.get("/notifications", ensureAuthenticated, ensureVerifiedAccount, notificationsPage);
// Stream only the authenticated user's newly generated in-app notifications.
router.get("/notifications/stream", ensureAuthenticated, ensureVerifiedAccount, notificationStream);
// Update read state and notification controls through authenticated POST actions.
router.post("/notifications/:id/read", ensureAuthenticated, ensureVerifiedAccount, markNotificationRead);
router.post("/notifications/preferences", ensureAuthenticated, ensureVerifiedAccount, updateNotificationPreferences);

module.exports = router;
