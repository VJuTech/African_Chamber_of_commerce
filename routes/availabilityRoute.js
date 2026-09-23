const express = require("express");
const { ensureAuthenticated } = require("../controllers/accountController");
const { requirePermission, requireRole } = require("../middleware/rbacMiddleware");
const controller = require("../controllers/availabilityController");

const router = express.Router();
const access = [ensureAuthenticated, requireRole("acc_management_admin", "platform_admin", "system_admin", "super_admin")];
router.get("/admin/availability", ...access, requirePermission("admin.availability.read"), controller.page);
router.post("/admin/availability/health-checks", ...access, requirePermission("admin.availability.manage"), controller.runHealthChecks);
router.post("/admin/availability/incidents/:id/resolve", ...access, requirePermission("admin.availability.manage"), controller.resolveIncident);
module.exports = router;
