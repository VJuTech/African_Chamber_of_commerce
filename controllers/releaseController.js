const releaseModel = require("../models/releaseModel");
function currentUser(req) { return req.session && req.session.user ? req.session.user : null; }
function redirect(res, message) { return res.redirect(`/admin/releases?message=${encodeURIComponent(message)}`); }
async function page(req, res, next) { try { return res.render("admin/releases", { title: "Versioning & Release Management", user: currentUser(req), ...await releaseModel.getDashboard(), message: req.query.message || "" }); } catch (error) { return next(error); } }
async function version(req, res, next) { try { const result = await releaseModel.createVersion(currentUser(req).id, req.body); return redirect(res, result.message); } catch (error) { return next(error); } }
async function plan(req, res, next) { try { const result = await releaseModel.createPlan(currentUser(req).id, req.body); return redirect(res, result.message); } catch (error) { return next(error); } }
async function note(req, res, next) { try { const result = await releaseModel.recordNote(currentUser(req).id, req.body); return redirect(res, result.message); } catch (error) { return next(error); } }
async function compatibility(req, res, next) { try { const result = await releaseModel.recordCompatibility(currentUser(req).id, req.body); return redirect(res, result.message); } catch (error) { return next(error); } }
async function deploy(req, res, next) { try { const result = await releaseModel.deploy(currentUser(req).id, req.body); return redirect(res, result.message); } catch (error) { return next(error); } }
async function rollback(req, res, next) { try { const result = await releaseModel.rollback(currentUser(req).id, req.body); return redirect(res, result.message); } catch (error) { return next(error); } }
async function monitor(req, res, next) { try { const result = await releaseModel.monitor(currentUser(req).id, req.body); return redirect(res, result.message); } catch (error) { return next(error); } }
async function feature(req, res, next) { try { const result = await releaseModel.toggleFeature(currentUser(req).id, req.params.key, req.body.enabled === "true"); return redirect(res, result.message); } catch (error) { return next(error); } }
module.exports = { page, version, plan, note, compatibility, deploy, rollback, monitor, feature };
