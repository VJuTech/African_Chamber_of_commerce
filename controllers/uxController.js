const uxModel = require("../models/uxModel");

function currentUser(req) {
  return req.session && req.session.user ? req.session.user : null;
}

function redirectWithMessage(req, res, message, error = "") {
  const params = new URLSearchParams();
  if (message) params.set("message", message);
  if (error) params.set("error", error);
  const referrer = req.get("Referrer") || "/workspace";
  let target = "/workspace";
  try {
    const parsed = new URL(referrer, `${req.protocol}://${req.get("host")}`);
    target = parsed.origin === `${req.protocol}://${req.get("host")}` ? `${parsed.pathname}${parsed.search}` : "/workspace";
  } catch (error) {
    target = "/workspace";
  }
  return res.redirect(`${target}${params.toString() ? (target.includes("?") ? "&" : "?") + params.toString() : ""}`);
}

async function loadUserUx(req, res, next) {
  res.locals.uxPreferences = { ...uxModel.defaultPreferences };
  try {
    const user = currentUser(req);
    res.locals.uxPreferences = user ? await uxModel.getPreferences(user.id) : uxModel.defaultPreferences;
    return next();
  } catch (error) {
    return next(error);
  }
}

function settingsPage(req, res) {
  const user = currentUser(req);
  const managementRoles = [
    "acc_management_admin",
    "system_admin",
    "platform_admin",
    "super_admin",
  ];

  return res.render("settings", {
    title: "Settings",
    user,
    hasManagementSettings: Array.isArray(user && user.roles)
      && user.roles.some((role) => managementRoles.includes(role)),
  });
}

async function updatePreferences(req, res, next) {
  try {
    const user = currentUser(req);
    const preferences = await uxModel.savePreferences(user.id, {
      highContrast: req.body.highContrast === "on",
      reducedMotion: req.body.reducedMotion === "on",
    });
    res.locals.uxPreferences = preferences;
    return redirectWithMessage(req, res, "Accessibility preferences updated.");
  } catch (error) {
    return next(error);
  }
}

async function completeOnboarding(req, res, next) {
  try {
    const user = currentUser(req);
    await uxModel.savePreferences(user.id, { onboardingCompleted: true, onboardingStep: 4 });
    return res.redirect("/workspace?message=Welcome+to+your+ACC+workspace.");
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  loadUserUx,
  settingsPage,
  updatePreferences,
  completeOnboarding,
};
