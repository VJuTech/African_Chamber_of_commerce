const express = require("express");
const { ensureAuthenticated } = require("../controllers/accountController");
const { requirePermission, requireRole } = require("../middleware/rbacMiddleware");
const controller = require("../controllers/loggingController");

const router = express.Router();
const access = [ensureAuthenticated, requireRole("platform_admin", "system_admin", "acc_management_admin", "super_admin")];

router.get("/admin/logging", ...access, requirePermission("admin.logging.read"), controller.page);
router.post("/admin/logging/alerts/:id", ...access, requirePermission("admin.logging.manage"), controller.acknowledgeAlert);

module.exports = router;
