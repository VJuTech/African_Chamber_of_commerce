/*
 * procurementController.js - ACC Chapter 22 page and workflow handlers.
 * Controllers keep HTTP concerns separate from the procurement domain model.
 */
const procurementModel = require("../models/procurementModel");

// Resolve the authenticated member id used by every procurement action.
function currentUserId(req) {
  return req.session && req.session.user ? req.session.user.id : null;
}

// Render the buyer and supplier procurement workspace.
async function procurementDashboardPage(req, res, next) {
  try {
    const userId = currentUserId(req);
    const [buyerRequests, availableRequests, supplierBids, orders] = await Promise.all([
      procurementModel.getBuyerRFQs(userId),
      procurementModel.getAvailableRFQs(userId),
      procurementModel.getSupplierQuotations(userId),
      procurementModel.getProcurementOrdersForUser(userId),
    ]);
    return res.render("procurement/dashboard", { title: "Procurement & B2B sourcing", user: req.session.user, buyerRequests, availableRequests, supplierBids, orders, message: req.query.message || "", error: "" });
  } catch (error) { return next(error); }
}

// Render the request creation form without mutating any state.
async function createRequestPage(req, res, next) {
  try { return res.render("procurement/create", { title: "Create procurement request", user: req.session.user, visibilityOptions: procurementModel.procurementVisibilities, formData: {}, message: "", error: "" }); } catch (error) { return next(error); }
}

// Render one request and, for its buyer, all submitted quotations.
async function requestDetailPage(req, res, next) {
  try {
    const userId = currentUserId(req);
    const rfq = await procurementModel.getRFQById(req.params.id, userId);
    if (!rfq) return res.status(404).render("error/404", { title: "Procurement request not found", user: req.session.user });
    const isBuyer = Number(rfq.buyerId) === Number(userId);
    const quotations = isBuyer ? await procurementModel.getQuotationsForRFQ(rfq.id, userId) : [];
    return res.render("procurement/detail", { title: rfq.title, user: req.session.user, rfq, quotations, isBuyer, message: req.query.message || "", error: "" });
  } catch (error) { return next(error); }
}

// Create a validated draft request and return the buyer to its detail page.
async function createRequest(req, res, next) {
  try {
    const result = await procurementModel.createRFQ(currentUserId(req), req.body);
    if (!result.success) return res.redirect("/procurement/create?message=" + encodeURIComponent(result.message));
    return res.redirect(`/procurement/${result.rfq.id}?message=${encodeURIComponent(result.message)}`);
  } catch (error) { return next(error); }
}

// Publish a buyer-owned request after its review step.
async function publishRequest(req, res, next) {
  try { const result = await procurementModel.publishRFQ(currentUserId(req), req.params.id); return res.redirect(`/procurement/${req.params.id}?message=${encodeURIComponent(result.message)}`); } catch (error) { return next(error); }
}

// Submit a supplier quotation linked to the selected request.
async function submitBid(req, res, next) {
  try { const result = await procurementModel.submitQuotation(currentUserId(req), req.params.id, req.body); return res.redirect(`/procurement/${req.params.id}?message=${encodeURIComponent(result.message)}`); } catch (error) { return next(error); }
}

// Award a selected quotation and create the fulfillment hand-off record.
async function awardBid(req, res, next) {
  try { const result = await procurementModel.awardQuotation(currentUserId(req), req.params.id, req.body.quotationId); return res.redirect(`/procurement/${req.params.id}?message=${encodeURIComponent(result.message)}`); } catch (error) { return next(error); }
}

// Close a buyer-owned request and stop additional bid submissions.
async function closeRequest(req, res, next) {
  try { const result = await procurementModel.closeRFQ(currentUserId(req), req.params.id); return res.redirect(`/procurement/${req.params.id}?message=${encodeURIComponent(result.message)}`); } catch (error) { return next(error); }
}

// Export route handlers for the Chapter 22 route collection.
module.exports = { procurementDashboardPage, createRequestPage, requestDetailPage, createRequest, publishRequest, submitBid, awardBid, closeRequest };
