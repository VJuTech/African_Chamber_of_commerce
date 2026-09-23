const partnershipModel = require("../models/partnershipModel");

function currentUser(req) { return req.session && req.session.user ? req.session.user : null; }
function redirect(res, message, secret = "") { const suffix = secret ? `&secret=${encodeURIComponent(secret)}` : ""; return res.redirect(`/admin/partnerships?message=${encodeURIComponent(message)}${suffix}`); }

async function page(req, res, next) {
  try { return res.render("admin/partnerships", { title: "Third-party partnerships", user: currentUser(req), ...await partnershipModel.getDashboard(), message: req.query.message || "", newlyIssuedSecret: req.query.secret || "", partnerTypes: partnershipModel.partnerTypes, integrationTypes: partnershipModel.integrationTypes, serviceAreas: partnershipModel.serviceAreas, accessScopes: partnershipModel.accessScopes }); } catch (error) { return next(error); }
}
async function register(req, res, next) { try { const result = await partnershipModel.createPartner(currentUser(req).id, req.body); return redirect(res, result.message); } catch (error) { return next(error); } }
async function status(req, res, next) { try { await partnershipModel.updatePartnerStatus(currentUser(req).id, req.params.id, req.body.status); return redirect(res, "Partner status updated and audited."); } catch (error) { return next(error); } }
async function integration(req, res, next) { try { const result = await partnershipModel.createIntegration(currentUser(req).id, req.body); return redirect(res, result.message); } catch (error) { return next(error); } }
async function credential(req, res, next) { try { const result = await partnershipModel.issueCredential(currentUser(req).id, req.body.partnerId, req.body.scopes); return redirect(res, "Partner credential issued. Copy it now; it cannot be retrieved later.", result.secret); } catch (error) { return next(error); } }
async function grant(req, res, next) { try { await partnershipModel.grantAccess(currentUser(req).id, req.body.partnerId, req.body.scope); return redirect(res, "Partner access scope granted."); } catch (error) { return next(error); } }
async function partnerProfile(req, res, next) { try { return res.json(await partnershipModel.getPartnerProfile(req.partner.partnerId)); } catch (error) { return next(error); } }
async function partnerExchange(req, res, next) { try { const result = await partnershipModel.recordExchange({ partnerId: req.partner.partnerId, actorUserId: null, direction: "inbound", eventType: req.body.eventType, externalReference: req.body.externalReference, payload: req.body.payload, metadata: { credentialId: req.partner.credentialId, source: "partner_api" } }); return res.status(202).json({ accepted: true, exchange: result }); } catch (error) { return next(error); } }

module.exports = { page, register, status, integration, credential, grant, partnerProfile, partnerExchange };
