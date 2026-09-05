/* subscriptionRoute.js - Chapter 20 subscription and billing endpoints. */
const express = require("express");
const { ensureAuthenticated, ensureVerifiedAccount } = require("../controllers/accountController");
const { isAdmin } = require("../middleware/membershipMiddleware");
const subscriptionController = require("../controllers/subscriptionController");

// Keep all subscription mutations behind the existing account protections.
const router = express.Router();
router.get("/subscriptions", ensureAuthenticated, subscriptionController.dashboard);
router.post("/subscriptions/subscribe", ensureAuthenticated, ensureVerifiedAccount, subscriptionController.subscribe);
router.post("/subscriptions/change-plan", ensureAuthenticated, ensureVerifiedAccount, subscriptionController.changePlan);
router.post("/subscriptions/cancel", ensureAuthenticated, ensureVerifiedAccount, subscriptionController.cancel);
router.post("/subscriptions/process-renewals", ensureAuthenticated, ensureVerifiedAccount, isAdmin, subscriptionController.processRenewals);

// Export the mounted Chapter 20 router.
module.exports = router;