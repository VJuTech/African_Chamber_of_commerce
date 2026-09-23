const qaModel = require("../models/qaModel");

function currentUser(req) { return req.session && req.session.user ? req.session.user : null; }
function redirect(res, message) { return res.redirect(`/admin/qa?message=${encodeURIComponent(message)}`); }

async function page(req, res, next) {
  try { return res.render("admin/qa", { title: "Testing & Quality Assurance", user: currentUser(req), ...await qaModel.getDashboard(), message: req.query.message || "" }); } catch (error) { return next(error); }
}
async function plan(req, res, next) { try { await qaModel.createPlan(currentUser(req).id, req.body); return redirect(res, "Test plan created."); } catch (error) { return next(error); } }
async function testCase(req, res, next) { try { await qaModel.createCase(currentUser(req).id, req.body); return redirect(res, "Test case added."); } catch (error) { return next(error); } }
async function run(req, res, next) { try { await qaModel.executeCase(currentUser(req).id, req.body); return redirect(res, "Test execution recorded."); } catch (error) { return next(error); } }
async function bug(req, res, next) { try { await qaModel.createBug(currentUser(req).id, req.body); return redirect(res, "Defect logged."); } catch (error) { return next(error); } }
async function bugStatus(req, res, next) { try { await qaModel.updateBug(currentUser(req).id, req.params.id, req.body); return redirect(res, "Defect workflow updated."); } catch (error) { return next(error); } }
async function report(req, res, next) { try { await qaModel.generateReport(currentUser(req).id, req.body); return redirect(res, "QA report generated."); } catch (error) { return next(error); } }

module.exports = { page, plan, testCase, run, bug, bugStatus, report };
