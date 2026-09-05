/*
 * chapter24-disputes.test.js - Acceptance checks for ACC Chapter 24.
 * Covers raising, evidence, moderation, mediation, resolution, escalation, and closure.
 */
const assert = require("node:assert/strict");
const disputeModel = require("../models/disputeModel");

(async () => {
  // Verify the required public dispute service surface.
  assert.equal(typeof disputeModel.createDispute, "function");
  assert.equal(typeof disputeModel.submitEvidence, "function");
  assert.equal(typeof disputeModel.assignModerator, "function");
  assert.equal(typeof disputeModel.initiateMediation, "function");
  assert.equal(typeof disputeModel.resolveDispute, "function");
  assert.equal(typeof disputeModel.escalateDispute, "function");

  // Raise a case against the existing sample order and notify its opposing party.
  const created = await disputeModel.createDispute(10, { orderId: 1, issueDescription: "The delivered order requires review." });
  assert.equal(created.success, true);
  assert.equal(created.dispute.status, "open");
  assert.deepEqual(created.dispute.partyIds, [10, 2]);

  // Submit secure evidence metadata as a participating party.
  const evidence = await disputeModel.submitEvidence(10, created.dispute.id, { evidenceType: "document", fileName: "delivery-proof.pdf", storageName: "private-evidence.pdf" });
  assert.equal(evidence.success, true);
  assert.ok(evidence.evidence.checksum);

  // Review, mediate, resolve, and close the dispute as a platform moderator.
  const moderator = { id: 999, role: "admin" };
  assert.equal((await disputeModel.assignModerator(moderator, created.dispute.id, moderator.id)).success, true);
  assert.equal((await disputeModel.initiateMediation(moderator, created.dispute.id)).dispute.status, "in_mediation");
  assert.equal((await disputeModel.resolveDispute(moderator, created.dispute.id, "no_action", "Evidence reviewed.")).dispute.status, "resolved");
  assert.equal((await disputeModel.closeDispute(moderator, created.dispute.id)).dispute.status, "closed");

  // Verify escalation is available for an unresolved second case.
  const second = await disputeModel.createDispute(2, { orderId: 1, issueDescription: "Supplier requests a separate review." });
  assert.equal((await disputeModel.assignModerator(moderator, second.dispute.id, moderator.id)).success, true);
  assert.equal((await disputeModel.escalateDispute(moderator, second.dispute.id, "Requires compliance review.")).dispute.status, "escalated");

  // Verify mandatory audit and notification events were recorded.
  const audits = (await disputeModel.getAuditLog()).map((entry) => entry.eventType);
  assert.ok(audits.includes("dispute_created"));
  assert.ok(audits.includes("evidence_submitted"));
  assert.ok(audits.includes("resolution_executed"));
  const notifications = (await disputeModel.getNotificationLog()).map((entry) => entry.type);
  assert.ok(notifications.includes("dispute_raised"));
  assert.ok(notifications.includes("evidence_submitted"));
  assert.ok(notifications.includes("status_updated"));

  // Report a compact success signal for the chapter test runner.
  console.log("Chapter 24 dispute tests passed");
})().catch((error) => { console.error(error); process.exitCode = 1; });
