const aiModel = require("../models/aiModel");
const notificationModel = require("../models/notificationModel");

function currentUser(req) { return req.session && req.session.user ? req.session.user : null; }
function redirect(res, message, path = "/ai") { return res.redirect(`${path}?message=${encodeURIComponent(message)}`); }

async function dashboard(req, res, next) {
  try {
    const user = currentUser(req);
    const [consent, recommendationData, insights] = await Promise.all([
      aiModel.getConsent(user.id),
      aiModel.getRecommendations(user.id),
      aiModel.getUserInsights(user.id),
    ]);
    return res.render("ai/dashboard", { title: "ACC Intelligence", user, consent, ...recommendationData, insights, query: "", searchResults: null, message: req.query.message || "", error: "" });
  } catch (error) { return next(error); }
}

async function search(req, res, next) {
  try { return res.json({ success: true, ...(await aiModel.smartSearch(currentUser(req).id, req.query.q || req.body.q, req.query.limit || req.body.limit)) }); } catch (error) { return next(error); }
}

async function searchPage(req, res, next) {
  try {
    const user = currentUser(req);
    const [consent, recommendationData, insights, searchResults] = await Promise.all([aiModel.getConsent(user.id), aiModel.getRecommendations(user.id), aiModel.getUserInsights(user.id), aiModel.smartSearch(user.id, req.query.q || "")]);
    return res.render("ai/dashboard", { title: "ACC Intelligence", user, consent, ...recommendationData, insights, query: searchResults.query, searchResults, message: req.query.message || "", error: "" });
  } catch (error) { return next(error); }
}

async function feedback(req, res, next) { try { const result = await aiModel.giveRecommendationFeedback(currentUser(req).id, req.params.id, req.body.feedback); return res.json(result); } catch (error) { return next(error); } }
async function interaction(req, res, next) { try { return res.status(201).json(await aiModel.recordInteraction(currentUser(req).id, req.body)); } catch (error) { return next(error); } }
async function consent(req, res, next) { try { await aiModel.saveConsent(currentUser(req).id, req.body); return redirect(res, "AI privacy preferences updated."); } catch (error) { return next(error); } }
async function prediction(req, res, next) { try { const result = await aiModel.createPrediction(currentUser(req).id, req.body); return redirect(res, `Prediction generated with ${result.confidence}% confidence.`); } catch (error) { return next(error); } }

async function adminPage(req, res, next) { try { return res.render("admin/ai", { title: "AI Intelligence Control Room", user: currentUser(req), ...await aiModel.getAdminDashboard(), message: req.query.message || "" }); } catch (error) { return next(error); } }
async function fraudStatus(req, res, next) { try { await aiModel.updateFraudCase(currentUser(req).id, req.params.id, req.body.status, req.body.resolutionNote); return redirect(res, "Fraud case updated.", "/admin/ai"); } catch (error) { return next(error); } }
async function alertStatus(req, res, next) { try { await aiModel.updateAlert(currentUser(req).id, req.params.id, req.body.status); return redirect(res, "AI alert updated.", "/admin/ai"); } catch (error) { return next(error); } }
async function evaluateFraud(req, res, next) { try { const result = await aiModel.evaluateFraud(req.body, currentUser(req).id); if (result.flagged && result.userId) await notificationModel.generateNotification({ userId: result.userId, type: "system", priority: "high", title: "Security review needed", message: "ACC detected activity requiring a security review.", link: "/notifications", eventKey: "ai_fraud_alert", dedupeKey: `ai-fraud:${result.caseId}` }); return res.status(201).json(result); } catch (error) { return next(error); } }

module.exports = { dashboard, search, searchPage, feedback, interaction, consent, prediction, adminPage, fraudStatus, alertStatus, evaluateFraud };
