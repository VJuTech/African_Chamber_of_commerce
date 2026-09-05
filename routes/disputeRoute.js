/*
 * disputeRoute.js - ACC Chapter 24 authenticated dispute routes.
 * Moderator actions are protected by explicit role middleware.
 */
const express = require("express");
const { ensureAuthenticated, ensureVerifiedAccount } = require("../controllers/accountController");
const { disputeEvidenceUpload } = require("../utility/disputeEvidenceStorage");
const { disputesDashboardPage, createDisputePage, disputeDetailPage, createDispute, submitEvidence, ensureModerator, assignModerator, initiateMediation, resolveDispute, escalateDispute, closeDispute, downloadEvidence } = require("../controllers/disputeController");

// Create the isolated route collection for dispute resolution.
const router = express.Router();

// Render authorized case history, creation, detail, and evidence downloads.
router.get("/disputes", ensureAuthenticated, disputesDashboardPage);
router.get("/disputes/create", ensureAuthenticated, ensureVerifiedAccount, createDisputePage);
router.get("/disputes/:id", ensureAuthenticated, disputeDetailPage);
router.get("/disputes/:id/evidence/:evidenceId", ensureAuthenticated, downloadEvidence);

// Create cases and submit evidence as verified transaction parties.
router.post("/disputes/create", ensureAuthenticated, ensureVerifiedAccount, createDispute);
router.post("/disputes/:id/evidence", ensureAuthenticated, ensureVerifiedAccount, disputeEvidenceUpload.single("evidence"), submitEvidence);

// Restrict case review, mediation, resolution, escalation, and closure to moderators.
router.post("/disputes/:id/assign", ensureAuthenticated, ensureVerifiedAccount, ensureModerator, assignModerator);
router.post("/disputes/:id/mediate", ensureAuthenticated, ensureVerifiedAccount, ensureModerator, initiateMediation);
router.post("/disputes/:id/resolve", ensureAuthenticated, ensureVerifiedAccount, ensureModerator, resolveDispute);
router.post("/disputes/:id/escalate", ensureAuthenticated, ensureVerifiedAccount, ensureModerator, escalateDispute);
router.post("/disputes/:id/close", ensureAuthenticated, ensureVerifiedAccount, ensureModerator, closeDispute);

// Export the Chapter 24 route collection for server registration.
module.exports = router;
