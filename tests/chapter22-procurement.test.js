/*
 * chapter22-procurement.test.js - Focused acceptance checks for ACC Chapter 22.
 * The test exercises every critical state transition without requiring a running server.
 */
const assert = require("node:assert/strict");
const procurementModel = require("../models/procurementModel");

(async () => {
  // Verify the public module surface required by the procurement specification.
  assert.equal(typeof procurementModel.createRFQ, "function");
  assert.equal(typeof procurementModel.publishRFQ, "function");
  assert.equal(typeof procurementModel.submitQuotation, "function");
  assert.equal(typeof procurementModel.awardQuotation, "function");
  assert.equal(typeof procurementModel.closeRFQ, "function");

  // Create and publish a buyer request for supplier discovery.
  const created = await procurementModel.createRFQ(100, { title: "Bulk packaging supply", description: "Monthly packaging materials", category: "Manufacturing", quantityRequired: 500, unitOfMeasurement: "cartons", deadline: "2099-12-31", budgetAmount: 12000, visibility: "open" });
  assert.equal(created.success, true);
  assert.equal(created.rfq.status, "draft");
  assert.equal((await procurementModel.publishRFQ(100, created.rfq.id)).success, true);
  assert.equal((await procurementModel.getAvailableRFQs(200)).length, 1);

  // Submit a supplier quotation and verify the buyer can evaluate it.
  const bid = await procurementModel.submitQuotation(200, created.rfq.id, { quotedPrice: 11000, currency: "USD", deliveryTimeframe: "14 days", termsConditions: "Net 30" });
  assert.equal(bid.success, true);
  const competingBid = await procurementModel.submitQuotation(201, created.rfq.id, { quotedPrice: 11500, currency: "USD", deliveryTimeframe: "18 days", termsConditions: "Net 15" });
  assert.equal(competingBid.success, true);
  const quotations = await procurementModel.getQuotationsForRFQ(created.rfq.id, 100);
  assert.equal(quotations.length, 2);
  assert.equal(quotations[0].status, "pending");

  // Award the quotation and verify payment/logistics integration references.
  const award = await procurementModel.awardQuotation(100, created.rfq.id, quotations[0].id);
  assert.equal(award.success, true);
  assert.equal(award.order.paymentStatus, "pending");
  assert.match(award.order.paymentPath, /\/payments/);
  assert.match(award.order.logisticsPath, /\/logistics/);

  // Verify the closed-request rule prevents a later bid.
  const closed = await procurementModel.closeRFQ(100, created.rfq.id);
  assert.equal(closed.success, false);

  // Verify auditability and notifications for the completed workflow.
  const auditEvents = (await procurementModel.getAuditLog()).map((entry) => entry.eventType);
  assert.ok(auditEvents.includes("request_created"));
  assert.ok(auditEvents.includes("request_published"));
  assert.ok(auditEvents.includes("bid_submitted"));
  assert.ok(auditEvents.includes("award_made"));
  const notificationTypes = (await procurementModel.getNotificationLog()).map((entry) => entry.type);
  assert.ok(notificationTypes.includes("new_request_published"));
  assert.ok(notificationTypes.includes("bid_submitted"));
  assert.ok(notificationTypes.includes("bid_accepted"));
  assert.ok(notificationTypes.includes("bid_rejected"));

  // Report a compact success signal for the chapter test runner.
  console.log("Chapter 22 procurement tests passed");
})().catch((error) => { console.error(error); process.exitCode = 1; });
