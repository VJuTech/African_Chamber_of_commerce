/* subscriptionController.js - HTTP actions for Chapter 20 subscriptions. */
const subscriptionModel = require("../models/subscriptionModel");

// Resolve the authenticated user ID used by all subscription operations.
function currentUserId(req) {
  return req.session && req.session.user ? req.session.user.id : null;
}

// Render the plan catalog and billing dashboard.
async function dashboard(req, res, next) {
  try {
    const userId = currentUserId(req);
    const [plans, data] = await Promise.all([subscriptionModel.getPlans(), subscriptionModel.getDashboard(userId)]);
    return res.render("subscriptions/dashboard", { title: "Subscriptions & Billing", plans, ...data, user: req.session.user, message: req.query.message || "", error: "" });
  } catch (error) {
    return next(error);
  }
}

// Create or replace a subscription only from a server-priced plan key.
async function subscribe(req, res, next) {
  try {
    const result = await subscriptionModel.subscribe(currentUserId(req), String(req.body.planKey || ""), String(req.body.billingCycle || "monthly"), String(req.body.paymentMethod || "card"));
    return res.json({ success: true, message: `${result.plan.display_name} subscription activated.`, data: result });
  } catch (error) {
    return next(error);
  }
}

// Change plan immediately for upgrades or at the next cycle for downgrades.
async function changePlan(req, res, next) {
  try {
    const result = await subscriptionModel.changePlan(currentUserId(req), String(req.body.planKey || ""));
    return res.json({ success: true, message: `Plan change will take effect ${result.effective}.`, data: result });
  } catch (error) {
    return next(error);
  }
}

// Schedule cancellation without removing access before the paid period ends.
async function cancel(req, res, next) {
  try {
    await subscriptionModel.cancel(currentUserId(req));
    return res.json({ success: true, message: "Cancellation scheduled for the end of the current billing period." });
  } catch (error) {
    return next(error);
  }
}

// Run the recurring billing lifecycle for a trusted administrator or scheduler.
async function processRenewals(req, res, next) {
  try {
    const result = await subscriptionModel.processDueSubscriptions(req.body.paymentSuccessful !== false, Number(req.body.maxRetries || 3));
    return res.json({ success: true, message: "Due subscriptions processed.", data: result });
  } catch (error) {
    return next(error);
  }
}

// Export the controller surface used by subscriptionRoute.js.
module.exports = { dashboard, subscribe, changePlan, cancel, processRenewals };