/**
 * membershipRoute.js - Routes for membership management
 * Implements all routes for Chapter 9 functional requirements
 */

const express = require("express");
const router = express.Router();
const membershipController = require("../controllers/membershipController");
const {
  isAuthenticated,
  isAdmin,
  isAccountActive,
  loadUserMembership,
  canUpgrade,
  canDowngrade,
  checkExpiryWarning,
} = require("../middleware/membershipMiddleware");

// ============================================
// Middleware: Apply to all membership routes
// ============================================
router.use(loadUserMembership);
router.use(checkExpiryWarning);

// ============================================
// ACC-FRS-MEM-001: View Membership Status
// ============================================

// User-facing membership status page
router.get("/membership/status", isAuthenticated, isAccountActive, membershipController.viewMembershipStatus);

// API endpoint for membership status (JSON)
router.get("/membership/api/status", isAuthenticated, isAccountActive, membershipController.getApiMembershipStatus);

// ============================================
// ACC-FRS-MEM-002: Upgrade Membership
// ============================================

// Show upgrade options page
router.get("/membership/upgrade", isAuthenticated, isAccountActive, membershipController.showUpgradeForm);

// Process upgrade request (initiates payment)
router.post(
  "/membership/api/upgrade",
  isAuthenticated,
  isAccountActive,
  canUpgrade,
  membershipController.processMembershipUpgrade
);

// Confirm upgrade after payment
router.post("/membership/api/upgrade/confirm", isAuthenticated, membershipController.confirmUpgrade);

// ============================================
// ACC-FRS-MEM-003: Downgrade Membership
// ============================================

// Show downgrade options page
router.get("/membership/downgrade", isAuthenticated, isAccountActive, membershipController.showDowngradeForm);

// Process downgrade request (scheduled for end of billing cycle)
router.post(
  "/membership/api/downgrade",
  isAuthenticated,
  isAccountActive,
  canDowngrade,
  membershipController.processMembershipDowngrade
);

// ============================================
// ACC-FRS-MEM-004 & ACC-FRS-MEM-005: Account Suspension & Reactivation (Admin)
// ============================================

// Admin membership management dashboard
router.get("/membership/admin", isAuthenticated, isAdmin, membershipController.showAdminPanel);

// Suspend user account (admin only)
router.post("/membership/api/suspend", isAuthenticated, isAdmin, membershipController.suspendUserAccount);

// Reactivate user account (admin only)
router.post("/membership/api/reactivate", isAuthenticated, isAdmin, membershipController.reactivateUserAccount);

// Admin change membership tier
router.post(
  "/membership/api/admin/change-tier",
  isAuthenticated,
  isAdmin,
  membershipController.adminChangeMembershipTier
);

// ============================================
// ACC-FRS-MEM-006: Deactivate Account (User-Initiated)
// ============================================

// Show account deactivation confirmation page
router.get("/membership/deactivate", isAuthenticated, membershipController.showDeactivateForm);

// Process account deactivation (user-initiated)
router.post("/membership/api/deactivate", isAuthenticated, membershipController.deactivateUserAccount);

// ============================================
// ACC-FRS-MEM-007: Membership Expiry Management
// ============================================

// Get membership expiry status (API)
router.get("/membership/api/expiry-status", isAuthenticated, membershipController.getMembershipExpiryStatus);

// Process expired memberships (admin/cron job endpoint)
router.post("/membership/api/process-expiry", isAuthenticated, isAdmin, membershipController.processExpiredMemberships);

// ============================================
// ACC-FRS-MEM-008: Membership Audit Logging
// ============================================

// Get user's audit logs (page view)
router.get("/membership/audit-logs", isAuthenticated, membershipController.showAuditLogs);

// Get user's audit logs (API)
router.get("/membership/api/audit-logs", isAuthenticated, membershipController.getUserAuditLogs);

// Get all audit logs (admin only)
router.get("/membership/api/admin/audit-logs", isAuthenticated, isAdmin, membershipController.getAllAuditLogs);

// ============================================
// Additional Membership Information Routes
// ============================================

// Get membership history
router.get("/membership/history", isAuthenticated, membershipController.getMembershipHistory);

// Get available membership tiers (public)
router.get("/membership/api/tiers", membershipController.getMembershipTiers);

// Get specific tier details (public)
router.get("/membership/api/tiers/:tierId", membershipController.getTierDetails);

// ============================================
// Payment Integration Routes (Placeholder)
// ============================================

// Payment page (after selecting upgrade)
router.get("/membership/payment", isAuthenticated, (req, res) => {
  if (!req.session.pendingUpgrade) {
    return res.redirect("/membership/status");
  }

  res.render("membership/payment", {
    pendingUpgrade: req.session.pendingUpgrade,
    title: "Complete Your Upgrade",
  });
});

// Webhook for payment confirmation (from payment gateway)
router.post("/membership/payment/webhook", async (req, res) => {
  try {
    // In production, verify webhook signature from payment provider
    const { paymentId, status, userId } = req.body;

    if (status === "success") {
      // Process the upgrade
      res.json({ success: true });
    } else {
      res.status(400).json({ success: false, message: "Payment failed" });
    }
  } catch (error) {
    console.error("Payment webhook error:", error.message);
    res.status(500).json({ success: false, message: "Webhook processing error" });
  }
});

// ============================================
// Redirect Routes for Backward Compatibility
// ============================================

// Redirect from old membership paths to new ones (if needed)
router.get("/account/membership", (req, res) => {
  res.redirect("/membership/status");
});

router.get("/dashboard/membership", (req, res) => {
  res.redirect("/membership/status");
});

// ============================================
// 404 Handler for membership routes
// ============================================

router.use((req, res) => {
  res.status(404).render("error/404", {
    message: "Membership page not found",
  });
});

module.exports = router;
