const express = require("express");
const { ensureAuthenticated } = require("../controllers/accountController");
const { requirePermission, requireRole } = require("../middleware/rbacMiddleware");
const systemOverviewController = require("../controllers/systemOverviewController");

const router = express.Router();
const overviewAccess = [ensureAuthenticated, requireRole("acc_management_admin", "super_admin")];

router.get("/admin/system-overview", ...overviewAccess, requirePermission("platform_overview.read"), systemOverviewController.overviewPage);
router.post("/admin/system-overview/integrations/:id", ...overviewAccess, requirePermission("platform_overview.manage"), systemOverviewController.updateIntegration);

module.exports = router;
