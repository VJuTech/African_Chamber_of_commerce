const supportModel = require("../models/supportModel");

function currentUser(req) { return req.session && req.session.user ? req.session.user : null; }
function redirect(res, path, message) { return res.redirect(`${path}?message=${encodeURIComponent(message)}`); }

async function helpCenter(req, res, next) {
  try { const dashboard = await supportModel.getDashboard(); return res.render("support/help-center", { title: "Help center", user: currentUser(req), articles: dashboard.articles, tickets: currentUser(req) ? await supportModel.listUserTickets(currentUser(req).id) : [], message: req.query.message || "" }); } catch (error) { return next(error); }
}

async function reportIssue(req, res, next) {
  try { return res.render("support/report-issue", { title: "Report an issue", user: currentUser(req), message: req.query.message || "", error: "" }); } catch (error) { return next(error); }
}

async function createTicket(req, res, next) {
  try { const result = await supportModel.createTicket(currentUser(req).id, req.body, req.file); return result.success ? redirect(res, "/support", `Ticket ${result.ticket.ticketNumber} submitted successfully.`) : res.status(400).render("support/report-issue", { title: "Report an issue", user: currentUser(req), message: "", error: result.message }); } catch (error) { return next(error); }
}

async function adminPage(req, res, next) {
  try { return res.render("admin/support", { title: "Maintenance & support", user: currentUser(req), ...await supportModel.getDashboard(), message: req.query.message || "" }); } catch (error) { return next(error); }
}

async function updateTicket(req, res, next) {
  try { const result = await supportModel.updateTicket(currentUser(req).id, req.params.id, req.body); return redirect(res, "/admin/support", result.message); } catch (error) { return next(error); }
}

async function scheduleMaintenance(req, res, next) {
  try { const result = await supportModel.createMaintenanceWindow(currentUser(req).id, req.body); return redirect(res, "/admin/support", result.message); } catch (error) { return next(error); }
}

module.exports = { helpCenter, reportIssue, createTicket, adminPage, updateTicket, scheduleMaintenance };
