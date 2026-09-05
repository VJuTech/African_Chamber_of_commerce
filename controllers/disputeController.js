/*
 * disputeController.js - ACC Chapter 24 dispute request handlers.
 * Controllers enforce HTTP access while disputeModel owns case decisions.
 */
const disputeModel = require("../models/disputeModel");
const { getPrivateEvidencePath, removePrivateEvidence } = require("../utility/disputeEvidenceStorage");

// Resolve the authenticated member from the current session.
function currentUserId(req) { return req.session && req.session.user ? req.session.user.id : null; }

// Render the party or moderator dispute dashboard.
async function disputesDashboardPage(req, res, next) { try { const disputes = await disputeModel.getDisputesForUser(currentUserId(req), req.session.user); return res.render("disputes/dashboard", { title: "Dispute resolution", user: req.session.user, disputes, message: req.query.message || "", error: "" }); } catch (error) { return next(error); } }

// Render a linked order/contract dispute creation form.
async function createDisputePage(req, res, next) { try { return res.render("disputes/create", { title: "Raise a dispute", user: req.session.user, orderId: req.query.orderId || "", contractId: req.query.contractId || "", message: req.query.message || "", error: "" }); } catch (error) { return next(error); } }

// Render an authorized case with evidence and moderator controls.
async function disputeDetailPage(req, res, next) { try { const userId = currentUserId(req); const dispute = await disputeModel.getDisputeById(req.params.id, userId, req.session.user); if (!dispute) return res.status(404).render("error/404", { title: "Dispute not found", user: req.session.user }); const evidence = await disputeModel.getEvidence(dispute.id, userId, req.session.user); return res.render("disputes/detail", { title: dispute.reference, user: req.session.user, dispute, evidence, isModerator: disputeModel.isModerator(req.session.user), statuses: disputeModel.disputeStatuses, resolutionTypes: disputeModel.resolutionTypes, message: req.query.message || "", error: "" }); } catch (error) { return next(error); } }

// Create a new open case against an existing order or contract.
async function createDispute(req, res, next) { try { const result = await disputeModel.createDispute(currentUserId(req), req.body); if (!result.success) return res.redirect(`/disputes/create?message=${encodeURIComponent(result.message)}`); return res.redirect(`/disputes/${result.dispute.id}?message=${encodeURIComponent(result.message)}`); } catch (error) { return next(error); } }

// Store private evidence metadata after Multer has validated the uploaded file.
async function submitEvidence(req, res, next) { try { if (!req.file) return res.redirect(`/disputes/${req.params.id}?message=${encodeURIComponent("Select evidence to upload.")}`); const result = await disputeModel.submitEvidence(currentUserId(req), req.params.id, { evidenceType: req.body.evidenceType, fileName: req.file.originalname, storageName: req.file.filename }); if (!result.success) removePrivateEvidence(req.file.filename); return res.redirect(`/disputes/${req.params.id}?message=${encodeURIComponent(result.message)}`); } catch (error) { if (req.file) removePrivateEvidence(req.file.filename); return next(error); } }

// Restrict moderator actions to the explicit role vocabulary in disputeModel.
function ensureModerator(req, res, next) { if (disputeModel.isModerator(req.session && req.session.user)) return next(); return res.status(403).render("error/403", { title: "Moderator access required", user: req.session && req.session.user ? req.session.user : null }); }

// Assign a moderator and begin formal review.
async function assignModerator(req, res, next) { try { const result = await disputeModel.assignModerator(req.session.user, req.params.id, req.body.moderatorId); return res.redirect(`/disputes/${req.params.id}?message=${encodeURIComponent(result.message)}`); } catch (error) { return next(error); } }

// Initiate mediation through the existing messaging dependency boundary.
async function initiateMediation(req, res, next) { try { const result = await disputeModel.initiateMediation(req.session.user, req.params.id); return res.redirect(`/disputes/${req.params.id}?message=${encodeURIComponent(result.message)}`); } catch (error) { return next(error); } }

// Resolve a case and execute a linked refund when selected.
async function resolveDispute(req, res, next) { try { const result = await disputeModel.resolveDispute(req.session.user, req.params.id, req.body.resolutionType, req.body.resolutionDetails); return res.redirect(`/disputes/${req.params.id}?message=${encodeURIComponent(result.message)}`); } catch (error) { return next(error); } }

// Escalate a case for higher review.
async function escalateDispute(req, res, next) { try { const result = await disputeModel.escalateDispute(req.session.user, req.params.id, req.body.reason); return res.redirect(`/disputes/${req.params.id}?message=${encodeURIComponent(result.message)}`); } catch (error) { return next(error); } }

// Close a resolved case without deleting its history.
async function closeDispute(req, res, next) { try { const result = await disputeModel.closeDispute(req.session.user, req.params.id); return res.redirect(`/disputes/${req.params.id}?message=${encodeURIComponent(result.message)}`); } catch (error) { return next(error); } }

// Download evidence only after party or moderator authorization.
async function downloadEvidence(req, res, next) { try { const userId = currentUserId(req); const dispute = await disputeModel.getDisputeById(req.params.id, userId, req.session.user); const records = await disputeModel.getEvidence(req.params.id, userId, req.session.user); const record = records.find((entry) => Number(entry.id) === Number(req.params.evidenceId)); if (!dispute || !record) return res.status(404).render("error/404", { title: "Evidence not found", user: req.session.user }); const stored = disputeModel.evidence.find((entry) => Number(entry.id) === Number(record.id)); const filePath = getPrivateEvidencePath(stored && stored.storageName); if (!filePath) return res.status(404).render("error/404", { title: "Evidence not found", user: req.session.user }); return res.download(filePath, record.fileName); } catch (error) { return next(error); } }

// Export the complete Chapter 24 controller surface.
module.exports = { disputesDashboardPage, createDisputePage, disputeDetailPage, createDispute, submitEvidence, ensureModerator, assignModerator, initiateMediation, resolveDispute, escalateDispute, closeDispute, downloadEvidence };
