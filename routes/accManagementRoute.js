const express = require("express");
const { ensureAuthenticated } = require("../controllers/accountController");
const { requirePermission, requireRole } = require("../middleware/rbacMiddleware");
const controller = require("../controllers/accManagementController");

const router = express.Router();
const managementAccess = [
  ensureAuthenticated,
  requireRole("acc_management_admin", "super_admin"),
  requirePermission("users.read"),
  requirePermission("requirements.read"),
  requirePermission("platform_overview.read"),
];

router.get("/admin/dashboard", ...managementAccess, controller.managementDashboard);

module.exports = router;
