const availabilityModel = require("../models/availabilityModel");

function currentUser(req) { return req.session && req.session.user ? req.session.user : null; }
function redirect(res, message) { return res.redirect(`/admin/availability?message=${encodeURIComponent(message)}`); }

async function page(req, res, next) {
  try { return res.render("admin/availability", { title: "Availability & reliability", user: currentUser(req), ...await availabilityModel.getDashboard(), message: req.query.message || "", error: "" }); } catch (error) { return next(error); }
}
async function runHealthChecks(req, res, next) {
  try { await availabilityModel.runHealthChecks(currentUser(req).id); return redirect(res, "Health checks completed and persisted."); } catch (error) { return next(error); }
}
async function resolveIncident(req, res, next) {
  try { const result = await availabilityModel.resolveIncident(currentUser(req).id, req.params.id); return redirect(res, result.message); } catch (error) { return next(error); }
}

module.exports = { page, runHealthChecks, resolveIncident };
