/*
 * procurementRoute.js - ACC Chapter 22 authenticated procurement routes.
 * Every state-changing route requires an authenticated and verified member.
 */
const express = require("express");
const { ensureAuthenticated, ensureVerifiedAccount } = require("../controllers/accountController");
const { procurementDashboardPage, createRequestPage, requestDetailPage, createRequest, publishRequest, submitBid, awardBid, closeRequest } = require("../controllers/procurementController");

// Create the isolated route collection for buyer and supplier sourcing workflows.
const router = express.Router();

// Show requests, bids, and awarded procurement orders for the current member.
router.get("/procurement", ensureAuthenticated, procurementDashboardPage);
router.get("/procurement/create", ensureAuthenticated, ensureVerifiedAccount, createRequestPage);
router.get("/procurement/:id", ensureAuthenticated, requestDetailPage);

// Persist and transition procurement requests through their controlled lifecycle.
router.post("/procurement/create", ensureAuthenticated, ensureVerifiedAccount, createRequest);
router.post("/procurement/:id/publish", ensureAuthenticated, ensureVerifiedAccount, publishRequest);
router.post("/procurement/:id/bids", ensureAuthenticated, ensureVerifiedAccount, submitBid);
router.post("/procurement/:id/award", ensureAuthenticated, ensureVerifiedAccount, awardBid);
router.post("/procurement/:id/close", ensureAuthenticated, ensureVerifiedAccount, closeRequest);

// Export the Chapter 22 route collection for server registration.
module.exports = router;
