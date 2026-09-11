const express = require("express");
const { ensureAuthenticated } = require("../controllers/accountController");
const { requirePermission } = require("../middleware/rbacMiddleware");
const securityController = require("../controllers/securityController");

const router = express.Router();

router.get("/mfa/challenge", securityController.renderChallenge);
router.post("/mfa/challenge", securityController.submitChallenge);
router.get("/security/settings", ensureAuthenticated, securityController.securitySettings);
router.post("/security/mfa/enroll", ensureAuthenticated, securityController.enrollMfa);
router.get("/security/mfa/verify", ensureAuthenticated, securityController.renderEnrollment);
router.post("/security/mfa/verify", ensureAuthenticated, securityController.confirmEnrollment);
router.post("/security/mfa/disable", ensureAuthenticated, securityController.disableMfa);
router.get("/admin/security", ensureAuthenticated, requirePermission("admin.security.read"), securityController.adminSecurity);

module.exports = router;
