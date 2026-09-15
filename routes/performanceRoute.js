const express = require("express");
const { ensureAuthenticated } = require("../controllers/accountController");
const { requirePermission, requireRole } = require("../middleware/rbacMiddleware");
const controller = require("../controllers/performanceController");

const router = express.Router();
const access = [ensureAuthenticated, requireRole("acc_management_admin", "platform_admin", "system_admin", "super_admin")];

router.get("/admin/performance", ...access, requirePermission("admin.performance.read"), controller.page);
router.post("/admin/performance/profiles/:environmentKey", ...access, requirePermission("admin.performance.manage"), controller.profile);
router.post("/admin/performance/peak-load", ...access, requirePermission("admin.performance.manage"), controller.peakLoad);
router.post("/admin/performance/optimizations", ...access, requirePermission("admin.performance.manage"), controller.optimization);

module.exports = router;
