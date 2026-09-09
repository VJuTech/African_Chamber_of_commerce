const express = require("express");
const { ensureAuthenticated } = require("../controllers/accountController");
const { requirePermission, requireRole } = require("../middleware/rbacMiddleware");
const rbacController = require("../controllers/rbacController");

const router = express.Router();

router.get(
  "/admin/access-control",
  ensureAuthenticated,
  requireRole("platform_admin", "super_admin", "admin"),
  requirePermission("users.read"),
  rbacController.accessControlPage
);

router.post(
  "/admin/access-control/roles",
  ensureAuthenticated,
  requireRole("platform_admin", "super_admin", "admin"),
  requirePermission("users.manage"),
  rbacController.assignRole
);

module.exports = router;
