const express = require("express");
const { ensureAuthenticated } = require("../controllers/accountController");
const { requirePermission, requireRole } = require("../middleware/rbacMiddleware");
const partnershipModel = require("../models/partnershipModel");
const controller = require("../controllers/partnershipController");

const router = express.Router();
const adminAccess = [ensureAuthenticated, requireRole("acc_management_admin", "platform_admin", "system_admin", "super_admin")];

async function partnerGateway(req, res, next) {
  try {
    const secret = req.get("x-acc-partner-key") || (req.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const partner = await partnershipModel.authenticatePartnerKey(secret);
    if (!partner) return res.status(401).json({ success: false, message: "A valid active partner credential is required." });
    req.partner = partner;
    next();
  } catch (error) { next(error); }
}

function requirePartnerScope(scope) {
  return (req, res, next) => {
    if (!req.partner.scopes.includes(scope)) return res.status(403).json({ success: false, message: `Partner credential lacks ${scope}.` });
    next();
  };
}

router.get("/admin/partnerships", ...adminAccess, requirePermission("admin.partnerships.read"), controller.page);
router.post("/admin/partnerships/partners", ...adminAccess, requirePermission("admin.partnerships.manage"), controller.register);
router.post("/admin/partnerships/partners/:id/status", ...adminAccess, requirePermission("admin.partnerships.manage"), controller.status);
router.post("/admin/partnerships/integrations", ...adminAccess, requirePermission("admin.partnerships.manage"), controller.integration);
router.post("/admin/partnerships/credentials", ...adminAccess, requirePermission("admin.partnerships.manage"), controller.credential);
router.post("/admin/partnerships/access", ...adminAccess, requirePermission("admin.partnerships.manage"), controller.grant);
router.get("/api/partners/v1/profile", partnerGateway, requirePartnerScope("partner.profile.read"), controller.partnerProfile);
router.post("/api/partners/v1/exchanges", partnerGateway, requirePartnerScope("events.write"), controller.partnerExchange);

module.exports = router;
