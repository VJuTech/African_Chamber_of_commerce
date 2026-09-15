const express = require("express");
const { ensureAuthenticated } = require("../controllers/accountController");
const { requirePermission } = require("../middleware/rbacMiddleware");
const dataManagementController = require("../controllers/dataManagementController");

const router = express.Router();
const authenticated = [ensureAuthenticated];

router.get("/admin/data-management", ...authenticated, requirePermission("admin.data.read"), dataManagementController.page);
router.post("/admin/data-management/integrity-checks", ...authenticated, requirePermission("admin.data.manage"), dataManagementController.integrity);
router.post("/admin/data-management/backups", ...authenticated, requirePermission("admin.data.manage"), dataManagementController.backup);
router.post("/admin/data-management/recovery", ...authenticated, requirePermission("admin.data.manage"), dataManagementController.recovery);
router.post("/admin/data-management/recovery/:id/status", ...authenticated, requirePermission("admin.data.manage"), dataManagementController.recoveryStatus);
router.post("/admin/data-management/archive", ...authenticated, requirePermission("admin.data.manage"), dataManagementController.archive);
router.post("/admin/data-management/archive/:id/status", ...authenticated, requirePermission("admin.data.manage"), dataManagementController.archiveStatus);
router.post("/admin/data-management/versions", ...authenticated, requirePermission("admin.data.manage"), dataManagementController.version);

module.exports = router;