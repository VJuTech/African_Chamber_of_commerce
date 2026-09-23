const onboardingModel = require("../models/onboardingModel");
function currentUser(req) { return req.session && req.session.user ? req.session.user : null; }
function redirect(res, message) { return res.redirect(`/admin/onboarding?message=${encodeURIComponent(message)}`); }
async function page(req, res, next) { try { return res.render("admin/onboarding", { title: "Data Migration & Onboarding", user: currentUser(req), ...await onboardingModel.getDashboard(), message: req.query.message || "" }); } catch (error) { return next(error); } }
async function fileImport(req, res, next) { try { if (!req.file) return redirect(res, "Choose a CSV or Excel file."); const result = await onboardingModel.importFile(currentUser(req).id, req.body.importType, req.file); return redirect(res, `Migration ${result.jobKey} finished with ${result.errorRows || 0} errors.`); } catch (error) { return next(error); } }
async function apiSource(req, res, next) { try { const result = await onboardingModel.createApiSource(currentUser(req).id, req.body); return redirect(res, result.message); } catch (error) { return next(error); } }
async function apiImport(req, res, next) { try { const result = await onboardingModel.importApi(currentUser(req).id, req.params.id, Array.isArray(req.body.rows) ? req.body.rows : []); return res.status(202).json(result); } catch (error) { return next(error); } }
async function assistance(req, res, next) { try { const result = await onboardingModel.createAssistance(currentUser(req).id, req.body); return redirect(res, result.message); } catch (error) { return next(error); } }
async function assistanceStatus(req, res, next) { try { const result = await onboardingModel.updateAssistance(currentUser(req).id, req.params.id, req.body); return redirect(res, result.message); } catch (error) { return next(error); } }
module.exports = { page, fileImport, apiSource, apiImport, assistance, assistanceStatus };
