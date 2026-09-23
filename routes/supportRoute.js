const express = require("express");
const multer = require("multer");
const path = require("path");
const { ensureAuthenticated } = require("../controllers/accountController");
const { requirePermission, requireRole } = require("../middleware/rbacMiddleware");
const controller = require("../controllers/supportController");

const router = express.Router();
const upload = multer({ dest: path.join(__dirname, "..", "public", "uploads", "support") });
const adminAccess = [ensureAuthenticated, requireRole("support_staff", "platform_admin", "system_admin", "acc_management_admin", "super_admin")];

router.get("/support", controller.helpCenter);
router.get("/support/report", ensureAuthenticated, controller.reportIssue);
router.post("/support/tickets", ensureAuthenticated, upload.single("screenshot"), controller.createTicket);
router.get("/admin/support", ...adminAccess, requirePermission("admin.support.read"), controller.adminPage);
router.post("/admin/support/tickets/:id", ...adminAccess, requirePermission("admin.support.manage"), controller.updateTicket);
router.post("/admin/support/maintenance", ...adminAccess, requirePermission("admin.support.manage"), controller.scheduleMaintenance);

module.exports = router;
