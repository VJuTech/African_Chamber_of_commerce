const express = require("express");
const { ensureAuthenticated } = require("../controllers/accountController");
const { requirePermission } = require("../middleware/rbacMiddleware");
const complianceController = require("../controllers/complianceController");
const { kycUpload } = require("../utility/complianceUpload");

const router = express.Router();

router.get("/compliance", ensureAuthenticated, complianceController.memberPage);
router.post("/compliance/kyc", ensureAuthenticated, kycUpload.array("documents", 4), complianceController.submitKyc);
router.get("/admin/compliance", ensureAuthenticated, requirePermission("admin.monitoring.read"), complianceController.adminPage);
router.post("/admin/compliance/kyc/:id", ensureAuthenticated, requirePermission("admin.monitoring.read"), complianceController.reviewKyc);

module.exports = router;
