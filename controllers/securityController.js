const securityModel = require("../models/securityModel");
const rbacModel = require("../models/rbacModel");

function context(req) {
  return { ipAddress: req.ip, userAgent: req.get("user-agent") || "" };
}

function currentUser(req) {
  return req.session && req.session.user ? req.session.user : null;
}

async function completeAuthenticatedSession(req, user, rememberMe) {
  const access = await rbacModel.getUserAccessContext(user.id);
  req.session.authenticated = true;
  req.session.userId = user.id;
  req.session.user = {
    ...user,
    roles: access.roles.map((role) => role.key),
    permissions: access.permissions,
  };
  req.session.sessionMeta = {
    userId: user.id,
    userAgent: req.get("user-agent") || "",
    ipAddress: req.ip,
    loginAt: new Date().toISOString(),
    lastActivityAt: new Date().toISOString(),
  };
  req.session.cookie.maxAge = rememberMe ? 1000 * 60 * 60 * 24 * 7 : 1000 * 60 * 30;
  delete req.session.mfaPending;
}

async function renderChallenge(req, res, next) {
  try {
    const pending = req.session && req.session.mfaPending;
    if (!pending) return res.redirect("/login?message=Please sign in to continue.");
    return res.render("accounts/mfa-challenge", {
      title: "Verify sign-in",
      user: pending.user,
      method: pending.user ? "your registered MFA method" : "your account",
      error: req.query.error || "",
      message: req.query.message || "A verification code was sent to your registered contact.",
    });
  } catch (error) { return next(error); }
}

async function submitChallenge(req, res, next) {
  try {
    const pending = req.session && req.session.mfaPending;
    if (!pending) return res.redirect("/login?message=Your sign-in challenge has expired.");
    const result = await securityModel.verifyMfaChallenge(pending.user.id, pending.challengeToken, req.body.code, context(req));
    if (!result.success) return res.redirect(`/mfa/challenge?error=${encodeURIComponent(result.message)}`);
    await completeAuthenticatedSession(req, pending.user, pending.rememberMe);
    const isManagementAdmin = req.session.user.roles.includes("acc_management_admin");
    return req.session.save(() => res.redirect(isManagementAdmin ? "/admin/dashboard" : "/dashboard"));
  } catch (error) { return next(error); }
}

async function securitySettings(req, res, next) {
  try {
    const user = currentUser(req);
    const [methods, alerts] = await Promise.all([
      securityModel.listMfaMethods(user.id),
      securityModel.listAlerts(user.id),
    ]);
    return res.render("security/settings", { title: "Security settings", user, methods, alerts, message: req.query.message || "", error: req.query.error || "" });
  } catch (error) { return next(error); }
}

async function enrollMfa(req, res, next) {
  try {
    const user = currentUser(req);
    const result = await securityModel.enrollMfaMethod(user.id, req.body.methodType, req.body.destination, context(req));
    if (!result.success) return res.redirect(`/security/settings?error=${encodeURIComponent(result.message)}`);
    req.session.mfaEnrollment = { token: result.challenge.token, method: result.method.methodType };
    return res.redirect("/security/mfa/verify");
  } catch (error) { return next(error); }
}

async function renderEnrollment(req, res, next) {
  try {
    if (!req.session.mfaEnrollment) return res.redirect("/security/settings");
    return res.render("security/mfa-verify", { title: "Confirm MFA", user: currentUser(req), error: req.query.error || "", message: req.query.message || "Enter the verification code to enable MFA." });
  } catch (error) { return next(error); }
}

async function confirmEnrollment(req, res, next) {
  try {
    const enrollment = req.session.mfaEnrollment;
    if (!enrollment) return res.redirect("/security/settings");
    const result = await securityModel.confirmMfaEnrollment(currentUser(req).id, enrollment.token, req.body.code, context(req));
    if (!result.success) return res.redirect(`/security/mfa/verify?error=${encodeURIComponent(result.message)}`);
    delete req.session.mfaEnrollment;
    return req.session.save(() => res.redirect("/security/settings?message=MFA has been enabled."));
  } catch (error) { return next(error); }
}

async function disableMfa(req, res, next) {
  try {
    await securityModel.disableMfa(currentUser(req).id, context(req));
    return res.redirect("/security/settings?message=MFA has been disabled.");
  } catch (error) { return next(error); }
}

async function adminSecurity(req, res, next) {
  try {
    return res.render("admin/security", { title: "Security monitoring", user: currentUser(req), search: req.query.search || "", ...(await securityModel.getAdminOverview(req.query)) });
  } catch (error) { return next(error); }
}

module.exports = { renderChallenge, submitChallenge, securitySettings, enrollMfa, renderEnrollment, confirmEnrollment, disableMfa, adminSecurity };
