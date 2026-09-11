const apiModel = require("../models/apiModel");

function currentUser(req) { return req.session && req.session.user ? req.session.user : null; }
function redirectWithMessage(res, message) { return res.redirect(`/admin/api?message=${encodeURIComponent(message)}`); }

async function page(req, res, next) {
  try {
    const [clients, usage, logs, webhooks] = await Promise.all([
      apiModel.listClients(),
      apiModel.getUsageSummary(),
      apiModel.getRequestLogs(),
      apiModel.listWebhooks(),
    ]);
    return res.render("admin/api", {
      title: "API and integrations",
      user: currentUser(req),
      clients,
      usage,
      logs,
      webhooks,
      message: req.query.message || "",
      newlyCreatedKey: req.query.key || "",
      newlyCreatedSecret: req.query.secret || "",
    });
  } catch (error) { return next(error); }
}

async function createClient(req, res, next) {
  try {
    const result = await apiModel.createClient(req.session.user.id, req.body);
    if (!result.success) return redirectWithMessage(res, result.message);
    return res.redirect(`/admin/api?message=${encodeURIComponent("API client created. Copy the key now; it cannot be retrieved later.")}&key=${encodeURIComponent(result.apiKey)}`);
  } catch (error) { return next(error); }
}

async function revokeKey(req, res, next) {
  try { const result = await apiModel.revokeKey(req.session.user.id, req.params.id); return redirectWithMessage(res, result.message); } catch (error) { return next(error); }
}

async function createWebhook(req, res, next) {
  try {
    const result = await apiModel.createWebhook(req.session.user.id, req.body);
    if (!result.success) return redirectWithMessage(res, result.message);
    return res.redirect(`/admin/api?message=${encodeURIComponent("Webhook created. Copy the signing secret now; it cannot be retrieved later.")}&secret=${encodeURIComponent(result.secret)}`);
  } catch (error) { return next(error); }
}

async function revokeWebhook(req, res, next) {
  try { const result = await apiModel.revokeWebhook(req.session.user.id, req.params.id); return redirectWithMessage(res, result.message); } catch (error) { return next(error); }
}

async function retryWebhook(req, res, next) {
  try { const result = await apiModel.retryWebhook(req.params.id); return redirectWithMessage(res, result.message); } catch (error) { return next(error); }
}

module.exports = { page, createClient, revokeKey, createWebhook, revokeWebhook, retryWebhook };
