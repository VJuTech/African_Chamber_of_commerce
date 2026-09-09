const express = require("express");
const { ensureAuthenticated } = require("../controllers/accountController");
const { requirePermission, requireRole } = require("../middleware/rbacMiddleware");
const requirementsController = require("../controllers/requirementsController");

const router = express.Router();
const adminAccess = [ensureAuthenticated, requireRole("acc_management_admin", "super_admin")];

router.get("/admin/requirements", ...adminAccess, requirePermission("requirements.read"), requirementsController.requirementsPage);
router.get("/admin/requirements/:id", ...adminAccess, requirePermission("requirements.read"), requirementsController.requirementDetailPage);
router.post("/admin/requirements", ...adminAccess, requirePermission("requirements.manage"), requirementsController.createRequirement);
router.post("/admin/requirements/:id/traceability", ...adminAccess, requirePermission("requirements.manage"), requirementsController.updateCoverage);

module.exports = router;
