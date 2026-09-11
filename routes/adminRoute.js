const express = require("express");
const { ensureAuthenticated } = require("../controllers/accountController");
const { requirePermission } = require("../middleware/rbacMiddleware");
const adminController = require("../controllers/adminController");

const router = express.Router();
const authenticated = [ensureAuthenticated];

router.get("/admin/control-center", ...authenticated, requirePermission("admin.monitoring.read"), adminController.dashboard);
router.get("/admin/users", ...authenticated, requirePermission("admin.users.manage"), adminController.users);
router.post("/admin/users/:id/status", ...authenticated, requirePermission("admin.users.manage"), adminController.userStatus);
router.get("/admin/businesses", ...authenticated, requirePermission("admin.businesses.manage"), adminController.businesses);
router.post("/admin/businesses/:id/action", ...authenticated, requirePermission("admin.businesses.manage"), adminController.businessAction);
router.get("/admin/moderation", ...authenticated, requirePermission("admin.moderation.manage"), adminController.moderation);
router.post("/admin/moderation/:id/action", ...authenticated, requirePermission("admin.moderation.manage"), adminController.moderationAction);
router.get("/admin/settings", ...authenticated, requirePermission("admin.settings.manage"), adminController.settings);
router.post("/admin/settings/:key", ...authenticated, requirePermission("admin.settings.manage"), adminController.settingUpdate);
router.post("/admin/features/:key", ...authenticated, requirePermission("admin.settings.manage"), adminController.featureUpdate);
router.get("/admin/logs", ...authenticated, requirePermission("admin.logs.read"), adminController.logs);
router.get("/admin/reports/:type", ...authenticated, requirePermission("admin.reports.read"), adminController.report);

module.exports = router;
