const express = require("express");
const { ensureAuthenticated } = require("../controllers/accountController");
const { requirePermission } = require("../middleware/rbacMiddleware");
const analyticsController = require("../controllers/analyticsController");

const router = express.Router();
const authenticated = [ensureAuthenticated];

router.get("/analytics", ...authenticated, requirePermission("analytics.business.read"), analyticsController.dashboard);
router.get("/admin/analytics", ...authenticated, requirePermission("analytics.global.read"), analyticsController.dashboard);
router.get("/analytics/data", ...authenticated, requirePermission("analytics.business.read"), analyticsController.data);
router.get("/admin/analytics/data", ...authenticated, requirePermission("analytics.global.read"), analyticsController.data);
router.post("/analytics/events", ...authenticated, requirePermission("analytics.business.read"), analyticsController.event);
router.get("/analytics/reports/:type", ...authenticated, requirePermission("analytics.reports.export"), analyticsController.report);
router.get("/admin/analytics/reports/:type", ...authenticated, requirePermission("analytics.reports.export"), analyticsController.report);

module.exports = router;
