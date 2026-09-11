const { performance } = require("perf_hooks");
const deploymentModel = require("../models/deploymentModel");

function currentUser(req) { return req.session && req.session.user ? req.session.user : null; }
function redirect(res, message) { return res.redirect(`/admin/deployment?message=${encodeURIComponent(message)}`); }

async function page(req, res, next) {
  try {
    const startedAt = performance.now();
    const metricPromise = deploymentModel.recordMetric(process.env.DEPLOYMENT_ENV || "development", startedAt).catch((error) => console.error("Deployment metric capture failed:", error.message));
    const dashboard = await deploymentModel.getDashboard();
    await metricPromise;
    return res.render("admin/deployment", { title: "Deployment & infrastructure", user: currentUser(req), ...dashboard, message: req.query.message || "", error: "" });
  } catch (error) { return next(error); }
}

async function updateEnvironment(req, res, next) {
  try { const result = await deploymentModel.updateEnvironment(currentUser(req).id, req.params.id, req.body); return redirect(res, result.message); } catch (error) { return next(error); }
}

async function createRelease(req, res, next) {
  try { const result = await deploymentModel.createRelease(currentUser(req).id, req.body); return redirect(res, result.message); } catch (error) { return next(error); }
}

async function createBackup(req, res, next) {
  try { const result = await deploymentModel.createBackup(currentUser(req).id, req.body); return redirect(res, result.message); } catch (error) { return next(error); }
}

async function acknowledgeAlert(req, res, next) {
  try { const result = await deploymentModel.acknowledgeAlert(currentUser(req).id, req.params.id, req.body.status); return redirect(res, result.message); } catch (error) { return next(error); }
}

module.exports = { page, updateEnvironment, createRelease, createBackup, acknowledgeAlert };
