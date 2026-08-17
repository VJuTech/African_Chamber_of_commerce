/**
 * membershipController.js - Business logic for membership management
 * Implements all functional requirements from Chapter 9
 * ACC-FRS-MEM-001 through ACC-FRS-MEM-008
 */

const membershipModel = require("../models/membershipModel");
const { logMembershipAudit } = require("../utility/membershipAuditLog");

// ============================================
// ACC-FRS-MEM-001: View Membership Status
// ============================================

/**
 * Display membership status page
 */
const viewMembershipStatus = async (req, res) => {
  try {
    const userId = req.session.userId;

    if (!userId) {
      return res.status(401).render("error/404", { message: "User not authenticated" });
    }

    // Get current membership status
    const membershipStatus = await membershipModel.getUserMembershipStatus(userId);
    if (!membershipStatus) {
      return res.status(404).render("error/404", { message: "Membership information not found" });
    }

    // Get membership benefits and features
    const tierDetails = await membershipModel.getMembershipTierDetails(membershipStatus.tier_id);

    // Get all available tiers for upgrade options
    const allTiers = await membershipModel.getMembershipTiers();

    res.render("membership/view-status", {
      membershipStatus,
      tierDetails,
      allTiers,
      title: "Membership Status",
    });
  } catch (error) {
    console.error("Error viewing membership status:", error.message);
    res.status(500).render("error/500", { message: "Error loading membership status" });
  }
};

/**
 * API endpoint for membership status (JSON response)
 */
const getApiMembershipStatus = async (req, res) => {
  try {
    const userId = req.session.userId;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const membershipStatus = await membershipModel.getUserMembershipStatus(userId);
    if (!membershipStatus) {
      return res.status(404).json({ success: false, message: "Membership not found" });
    }

    // Log view activity
    await logMembershipAudit({
      userId,
      eventType: "view_status",
      outcome: "success",
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });

    res.json({
      success: true,
      data: membershipStatus,
    });
  } catch (error) {
    console.error("Error fetching membership status API:", error.message);
    res.status(500).json({ success: false, message: "Error fetching membership status" });
  }
};

// ============================================
// ACC-FRS-MEM-002: Upgrade Membership
// ============================================

/**
 * Display upgrade membership page
 */
const showUpgradeForm = async (req, res) => {
  try {
    const userId = req.session.userId;

    if (!userId) {
      return res.status(401).render("error/404", { message: "User not authenticated" });
    }

    // Get current membership
    const currentMembership = await membershipModel.getUserMembershipStatus(userId);
    if (!currentMembership) {
      return res.status(404).render("error/404", { message: "Membership not found" });
    }

    // Get all available tiers
    const allTiers = await membershipModel.getMembershipTiers();

    // Filter available upgrade options (higher tiers only)
    const upgradeTiers = allTiers.filter((tier) => tier.tier_level > currentMembership.tier_level);

    res.render("membership/upgrade-membership", {
      currentMembership,
      upgradeTiers,
      title: "Upgrade Membership",
    });
  } catch (error) {
    console.error("Error showing upgrade form:", error.message);
    res.status(500).render("error/500", { message: "Error loading upgrade options" });
  }
};

/**
 * Process membership upgrade
 * ACC-FRS-MEM-002 Workflow: Redirect to payment after selection
 */
const processMembershipUpgrade = async (req, res) => {
  try {
    const userId = req.session.userId;
    const { newTierId } = req.body;

    if (!userId || !newTierId) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    // Get current and new tier information
    const currentMembership = await membershipModel.getUserMembershipStatus(userId);
    const newTierDetails = await membershipModel.getMembershipTierDetails(newTierId);

    if (!currentMembership || !newTierDetails) {
      return res.status(404).json({ success: false, message: "Membership or tier not found" });
    }

    // Validation: Can only upgrade to higher tier
    if (newTierDetails.tier_level <= currentMembership.tier_level) {
      return res.status(400).json({
        success: false,
        message: "Can only upgrade to a higher tier",
      });
    }

    // Prepare payment redirect
    // In a real system, integrate with payment gateway (Stripe, PayPal, etc.)
    const paymentData = {
      userId,
      currentTierId: currentMembership.tier_id,
      newTierId,
      amount: newTierDetails.pricing,
      currency: "USD",
      description: `Upgrade to ${newTierDetails.tier_name} membership`,
    };

    // Log upgrade request
    await logMembershipAudit({
      userId,
      eventType: "upgrade_initiated",
      membershipTier: newTierDetails.tier_name,
      outcome: "pending_payment",
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
      details: paymentData,
    });

    // Store in session for later use after payment confirmation
    req.session.pendingUpgrade = {
      newTierId,
      amount: newTierDetails.pricing,
      timerName: newTierDetails.tier_name,
    };

    res.json({
      success: true,
      message: "Ready for payment",
      paymentData,
      redirectUrl: "/membership/payment",
    });
  } catch (error) {
    console.error("Error processing upgrade:", error.message);
    res.status(500).json({ success: false, message: "Error processing upgrade" });
  }
};

/**
 * Confirm upgrade after successful payment
 */
const confirmUpgrade = async (req, res) => {
  try {
    const userId = req.session.userId;
    const { paymentId } = req.body;

    if (!userId || !req.session.pendingUpgrade) {
      return res.status(400).json({ success: false, message: "No pending upgrade" });
    }

    const { newTierId } = req.session.pendingUpgrade;

    // In production: verify payment with payment gateway
    // For now, assume payment is successful

    // Perform the upgrade
    const result = await membershipModel.upgradeMembership(userId, newTierId);

    // Get new tier info for logging
    const newTierDetails = await membershipModel.getMembershipTierDetails(newTierId);

    // Log successful upgrade
    await logMembershipAudit({
      userId,
      eventType: "upgrade",
      membershipTier: newTierDetails.tier_name,
      outcome: "success",
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
      details: { paymentId, previousTier: result.tier_id },
    });

    // Clear pending upgrade from session
    delete req.session.pendingUpgrade;

    res.json({
      success: true,
      message: "Membership upgraded successfully",
      newMembership: result,
    });
  } catch (error) {
    console.error("Error confirming upgrade:", error.message);

    // Log failed upgrade
    await logMembershipAudit({
      userId: req.session.userId,
      eventType: "upgrade",
      outcome: "failure",
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
      details: { error: error.message },
    });

    res.status(500).json({ success: false, message: "Error confirming upgrade" });
  }
};

// ============================================
// ACC-FRS-MEM-003: Downgrade Membership
// ============================================

/**
 * Show downgrade membership page
 */
const showDowngradeForm = async (req, res) => {
  try {
    const userId = req.session.userId;

    if (!userId) {
      return res.status(401).render("error/404", { message: "User not authenticated" });
    }

    // Get current membership
    const currentMembership = await membershipModel.getUserMembershipStatus(userId);
    if (!currentMembership) {
      return res.status(404).render("error/404", { message: "Membership not found" });
    }

    // Get all available tiers
    const allTiers = await membershipModel.getMembershipTiers();

    // Filter available downgrade options (lower tiers only)
    const downgradeTiers = allTiers.filter((tier) => tier.tier_level < currentMembership.tier_level);

    res.render("membership/downgrade-membership", {
      currentMembership,
      downgradeTiers,
      title: "Downgrade Membership",
    });
  } catch (error) {
    console.error("Error showing downgrade form:", error.message);
    res.status(500).render("error/500", { message: "Error loading downgrade options" });
  }
};

/**
 * Process membership downgrade
 * ACC-FRS-MEM-003: Scheduled for end of billing cycle
 */
const processMembershipDowngrade = async (req, res) => {
  try {
    const userId = req.session.userId;
    const { newTierId, confirmDowngrade } = req.body;

    if (!userId || !newTierId) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    // Get current and new tier information
    const currentMembership = await membershipModel.getUserMembershipStatus(userId);
    const newTierDetails = await membershipModel.getMembershipTierDetails(newTierId);

    if (!currentMembership || !newTierDetails) {
      return res.status(404).json({ success: false, message: "Membership or tier not found" });
    }

    // Validation: Can only downgrade to lower tier
    if (newTierDetails.tier_level >= currentMembership.tier_level) {
      return res.status(400).json({
        success: false,
        message: "Can only downgrade to a lower tier",
      });
    }

    // Schedule downgrade for end of billing cycle
    const result = await membershipModel.downgradeMembership(userId, newTierId);

    // Log downgrade request
    await logMembershipAudit({
      userId,
      eventType: "downgrade",
      membershipTier: newTierDetails.tier_name,
      outcome: "success",
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
      details: { scheduledDate: result.scheduled_date },
    });

    res.json({
      success: true,
      message: "Downgrade scheduled successfully. Changes will take effect at the end of your billing cycle.",
      data: result,
    });
  } catch (error) {
    console.error("Error processing downgrade:", error.message);

    // Log failed downgrade
    await logMembershipAudit({
      userId: req.session.userId,
      eventType: "downgrade",
      outcome: "failure",
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
      details: { error: error.message },
    });

    res.status(500).json({ success: false, message: "Error processing downgrade" });
  }
};

// ============================================
// ACC-FRS-MEM-004: Suspend Account (Admin)
// ============================================

/**
 * Display admin account management page
 */
const showAdminPanel = async (req, res) => {
  try {
    // Verify admin role
    if (req.session.role !== "admin" && req.session.role !== "super_admin") {
      return res.status(403).render("error/404", { message: "Access denied" });
    }

    // Get membership statistics
    const stats = await membershipModel.getMembershipStatistics();

    // Get recent audit logs
    const auditLogs = await membershipModel.getAllAuditLogs(20);

    res.render("membership/admin-panel", {
      stats,
      auditLogs,
      title: "Membership Administration",
    });
  } catch (error) {
    console.error("Error loading admin panel:", error.message);
    res.status(500).render("error/500", { message: "Error loading admin panel" });
  }
};

/**
 * Suspend user account
 */
const suspendUserAccount = async (req, res) => {
  try {
    const adminId = req.session.userId;
    const { userId, reason } = req.body;

    if (!adminId || !userId || !reason) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    // Verify admin role
    if (req.session.role !== "admin" && req.session.role !== "super_admin") {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    // Suspend the account
    const result = await membershipModel.suspendAccount(userId, reason, adminId);

    // Log the suspension
    await logMembershipAudit({
      userId,
      adminId,
      eventType: "suspension",
      oldStatus: "active",
      newStatus: "suspended",
      outcome: "success",
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
      details: { reason },
    });

    res.json({
      success: true,
      message: "Account suspended successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error suspending account:", error.message);
    res.status(500).json({ success: false, message: "Error suspending account" });
  }
};

// ============================================
// ACC-FRS-MEM-005: Reactivate Account (Admin)
// ============================================

/**
 * Reactivate suspended user account
 */
const reactivateUserAccount = async (req, res) => {
  try {
    const adminId = req.session.userId;
    const { userId } = req.body;

    if (!adminId || !userId) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    // Verify admin role
    if (req.session.role !== "admin" && req.session.role !== "super_admin") {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    // Reactivate the account
    const result = await membershipModel.reactivateAccount(userId, adminId);

    // Log the reactivation
    await logMembershipAudit({
      userId,
      adminId,
      eventType: "reactivation",
      oldStatus: "suspended",
      newStatus: "active",
      outcome: "success",
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });

    res.json({
      success: true,
      message: "Account reactivated successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error reactivating account:", error.message);
    res.status(500).json({ success: false, message: "Error reactivating account" });
  }
};

// ============================================
// ACC-FRS-MEM-006: Deactivate Account (User-Initiated)
// ============================================

/**
 * Show deactivation confirmation page
 */
const showDeactivateForm = async (req, res) => {
  try {
    const userId = req.session.userId;

    if (!userId) {
      return res.status(401).render("error/404", { message: "User not authenticated" });
    }

    const membershipStatus = await membershipModel.getUserMembershipStatus(userId);

    res.render("membership/deactivate-account", {
      membershipStatus,
      title: "Deactivate Account",
    });
  } catch (error) {
    console.error("Error showing deactivate form:", error.message);
    res.status(500).render("error/500", { message: "Error loading deactivation page" });
  }
};

/**
 * Process account deactivation (user-initiated)
 */
const deactivateUserAccount = async (req, res) => {
  try {
    const userId = req.session.userId;
    const { confirmDeactivate } = req.body;

    if (!userId || !confirmDeactivate) {
      return res.status(400).json({ success: false, message: "Deactivation not confirmed" });
    }

    // Deactivate the account
    const result = await membershipModel.deactivateAccount(userId);

    // Log the deactivation
    await logMembershipAudit({
      userId,
      eventType: "deactivation",
      oldStatus: "active",
      newStatus: "deactivated",
      outcome: "success",
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });

    // Clear session
    req.session.destroy();

    res.json({
      success: true,
      message: "Account deactivated successfully. You have been logged out.",
    });
  } catch (error) {
    console.error("Error deactivating account:", error.message);

    // Log failed deactivation
    await logMembershipAudit({
      userId: req.session.userId,
      eventType: "deactivation",
      outcome: "failure",
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
      details: { error: error.message },
    });

    res.status(500).json({ success: false, message: "Error deactivating account" });
  }
};

// ============================================
// ACC-FRS-MEM-007: Membership Expiry Management
// ============================================

/**
 * Get membership expiry status
 */
const getMembershipExpiryStatus = async (req, res) => {
  try {
    const userId = req.session.userId;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const expiryStatus = await membershipModel.getMembershipExpiryStatus(userId);

    if (!expiryStatus) {
      return res.status(404).json({ success: false, message: "Membership not found" });
    }

    res.json({
      success: true,
      data: expiryStatus,
    });
  } catch (error) {
    console.error("Error fetching expiry status:", error.message);
    res.status(500).json({ success: false, message: "Error fetching expiry status" });
  }
};

/**
 * Process expired memberships (admin/cron job)
 */
const processExpiredMemberships = async (req, res) => {
  try {
    // Verify admin role
    if (req.session.role !== "admin" && req.session.role !== "super_admin") {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const processedCount = await membershipModel.checkAndProcessExpiredMemberships();

    // Log the batch expiry processing
    await logMembershipAudit({
      userId: null,
      adminId: req.session.userId,
      eventType: "batch_expiry_process",
      outcome: "success",
      details: { processedCount },
    });

    res.json({
      success: true,
      message: `${processedCount} memberships processed for expiry`,
      processedCount,
    });
  } catch (error) {
    console.error("Error processing expired memberships:", error.message);
    res.status(500).json({ success: false, message: "Error processing expired memberships" });
  }
};

// ============================================
// ACC-FRS-MEM-008: Membership Audit Logging
// ============================================

/**
 * Get user's membership audit logs
 */
const getUserAuditLogs = async (req, res) => {
  try {
    const userId = req.session.userId;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const auditLogs = await membershipModel.getUserAuditLogs(userId, 50);

    res.json({
      success: true,
      data: auditLogs,
    });
  } catch (error) {
    console.error("Error fetching audit logs:", error.message);
    res.status(500).json({ success: false, message: "Error fetching audit logs" });
  }
};

/**
 * Show membership audit logs page
 */
const showAuditLogs = async (req, res) => {
  try {
    const userId = req.session.userId;

    if (!userId) {
      return res.status(401).render("error/404", { message: "User not authenticated" });
    }

    const auditLogs = await membershipModel.getUserAuditLogs(userId, 50);

    res.render("membership/audit-logs", {
      auditLogs,
      title: "Membership Activity Logs",
    });
  } catch (error) {
    console.error("Error loading audit logs page:", error.message);
    res.status(500).render("error/500", { message: "Error loading audit logs" });
  }
};

/**
 * Get admin view of all audit logs
 */
const getAllAuditLogs = async (req, res) => {
  try {
    // Verify admin role
    if (req.session.role !== "admin" && req.session.role !== "super_admin") {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const { limit = 100, offset = 0 } = req.query;
    const auditLogs = await membershipModel.getAllAuditLogs(parseInt(limit), parseInt(offset));

    res.json({
      success: true,
      data: auditLogs,
    });
  } catch (error) {
    console.error("Error fetching all audit logs:", error.message);
    res.status(500).json({ success: false, message: "Error fetching audit logs" });
  }
};

// ============================================
// MEMBERSHIP HISTORY & INFORMATION
// ============================================

/**
 * Get user's membership history
 */
const getMembershipHistory = async (req, res) => {
  try {
    const userId = req.session.userId;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const history = await membershipModel.getMembershipHistory(userId);

    res.json({
      success: true,
      data: history,
    });
  } catch (error) {
    console.error("Error fetching membership history:", error.message);
    res.status(500).json({ success: false, message: "Error fetching membership history" });
  }
};

/**
 * Get available membership tiers
 */
const getMembershipTiers = async (req, res) => {
  try {
    const tiers = await membershipModel.getMembershipTiers();

    res.json({
      success: true,
      data: tiers,
    });
  } catch (error) {
    console.error("Error fetching tiers:", error.message);
    res.status(500).json({ success: false, message: "Error fetching membership tiers" });
  }
};

/**
 * Get tier details
 */
const getTierDetails = async (req, res) => {
  try {
    const { tierId } = req.params;

    const tierDetails = await membershipModel.getMembershipTierDetails(tierId);

    if (!tierDetails) {
      return res.status(404).json({ success: false, message: "Tier not found" });
    }

    res.json({
      success: true,
      data: tierDetails,
    });
  } catch (error) {
    console.error("Error fetching tier details:", error.message);
    res.status(500).json({ success: false, message: "Error fetching tier details" });
  }
};

/**
 * Admin: Change membership tier for user
 */
const adminChangeMembershipTier = async (req, res) => {
  try {
    const adminId = req.session.userId;
    const { userId, newTierId, reason } = req.body;

    if (!adminId || !userId || !newTierId || !reason) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    // Verify admin role
    if (req.session.role !== "admin" && req.session.role !== "super_admin") {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const result = await membershipModel.adminChangeMembershipTier(userId, newTierId, reason, adminId);

    res.json({
      success: true,
      message: "Membership tier changed successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error changing membership tier:", error.message);
    res.status(500).json({ success: false, message: "Error changing membership tier" });
  }
};

// Export all controller functions
module.exports = {
  // ACC-FRS-MEM-001
  viewMembershipStatus,
  getApiMembershipStatus,

  // ACC-FRS-MEM-002
  showUpgradeForm,
  processMembershipUpgrade,
  confirmUpgrade,

  // ACC-FRS-MEM-003
  showDowngradeForm,
  processMembershipDowngrade,

  // ACC-FRS-MEM-004
  showAdminPanel,
  suspendUserAccount,

  // ACC-FRS-MEM-005
  reactivateUserAccount,

  // ACC-FRS-MEM-006
  showDeactivateForm,
  deactivateUserAccount,

  // ACC-FRS-MEM-007
  getMembershipExpiryStatus,
  processExpiredMemberships,

  // ACC-FRS-MEM-008
  getUserAuditLogs,
  showAuditLogs,
  getAllAuditLogs,

  // Additional utilities
  getMembershipHistory,
  getMembershipTiers,
  getTierDetails,
  adminChangeMembershipTier,
};
