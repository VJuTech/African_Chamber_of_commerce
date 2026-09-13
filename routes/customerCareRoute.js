const express = require("express");
const { ensureAuthenticated } = require("../controllers/accountController");
const { requirePermission, requireRole } = require("../middleware/rbacMiddleware");
const controller = require("../controllers/customerCareController");

const router = express.Router();
const access = [ensureAuthenticated, requireRole("support_staff", "platform_admin", "system_admin", "acc_management_admin", "super_admin")];

router.get("/admin/customer-care", ...access, requirePermission("admin.support.read"), controller.page);
router.get("/admin/customer-care/:id", ...access, requirePermission("admin.support.read"), controller.detail);
router.post("/admin/customer-care/:id/action", ...access, requirePermission("admin.support.manage"), controller.action);

module.exports = router;
