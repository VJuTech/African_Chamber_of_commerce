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
router.get("/admin/localization", ...authenticated, requirePermission("admin.settings.manage"), adminController.localization);
router.post("/admin/localization/languages/:code", ...authenticated, requirePermission("admin.settings.manage"), adminController.localizationLanguageUpdate);
router.post("/admin/localization/translations", ...authenticated, requirePermission("admin.settings.manage"), adminController.localizationTranslationUpdate);
router.post("/admin/localization/rates", ...authenticated, requirePermission("admin.settings.manage"), adminController.localizationRateUpdate);
router.post("/admin/settings/:key", ...authenticated, requirePermission("admin.settings.manage"), adminController.settingUpdate);
router.post("/admin/features/:key", ...authenticated, requirePermission("admin.settings.manage"), adminController.featureUpdate);
router.get("/admin/logs", ...authenticated, requirePermission("admin.logs.read"), adminController.logs);
router.get("/admin/reports/:type", ...authenticated, requirePermission("admin.reports.read"), adminController.report);

module.exports = router;
