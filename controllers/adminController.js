const adminModel = require("../models/adminModel");
const localizationModel = require("../models/localizationModel");

function requestMeta(req) {
  return { ip: req.ip, userAgent: req.get("user-agent") };
}

function user(req) { return req.session && req.session.user ? req.session.user : null; }
function redirectWithMessage(res, path, message) { return res.redirect(`${path}?message=${encodeURIComponent(message)}`); }

async function dashboard(req, res, next) {
  try { return res.render("admin/control-center", { title: "ACC Control Center", user: user(req), ...(await adminModel.getDashboard()), message: req.query.message || "" }); } catch (error) { return next(error); }
}
async function users(req, res, next) {
  try { return res.render("admin/users", { title: "Manage users", user: user(req), users: await adminModel.listUsers(req.query.search), search: req.query.search || "", message: req.query.message || "" }); } catch (error) { return next(error); }
}
async function userStatus(req, res, next) {
  try { await adminModel.updateUserStatus(req.session.user.id, req.params.id, req.body.status, requestMeta(req)); return redirectWithMessage(res, "/admin/users", "User status updated."); } catch (error) { return next(error); }
}
async function businesses(req, res, next) {
  try { return res.render("admin/businesses", { title: "Manage businesses", user: user(req), businesses: await adminModel.listBusinesses(req.query.search), search: req.query.search || "", message: req.query.message || "" }); } catch (error) { return next(error); }
}
async function businessAction(req, res, next) {
  try { await adminModel.updateBusiness(req.session.user.id, req.params.id, req.body.action, req.body.notes, requestMeta(req)); return redirectWithMessage(res, "/admin/businesses", "Business status updated."); } catch (error) { return next(error); }
}
async function moderation(req, res, next) {
  try { return res.render("admin/moderation", { title: "Content moderation", user: user(req), reports: await adminModel.listModeration(), message: req.query.message || "" }); } catch (error) { return next(error); }
}
async function moderationAction(req, res, next) {
  try { await adminModel.moderate(req.session.user.id, req.params.id, req.body.action, requestMeta(req)); return redirectWithMessage(res, "/admin/moderation", "Moderation action recorded."); } catch (error) { return next(error); }
}
async function settings(req, res, next) {
  try { return res.render("admin/settings", { title: "System settings", user: user(req), ...(await adminModel.getSettings()), message: req.query.message || "" }); } catch (error) { return next(error); }
}
async function localization(req, res, next) {
  try { return res.render("admin/localization", { title: "Localization management", user: user(req), ...(await localizationModel.getAdminData()), message: req.query.message || "" }); } catch (error) { return next(error); }
}
async function localizationLanguageUpdate(req, res, next) {
  try { await localizationModel.updateLanguage(req.session.user.id, req.params.code, req.body.enabled === "true", requestMeta(req)); return redirectWithMessage(res, "/admin/localization", "Language availability updated."); } catch (error) { return next(error); }
}
async function localizationTranslationUpdate(req, res, next) {
  try { await localizationModel.upsertTranslation(req.session.user.id, req.body.locale, req.body.translationKey, req.body.translationValue, req.body.context, requestMeta(req)); return redirectWithMessage(res, "/admin/localization", "Translation saved."); } catch (error) { return next(error); }
}
async function localizationRateUpdate(req, res, next) {
  try { await localizationModel.upsertExchangeRate(req.session.user.id, req.body.baseCurrency, req.body.targetCurrency, req.body.rate, req.body.source, requestMeta(req)); return redirectWithMessage(res, "/admin/localization", "Exchange rate recorded."); } catch (error) { return next(error); }
}
async function settingUpdate(req, res, next) {
  try { await adminModel.updateSetting(req.session.user.id, req.params.key, JSON.parse(req.body.value), requestMeta(req)); return redirectWithMessage(res, "/admin/settings", "System setting updated."); } catch (error) { return next(error); }
}
async function featureUpdate(req, res, next) {
  try { await adminModel.updateFeature(req.session.user.id, req.params.key, req.body.enabled === "true", requestMeta(req)); return redirectWithMessage(res, "/admin/settings", "Feature availability updated."); } catch (error) { return next(error); }
}
async function logs(req, res, next) {
  try { return res.render("admin/logs", { title: "System logs", user: user(req), logs: await adminModel.listLogs(req.query.search), search: req.query.search || "" }); } catch (error) { return next(error); }
}
async function report(req, res, next) {
  try {
    const rows = await adminModel.getReport(req.params.type);
    if (String(req.query.format).toLowerCase() === "csv") {
      const keys = rows.length ? Object.keys(rows[0]) : [];
      const csv = [keys.join(","), ...rows.map((row) => keys.map((key) => JSON.stringify(row[key] == null ? "" : row[key])).join(","))].join("\n");
      res.type("text/csv").attachment(`${req.params.type}-report.csv`);
      return res.send(csv);
    }
    return res.render("admin/reports", { title: "Reports", user: user(req), reportType: req.params.type, rows, message: "" });
  } catch (error) { return next(error); }
}

module.exports = { dashboard, users, userStatus, businesses, businessAction, moderation, moderationAction, settings, localization, localizationLanguageUpdate, localizationTranslationUpdate, localizationRateUpdate, settingUpdate, featureUpdate, logs, report };
