/**
 * Membership Routes
 * Handles all membership and account management endpoints
 * Chapter 9 - Membership & Account Management Integration
 */

const express = require("express");
const membershipController = require("../controllers/membershipController");

const router = express.Router();

// ============================================================================
// MIDDLEWARE - Ensure user is authenticated
// ============================================================================

const ensureAuthenticated = (req, res, next) => {
  if (!req.session || !req.session.userId) {
    return res.redirect("/login");
  }
  next();
};

const ensureAdmin = (req, res, next) => {
  if (!req.session || !req.session.isAdmin) {
    return res.status(403).render("error/403", {
      title: "Forbidden",
      message: "Admin access required"
    });
  }
  next();
};

// ============================================================================
// MEMBERSHIP STATUS & INFORMATION
// ============================================================================

// View membership status (Requirement ACC-FRS-MEM-001)
router.get("/status", ensureAuthenticated, membershipController.viewMembershipStatus);

// API: Get membership status
router.get("/api/status", ensureAuthenticated, membershipController.getMembershipStatus);

// API: Get all membership tiers
router.get("/api/tiers", membershipController.getAllMembershipTiers);

// API: Get user limits
router.get("/api/limits", ensureAuthenticated, membershipController.getUserMembershipLimits);

// ============================================================================
// MEMBERSHIP UPGRADE
// ============================================================================

// Display upgrade form (Requirement ACC-FRS-MEM-002)
router.get("/upgrade", ensureAuthenticated, membershipController.showUpgradeForm);

// Process upgrade (typically called after payment)
router.post("/api/upgrade", ensureAuthenticated, membershipController.processMembershipUpgrade);

// ============================================================================
// MEMBERSHIP DOWNGRADE
// ============================================================================

// Display downgrade form (Requirement ACC-FRS-MEM-003)
router.get("/downgrade", ensureAuthenticated, membershipController.showDowngradeForm);

// Process downgrade
router.post("/api/downgrade", ensureAuthenticated, membershipController.processMembershipDowngrade);

// ============================================================================
// ACCOUNT MANAGEMENT (Admin Functions)
// ============================================================================

// Suspend account (Requirement ACC-FRS-MEM-004)
router.post("/api/suspend", ensureAdmin, membershipController.suspendUserAccount);

// Reactivate account (Requirement ACC-FRS-MEM-005)
router.post("/api/reactivate", ensureAdmin, membershipController.reactivateUserAccount);

// ============================================================================
// ACCOUNT DEACTIVATION (User Initiated)
// ============================================================================

// Display deactivation form (Requirement ACC-FRS-MEM-006)
router.get("/deactivate", ensureAuthenticated, membershipController.showDeactivationForm);

// Process deactivation
router.post("/api/deactivate", ensureAuthenticated, membershipController.deactivateUserAccount);

// ============================================================================
// MEMBERSHIP EXPIRY MANAGEMENT
// ============================================================================

// Check expiry status (Requirement ACC-FRS-MEM-007)
router.get("/api/expiry-status", ensureAuthenticated, membershipController.checkExpiry);

// Process expired memberships (Admin/Scheduled Task)
router.post("/api/process-expired", ensureAdmin, membershipController.processExpiredMemberships);

// ============================================================================
// MEMBERSHIP HISTORY & AUDIT
// ============================================================================

// View membership history (Requirement ACC-FRS-MEM-008)
router.get("/history", ensureAuthenticated, membershipController.viewMembershipHistory);

// API: Get membership audit logs (Admin only)
router.get("/api/audit-logs", ensureAdmin, membershipController.getMembershipAuditLogs);

// ============================================================================
// ADMIN MEMBERSHIP MANAGEMENT DASHBOARD
// ============================================================================

// Admin dashboard
router.get("/admin", ensureAdmin, membershipController.adminMembershipDashboard);

// Admin: Change user's membership tier
router.post("/api/admin/change-tier", ensureAdmin, membershipController.changeUserMembershipTier);

// ============================================================================
// MEMBERSHIP ACCESS CONTROL
// ============================================================================

// Check feature access
router.post("/api/check-access", ensureAuthenticated, membershipController.checkFeatureAccess);

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = router;
