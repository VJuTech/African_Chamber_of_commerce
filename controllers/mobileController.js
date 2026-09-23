const mobileModel = require("../models/mobileModel");

async function mobileAccess(req, res, next) {
  try { return res.render("mobile/access", { title: "ACC Mobile", mobileSummary: await mobileModel.getMobileSummary(req.session.user.id), pageScript: "/scripts/mobile.js" }); } catch (error) { return next(error); }
}
function jsonError(res, error) { return res.status(400).json({ success: false, message: error.message || "Mobile request could not be completed." }); }
async function registerDevice(req, res) { try { return res.json({ success: true, device: await mobileModel.registerDevice(req.session.user.id, { ...req.body, userAgent: req.get("user-agent") }) }); } catch (error) { return jsonError(res, error); } }
async function savePushSubscription(req, res) { try { return res.json({ success: true, subscription: await mobileModel.savePushSubscription(req.session.user.id, req.body.deviceId, req.body.subscription) }); } catch (error) { return jsonError(res, error); } }
async function queueAction(req, res) { try { return res.json({ success: true, action: await mobileModel.queueAction(req.session.user.id, req.body) }); } catch (error) { return jsonError(res, error); } }
async function syncActions(req, res) { try { return res.json({ success: true, synced: await mobileModel.syncActions(req.session.user.id, req.body.deviceId) }); } catch (error) { return jsonError(res, error); } }
async function recordLocation(req, res) { try { return res.json({ success: true, location: await mobileModel.recordLocation(req.session.user.id, req.body) }); } catch (error) { return jsonError(res, error); } }
async function uploadDocument(req, res) { try { if (!req.file) return res.status(400).json({ success: false, message: "Select an image or PDF document." }); return res.status(201).json({ success: true, upload: await mobileModel.recordUpload(req.session.user.id, req.body.deviceId, req.file) }); } catch (error) { return jsonError(res, error); } }
function securityCapabilities(_req, res) { return res.json({ success: true, transport: "session-cookie", webAuthn: true, serverStorage: "postgresql", sensitiveDataPolicy: "No credentials are stored in browser storage." }); }
module.exports = { mobileAccess, registerDevice, savePushSubscription, queueAction, syncActions, recordLocation, uploadDocument, securityCapabilities };
