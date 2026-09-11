const express = require("express");
const { ensureAuthenticated } = require("../controllers/accountController");
const { requirePermission, requireRole } = require("../middleware/rbacMiddleware");
const deploymentController = require("../controllers/deploymentController");

const router = express.Router();
const access = [ensureAuthenticated, requireRole("acc_management_admin", "platform_admin", "system_admin", "super_admin")];

router.get("/admin/deployment", ...access, requirePermission("admin.deployment.read"), deploymentController.page);
router.post("/admin/deployment/environments/:id", ...access, requirePermission("admin.deployment.manage"), deploymentController.updateEnvironment);
router.post("/admin/deployment/releases", ...access, requirePermission("admin.deployment.manage"), deploymentController.createRelease);
router.post("/admin/deployment/backups", ...access, requirePermission("admin.deployment.manage"), deploymentController.createBackup);
router.post("/admin/deployment/alerts/:id", ...access, requirePermission("admin.deployment.manage"), deploymentController.acknowledgeAlert);

module.exports = router;
