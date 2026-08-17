/**
 * Membership Controller
 * Handles all membership-related HTTP requests
 * Chapter 9 - Membership & Account Management Integration
 */

const membershipModel = require("../models/membershipModel");
const { responseSuccess, responseError } = require("../utility/responseHelper");

// ============================================================================
// MEMBERSHIP STATUS & INFORMATION
// ============================================================================

/**
 * Requirement ACC-FRS-MEM-001: View Membership Status
 * Displays user's current membership status and benefits
 */
async function viewMembershipStatus(req, res, next) {
  try {
    const userId = req.session.userId || req.user?.id;
    
    if (!userId) {
      return res.status(401).render("error/401", {
        title: "Unauthorized",
        message: "Please log in to view your membership status"
      });
    }

    const membershipData = await membershipModel.getUserMembershipStatus(userId);
    
    if (!membershipData) {
      return res.status(404).render("error/404", {
        title: "Not Found",
        message: "Membership information not found"
      });
    }

    return res.render("membership/status", {
      title: "Membership Status",
      membership: membershipData,
      user: req.session.user || {}
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * Get membership status (API endpoint)
 */
async function getMembershipStatus(req, res, next) {
  try {
    const userId = req.session.userId || req.user?.id;
    
    if (!userId) {
      return responseError(res, "Unauthorized", 401);
    }

    const membershipData = await membershipModel.getUserMembershipStatus(userId);
    
    if (!membershipData) {
      return responseError(res, "Membership information not found", 404);
    }

    return responseSuccess(res, membershipData, "Membership status retrieved successfully");
  } catch (error) {
    return next(error);
  }
}

/**
 * Get all membership tiers
 */
async function getAllMembershipTiers(req, res, next) {
  try {
    const tiers = await membershipModel.getAllMembershipTiers();
    
    // Enrich tiers with features and limits
    const enrichedTiers = await Promise.all(
      tiers.map(async (tier) => ({
        ...tier,
        features: await membershipModel.getTierFeatures(tier.id),
        limits: await membershipModel.getTierLimits(tier.id)
      }))
    );

    return responseSuccess(res, enrichedTiers, "Membership tiers retrieved successfully");
  } catch (error) {
    return next(error);
  }
}

// ============================================================================
// MEMBERSHIP UPGRADE
// ============================================================================

/**
 * Requirement ACC-FRS-MEM-002: Upgrade Membership
 * Display upgrade options
 */
async function showUpgradeForm(req, res, next) {
  try {
    const userId = req.session.userId || req.user?.id;
    
    if (!userId) {
      return res.redirect("/login");
    }

    const currentMembership = await membershipModel.getUserMembershipStatus(userId);
    const availableTiers = await membershipModel.getAllMembershipTiers();

    // Filter tiers to show only higher tiers than current
    const upgradableTiers = await Promise.all(
      availableTiers
        .filter(tier => tier.id > (currentMembership.membership_tier_id || 1))
        .map(async (tier) => ({
          ...tier,
          features: await membershipModel.getTierFeatures(tier.id),
          limits: await membershipModel.getTierLimits(tier.id)
        }))
    );

    return res.render("membership/upgrade", {
      title: "Upgrade Membership",
      currentMembership,
      availableTiers: upgradableTiers,
      user: req.session.user || {}
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * Process membership upgrade
 * Typically called after payment is confirmed
 */
async function processMembershipUpgrade(req, res, next) {
  try {
    const userId = req.session.userId || req.user?.id;
    const { newTierId, paymentId } = req.body;

    if (!userId || !newTierId) {
      return responseError(res, "Missing required fields", 400);
    }

    // Validate tier exists
    const tierInfo = await membershipModel.getMembershipTierById(parseInt(newTierId));
    if (!tierInfo) {
      return responseError(res, "Invalid membership tier", 400);
    }

    // Process upgrade
    const result = await membershipModel.upgradeMembership(
      userId,
      parseInt(newTierId),
      {
        reason: "User-initiated upgrade",
        initiatedBy: "user",
        ipAddress: req.ip,
        paymentId
      }
    );

    if (result.success) {
      return responseSuccess(res, result, "Membership upgraded successfully", 200);
    }

    return responseError(res, "Failed to upgrade membership", 500);
  } catch (error) {
    return next(error);
  }
}

// ============================================================================
// MEMBERSHIP DOWNGRADE
// ============================================================================

/**
 * Requirement ACC-FRS-MEM-003: Downgrade Membership
 * Display downgrade options
 */
async function showDowngradeForm(req, res, next) {
  try {
    const userId = req.session.userId || req.user?.id;
    
    if (!userId) {
      return res.redirect("/login");
    }

    const currentMembership = await membershipModel.getUserMembershipStatus(userId);
    const availableTiers = await membershipModel.getAllMembershipTiers();

    // Filter tiers to show only lower tiers than current
    const downgradableTiers = await Promise.all(
      availableTiers
        .filter(tier => tier.id < (currentMembership.membership_tier_id || 1))
        .map(async (tier) => ({
          ...tier,
          features: await membershipModel.getTierFeatures(tier.id),
          limits: await membershipModel.getTierLimits(tier.id)
        }))
    );

    return res.render("membership/downgrade", {
      title: "Downgrade Membership",
      currentMembership,
      availableTiers: downgradableTiers,
      user: req.session.user || {}
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * Process membership downgrade
 * Schedules downgrade for end of billing cycle
 */
async function processMembershipDowngrade(req, res, next) {
  try {
    const userId = req.session.userId || req.user?.id;
    const { newTierId, reason } = req.body;

    if (!userId || !newTierId) {
      return responseError(res, "Missing required fields", 400);
    }

    // Validate tier exists
    const tierInfo = await membershipModel.getMembershipTierById(parseInt(newTierId));
    if (!tierInfo) {
      return responseError(res, "Invalid membership tier", 400);
    }

    // Process downgrade
    const result = await membershipModel.downgradeMembership(
      userId,
      parseInt(newTierId),
      {
        reason: reason || "User-initiated downgrade",
        initiatedBy: "user",
        ipAddress: req.ip
      }
    );

    if (result.success) {
      return responseSuccess(res, result, "Membership downgrade scheduled successfully", 200);
    }

    return responseError(res, "Failed to downgrade membership", 500);
  } catch (error) {
    return next(error);
  }
}

// ============================================================================
// ACCOUNT MANAGEMENT (ADMIN FUNCTIONS)
// ============================================================================

/**
 * Requirement ACC-FRS-MEM-004: Suspend Account
 * Admin can suspend user accounts
 */
async function suspendUserAccount(req, res, next) {
  try {
    // Check if user is admin
    if (!req.session.isAdmin) {
      return responseError(res, "Unauthorized: Admin access required", 403);
    }

    const { userId, reason } = req.body;

    if (!userId) {
      return responseError(res, "User ID is required", 400);
    }

    const result = await membershipModel.suspendAccount(
      userId,
      reason || "Administrative suspension",
      req.session.userId,
      req.ip
    );

    if (result.success) {
      return responseSuccess(res, result, "Account suspended successfully", 200);
    }

    return responseError(res, "Failed to suspend account", 500);
  } catch (error) {
    return next(error);
  }
}

/**
 * Requirement ACC-FRS-MEM-005: Reactivate Account
 * Admin can reactivate suspended accounts
 */
async function reactivateUserAccount(req, res, next) {
  try {
    // Check if user is admin
    if (!req.session.isAdmin) {
      return responseError(res, "Unauthorized: Admin access required", 403);
    }

    const { userId } = req.body;

    if (!userId) {
      return responseError(res, "User ID is required", 400);
    }

    const result = await membershipModel.reactivateAccount(
      userId,
      req.session.userId,
      req.ip
    );

    if (result.success) {
      return responseSuccess(res, result, "Account reactivated successfully", 200);
    }

    return responseError(res, "Failed to reactivate account", 500);
  } catch (error) {
    return next(error);
  }
}

// ============================================================================
// ACCOUNT DEACTIVATION (USER INITIATED)
// ============================================================================

/**
 * Requirement ACC-FRS-MEM-006: Deactivate Account (User Initiated)
 * Users can deactivate their own accounts
 */
async function showDeactivationForm(req, res, next) {
  try {
    const userId = req.session.userId || req.user?.id;
    
    if (!userId) {
      return res.redirect("/login");
    }

    return res.render("membership/deactivate-account", {
      title: "Deactivate Account",
      user: req.session.user || {}
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * Process account deactivation
 */
async function deactivateUserAccount(req, res, next) {
  try {
    const userId = req.session.userId || req.user?.id;
    const { reason, confirmDeactivation } = req.body;

    if (!userId) {
      return responseError(res, "Unauthorized", 401);
    }

    if (!confirmDeactivation) {
      return responseError(res, "Deactivation not confirmed", 400);
    }

    const result = await membershipModel.deactivateAccount(
      userId,
      reason || "User initiated deactivation",
      req.ip
    );

    if (result.success) {
      // Invalidate session
      req.session.destroy((err) => {
        if (err) console.error("Session destruction error:", err);
        return responseSuccess(
          res,
          { redirectTo: "/login" },
          "Account deactivated successfully",
          200
        );
      });
    } else {
      return responseError(res, "Failed to deactivate account", 500);
    }
  } catch (error) {
    return next(error);
  }
}

// ============================================================================
// MEMBERSHIP EXPIRY MANAGEMENT
// ============================================================================

/**
 * Requirement ACC-FRS-MEM-007: Membership Expiry Management
 * Check membership expiry status
 */
async function checkExpiry(req, res, next) {
  try {
    const userId = req.session.userId || req.user?.id;

    if (!userId) {
      return responseError(res, "Unauthorized", 401);
    }

    const expiryStatus = await membershipModel.checkMembershipExpiry(userId);

    if (!expiryStatus) {
      return responseError(res, "User not found", 404);
    }

    return responseSuccess(res, expiryStatus, "Expiry status retrieved successfully");
  } catch (error) {
    return next(error);
  }
}

/**
 * Process expired memberships (admin/scheduled task)
 */
async function processExpiredMemberships(req, res, next) {
  try {
    // Check if user is admin or system
    if (!req.session.isAdmin) {
      return responseError(res, "Unauthorized: Admin access required", 403);
    }

    const result = await membershipModel.processExpiredMemberships();

    return responseSuccess(res, result, "Expired memberships processed", 200);
  } catch (error) {
    return next(error);
  }
}

// ============================================================================
// MEMBERSHIP HISTORY & AUDIT
// ============================================================================

/**
 * Requirement ACC-FRS-MEM-008: Membership Audit Logging
 * Get membership history for current user
 */
async function viewMembershipHistory(req, res, next) {
  try {
    const userId = req.session.userId || req.user?.id;

    if (!userId) {
      return res.redirect("/login");
    }

    const history = await membershipModel.getMembershipHistory(userId, 20);

    return res.render("membership/history", {
      title: "Membership History",
      history,
      user: req.session.user || {}
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * Get membership audit logs (admin only)
 */
async function getMembershipAuditLogs(req, res, next) {
  try {
    if (!req.session.isAdmin) {
      return responseError(res, "Unauthorized: Admin access required", 403);
    }

    const { userId, eventType, startDate, endDate, limit } = req.query;
    const filters = {};

    if (userId) filters.userId = parseInt(userId);
    if (eventType) filters.eventType = eventType;
    if (startDate) filters.startDate = new Date(startDate);
    if (endDate) filters.endDate = new Date(endDate);
    if (limit) filters.limit = parseInt(limit);

    const auditLogs = await membershipModel.getMembershipAuditLogs(filters);

    return responseSuccess(res, auditLogs, "Audit logs retrieved successfully");
  } catch (error) {
    return next(error);
  }
}

// ============================================================================
// ADMIN MEMBERSHIP MANAGEMENT
// ============================================================================

/**
 * Display admin membership management dashboard
 */
async function adminMembershipDashboard(req, res, next) {
  try {
    if (!req.session.isAdmin) {
      return res.status(403).render("error/403", {
        title: "Forbidden",
        message: "Admin access required"
      });
    }

    const tiers = await membershipModel.getAllMembershipTiers();
    const auditLogs = await membershipModel.getMembershipAuditLogs({ limit: 50 });

    return res.render("membership/admin-dashboard", {
      title: "Membership Management",
      tiers,
      recentAuditLogs: auditLogs,
      user: req.session.user || {}
    });
  } catch (error) {
    return next(error);
  }
}

/**
 * Change user's membership tier (admin)
 */
async function changeUserMembershipTier(req, res, next) {
  try {
    if (!req.session.isAdmin) {
      return responseError(res, "Unauthorized: Admin access required", 403);
    }

    const { userId, tierId, reason } = req.body;

    if (!userId || !tierId) {
      return responseError(res, "User ID and Tier ID are required", 400);
    }

    // Validate tier
    const tierInfo = await membershipModel.getMembershipTierById(parseInt(tierId));
    if (!tierInfo) {
      return responseError(res, "Invalid membership tier", 400);
    }

    const result = await membershipModel.upgradeMembership(
      userId,
      parseInt(tierId),
      {
        reason: reason || "Administrative tier change",
        initiatedBy: "admin",
        ipAddress: req.ip
      }
    );

    return responseSuccess(res, result, "Membership tier changed successfully", 200);
  } catch (error) {
    return next(error);
  }
}

// ============================================================================
// MEMBERSHIP ACCESS CONTROL
// ============================================================================

/**
 * Check if user has access to specific feature
 */
async function checkFeatureAccess(req, res, next) {
  try {
    const userId = req.session.userId || req.user?.id;
    const { featureName } = req.body;

    if (!userId || !featureName) {
      return responseError(res, "User ID and feature name required", 400);
    }

    const hasAccess = await membershipModel.hasFeatureAccess(userId, featureName);

    return responseSuccess(res, { hasAccess, feature: featureName }, "Access check completed");
  } catch (error) {
    return next(error);
  }
}

/**
 * Get user's membership limits
 */
async function getUserMembershipLimits(req, res, next) {
  try {
    const userId = req.session.userId || req.user?.id;

    if (!userId) {
      return responseError(res, "Unauthorized", 401);
    }

    const membershipData = await membershipModel.getUserMembershipStatus(userId);

    if (!membershipData || !membershipData.limits) {
      return responseError(res, "User limits not found", 404);
    }

    return responseSuccess(res, membershipData.limits, "User limits retrieved successfully");
  } catch (error) {
    return next(error);
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Membership status
  viewMembershipStatus,
  getMembershipStatus,
  getAllMembershipTiers,

  // Upgrade
  showUpgradeForm,
  processMembershipUpgrade,

  // Downgrade
  showDowngradeForm,
  processMembershipDowngrade,

  // Account management (admin)
  suspendUserAccount,
  reactivateUserAccount,

  // Account deactivation (user)
  showDeactivationForm,
  deactivateUserAccount,

  // Expiry management
  checkExpiry,
  processExpiredMemberships,

  // History and audit
  viewMembershipHistory,
  getMembershipAuditLogs,

  // Admin dashboard
  adminMembershipDashboard,
  changeUserMembershipTier,

  // Access control
  checkFeatureAccess,
  getUserMembershipLimits
};
