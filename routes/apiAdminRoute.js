const express = require("express");
const { ensureAuthenticated } = require("../controllers/accountController");
const { requirePermission, requireRole } = require("../middleware/rbacMiddleware");
const controller = require("../controllers/apiAdminController");

const router = express.Router();
const access = [ensureAuthenticated, requireRole("acc_management_admin", "platform_admin", "system_admin", "super_admin")];

router.get("/admin/api", ...access, requirePermission("admin.api.monitor"), controller.page);
router.post("/admin/api/clients", ...access, requirePermission("admin.api.manage"), controller.createClient);
router.post("/admin/api/keys/:id/revoke", ...access, requirePermission("admin.api.manage"), controller.revokeKey);
router.post("/admin/api/webhooks", ...access, requirePermission("admin.api.manage"), controller.createWebhook);
router.post("/admin/api/webhooks/:id/revoke", ...access, requirePermission("admin.api.manage"), controller.revokeWebhook);
router.post("/admin/api/deliveries/:id/retry", ...access, requirePermission("admin.api.manage"), controller.retryWebhook);

module.exports = router;
