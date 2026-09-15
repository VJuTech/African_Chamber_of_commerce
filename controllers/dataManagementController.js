const dataManagementModel = require("../models/dataManagementModel");

function currentUser(req) {
  return req.session && req.session.user ? req.session.user : null;
}

function redirect(res, message) {
  return res.redirect(`/admin/data-management?message=${encodeURIComponent(message)}`);
}

function parseSnapshot(value) {
  try {
    const snapshot = JSON.parse(value || "{}");
    if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) throw new Error("Snapshot must be a JSON object.");
    return snapshot;
  } catch (error) {
    const validationError = new Error(`Snapshot must be valid JSON object data: ${error.message}`);
    validationError.status = 400;
    throw validationError;
  }
}

async function page(req, res, next) {
  try {
    return res.render("admin/data-management", {
      title: "Data management",
      user: currentUser(req),
      ...await dataManagementModel.getDashboard(),
      message: req.query.message || "",
      error: req.query.error || "",
    });
  } catch (error) { return next(error); }
}

async function integrity(req, res, next) {
  try {
    await dataManagementModel.runIntegrityChecks(currentUser(req).id);
    return redirect(res, "Integrity checks completed and persisted.");
  } catch (error) { return next(error); }
}

async function backup(req, res, next) {
  try {
    await dataManagementModel.requestBackup(currentUser(req).id, req.body);
    return redirect(res, "Backup request recorded for operations.");
  } catch (error) { return next(error); }
}

async function recovery(req, res, next) {
  try {
    await dataManagementModel.requestRecovery(currentUser(req).id, req.body);
    return redirect(res, "Recovery request submitted for approval.");
  } catch (error) { return next(error); }
}

async function recoveryStatus(req, res, next) {
  try {
    await dataManagementModel.updateRecoveryStatus(currentUser(req).id, req.params.id, req.body.status, req.body.notes);
    return redirect(res, "Recovery request status updated.");
  } catch (error) { return next(error); }
}

async function archive(req, res, next) {
  try {
    await dataManagementModel.archiveRecord(currentUser(req).id, req.body.resourceKey, req.body.recordId, parseSnapshot(req.body.snapshot), req.body.reason);
    return redirect(res, "Record archive evidence persisted.");
  } catch (error) { return next(error); }
}

async function archiveStatus(req, res, next) {
  try {
    await dataManagementModel.updateArchiveStatus(currentUser(req).id, req.params.id, req.body.status);
    return redirect(res, `Archive marked ${req.body.status}.`);
  } catch (error) { return next(error); }
}

async function version(req, res, next) {
  try {
    await dataManagementModel.recordVersion(currentUser(req).id, req.body.resourceKey, req.body.recordId, req.body.changeType, parseSnapshot(req.body.snapshot));
    return redirect(res, "Data version recorded.");
  } catch (error) { return next(error); }
}

module.exports = { page, integrity, backup, recovery, recoveryStatus, archive, archiveStatus, version };