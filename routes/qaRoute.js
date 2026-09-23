const express = require("express");
const { ensureAuthenticated } = require("../controllers/accountController");
const { requirePermission, requireRole } = require("../middleware/rbacMiddleware");
const controller = require("../controllers/qaController");

const router = express.Router();
const access = [ensureAuthenticated, requireRole("platform_admin", "system_admin", "acc_management_admin", "super_admin")];

router.get("/admin/qa", ...access, requirePermission("admin.qa.read"), controller.page);
router.post("/admin/qa/plans", ...access, requirePermission("admin.qa.manage"), controller.plan);
router.post("/admin/qa/cases", ...access, requirePermission("admin.qa.manage"), controller.testCase);
router.post("/admin/qa/runs", ...access, requirePermission("admin.qa.manage"), controller.run);
router.post("/admin/qa/bugs", ...access, requirePermission("admin.qa.manage"), controller.bug);
router.post("/admin/qa/bugs/:id", ...access, requirePermission("admin.qa.manage"), controller.bugStatus);
router.post("/admin/qa/reports", ...access, requirePermission("admin.qa.manage"), controller.report);

module.exports = router;
