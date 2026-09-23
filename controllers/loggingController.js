const loggingModel = require("../models/loggingModel");

function currentUser(req) { return req.session && req.session.user ? req.session.user : null; }
function redirect(res, message) { return res.redirect(`/admin/logging?message=${encodeURIComponent(message)}`); }

async function page(req, res, next) {
  try { const severity = req.query.severity || ""; return res.render("admin/logging", { title: "Logging & diagnostics", user: currentUser(req), ...await loggingModel.getDashboard({ severity }), severity, message: req.query.message || "" }); } catch (error) { return next(error); }
}

async function acknowledgeAlert(req, res, next) {
  try { const result = await loggingModel.acknowledgeAlert(currentUser(req).id, req.params.id, req.body.status); return redirect(res, result.message); } catch (error) { return next(error); }
}

module.exports = { page, acknowledgeAlert };
