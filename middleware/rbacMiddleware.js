const rbacModel = require("../models/rbacModel");

function currentUserId(req) {
  return req.session && req.session.user ? req.session.user.id : null;
}

function deny(req, res, message) {
  if (req.method === "GET" && req.accepts("html")) {
    return res.status(403).render("error/404", {
      title: "Access denied",
      user: req.session && req.session.user ? req.session.user : null,
      message,
    });
  }
  return res.status(403).json({ success: false, message });
}

function requirePermission(permissionKey) {
  return async (req, res, next) => {
    try {
      if (!currentUserId(req)) return deny(req, res, "Please sign in to continue.");
      req.access = await rbacModel.getUserAccessContext(currentUserId(req));
      if (!req.access.permissions.includes(permissionKey) && !req.access.roles.some((role) => role.key === "super_admin")) {
        return deny(req, res, "You do not have permission to perform this action.");
      }
      next();
    } catch (error) {
      return next(error);
    }
  };
}

function requireRole(...requiredRoles) {
  return async (req, res, next) => {
    try {
      if (!currentUserId(req)) return deny(req, res, "Please sign in to continue.");
      req.access = await rbacModel.getUserAccessContext(currentUserId(req));
      const allowedRoles = requiredRoles.map(rbacModel.normalizeRoleKey);
      if (!req.access.roles.some((role) => allowedRoles.includes(role.key))) {
        return deny(req, res, "Your role does not allow access to this page.");
      }
      next();
    } catch (error) {
      return next(error);
    }
  };
}

module.exports = { requirePermission, requireRole };
