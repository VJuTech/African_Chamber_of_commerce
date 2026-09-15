const performanceModel = require("../models/performanceModel");

function currentUser(req) { return req.session && req.session.user ? req.session.user : null; }
function redirect(res, message) { return res.redirect(`/admin/performance?message=${encodeURIComponent(message)}`); }

async function page(req, res, next) {
  try { return res.render("admin/performance", { title: "Performance & scalability", user: currentUser(req), ...await performanceModel.getDashboard(), message: req.query.message || "" }); } catch (error) { return next(error); }
}

async function profile(req, res, next) {
  try { await performanceModel.updateProfile(currentUser(req).id, req.params.environmentKey, req.body); return redirect(res, "Capacity profile updated."); } catch (error) { return next(error); }
}

async function peakLoad(req, res, next) {
  try { await performanceModel.runPeakLoadCheck(currentUser(req).id, req.body.environmentKey, req.body.requestedConcurrency); return redirect(res, "Peak-load check recorded."); } catch (error) { return next(error); }
}

async function optimization(req, res, next) {
  try { await performanceModel.createOptimization(currentUser(req).id, req.body); return redirect(res, "Optimization action recorded."); } catch (error) { return next(error); }
}

module.exports = { page, profile, peakLoad, optimization };
