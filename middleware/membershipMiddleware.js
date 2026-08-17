/**
 * membershipMiddleware.js - Middleware for membership management
 * Provides authentication and authorization checks for membership operations
 */

const membershipModel = require("../models/membershipModel");

/**
 * Check if user is authenticated
 */
const isAuthenticated = (req, res, next) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ success: false, message: "User not authenticated" });
  }
  next();
};

/**
 * Check if user is admin
 */
const isAdmin = (req, res, next) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ success: false, message: "User not authenticated" });
  }

  if (req.session.role !== "admin" && req.session.role !== "super_admin") {
    return res.status(403).json({ success: false, message: "Access denied. Admin role required" });
  }

  next();
};

/**
 * Check if user account is active and not suspended/deactivated
 */
const isAccountActive = async (req, res, next) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ success: false, message: "User not authenticated" });
    }

    const membership = await membershipModel.getUserMembershipStatus(req.session.userId);

    if (!membership) {
      return res.status(404).json({ success: false, message: "Membership not found" });
    }

    // Check if account is suspended or deactivated
    if (membership.account_status === "suspended") {
      return res.status(403).json({
        success: false,
        message: "Your account has been suspended",
        reason: membership.suspension_reason,
      });
    }

    if (membership.account_status === "deactivated") {
      return res.status(403).json({ success: false, message: "Your account has been deactivated" });
    }

    // Check if membership is suspended
    if (membership.membership_status === "suspended") {
      return res.status(403).json({
        success: false,
        message: "Your membership has been suspended",
      });
    }

    // Check if membership is deactivated
    if (membership.membership_status === "deactivated") {
      return res.status(403).json({
        success: false,
        message: "Your membership has been deactivated",
      });
    }

    // Attach membership to request
    req.membership = membership;
    next();
  } catch (error) {
    console.error("Error checking account status:", error.message);
    res.status(500).json({ success: false, message: "Error checking account status" });
  }
};

/**
 * Check if membership has a specific feature
 */
const requireFeatureAccess = (featureName) => {
  return async (req, res, next) => {
    try {
      if (!req.membership) {
        return res.status(401).json({ success: false, message: "User not authenticated" });
      }

      // Get tier details to check features
      const tierDetails = await membershipModel.getMembershipTierDetails(req.membership.tier_id);

      if (!tierDetails) {
        return res.status(404).json({ success: false, message: "Tier information not found" });
      }

      // Check if feature is available in tier
      const hasFeature = tierDetails.features.some((f) => f.feature_name === featureName && f.enabled);

      if (!hasFeature) {
        return res.status(403).json({
          success: false,
          message: `This feature is not available in your ${tierDetails.tier_name} membership`,
          upgradeRequired: true,
        });
      }

      next();
    } catch (error) {
      console.error("Error checking feature access:", error.message);
      res.status(500).json({ success: false, message: "Error checking feature access" });
    }
  };
};

/**
 * Check usage limits for a membership tier
 */
const checkUsageLimits = (limitType) => {
  return async (req, res, next) => {
    try {
      if (!req.membership) {
        return res.status(401).json({ success: false, message: "User not authenticated" });
      }

      // Get tier details to check limits
      const tierDetails = await membershipModel.getMembershipTierDetails(req.membership.tier_id);

      if (!tierDetails) {
        return res.status(404).json({ success: false, message: "Tier information not found" });
      }

      // Check if limit exists
      const limit = tierDetails.limits.find((l) => l.limit_type === limitType);

      if (limit) {
        // Attach limit to request for controller to use
        req.membershipLimit = limit;
      }

      next();
    } catch (error) {
      console.error("Error checking usage limits:", error.message);
      res.status(500).json({ success: false, message: "Error checking usage limits" });
    }
  };
};

/**
 * Check if membership is eligible for upgrade
 */
const canUpgrade = async (req, res, next) => {
  try {
    if (!req.membership) {
      return res.status(401).json({ success: false, message: "User not authenticated" });
    }

    const { newTierId } = req.body;

    if (!newTierId) {
      return res.status(400).json({ success: false, message: "New tier ID is required" });
    }

    const newTierDetails = await membershipModel.getMembershipTierDetails(newTierId);

    if (!newTierDetails) {
      return res.status(404).json({ success: false, message: "Tier not found" });
    }

    // Verify it's an upgrade (higher tier level)
    if (newTierDetails.tier_level <= req.membership.tier_level) {
      return res.status(400).json({
        success: false,
        message: "You can only upgrade to a higher tier",
      });
    }

    req.newTierDetails = newTierDetails;
    next();
  } catch (error) {
    console.error("Error checking upgrade eligibility:", error.message);
    res.status(500).json({ success: false, message: "Error checking upgrade eligibility" });
  }
};

/**
 * Check if membership is eligible for downgrade
 */
const canDowngrade = async (req, res, next) => {
  try {
    if (!req.membership) {
      return res.status(401).json({ success: false, message: "User not authenticated" });
    }

    const { newTierId } = req.body;

    if (!newTierId) {
      return res.status(400).json({ success: false, message: "New tier ID is required" });
    }

    const newTierDetails = await membershipModel.getMembershipTierDetails(newTierId);

    if (!newTierDetails) {
      return res.status(404).json({ success: false, message: "Tier not found" });
    }

    // Verify it's a downgrade (lower tier level)
    if (newTierDetails.tier_level >= req.membership.tier_level) {
      return res.status(400).json({
        success: false,
        message: "You can only downgrade to a lower tier",
      });
    }

    req.newTierDetails = newTierDetails;
    next();
  } catch (error) {
    console.error("Error checking downgrade eligibility:", error.message);
    res.status(500).json({ success: false, message: "Error checking downgrade eligibility" });
  }
};

/**
 * Load user's current membership into request object
 */
const loadUserMembership = async (req, res, next) => {
  try {
    if (req.session && req.session.userId) {
      const membership = await membershipModel.getUserMembershipStatus(req.session.userId);
      req.userMembership = membership;
    }
    next();
  } catch (error) {
    console.error("Error loading user membership:", error.message);
    // Don't fail the request if membership can't be loaded
    next();
  }
};

/**
 * Log membership activity
 */
const logActivity = (eventType) => {
  return (req, res, next) => {
    // Store event type in request for later logging
    req.auditEventType = eventType;
    next();
  };
};

/**
 * Verify suspended user can only access limited endpoints
 */
const allowSuspendedAccess = async (req, res, next) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ success: false, message: "User not authenticated" });
    }

    const membership = await membershipModel.getUserMembershipStatus(req.session.userId);

    if (!membership) {
      return res.status(404).json({ success: false, message: "Membership not found" });
    }

    // Suspended users can only access status and reactivation endpoints
    if (membership.account_status === "suspended" || membership.membership_status === "suspended") {
      // Allow access to status and help endpoints only
      const allowedPaths = ["/membership/status", "/help", "/logout"];
      if (!allowedPaths.some((path) => req.path.includes(path))) {
        return res.status(403).json({
          success: false,
          message: "Your account is suspended. Limited access available.",
        });
      }
    }

    req.membership = membership;
    next();
  } catch (error) {
    console.error("Error checking suspended access:", error.message);
    res.status(500).json({ success: false, message: "Error checking access" });
  }
};

/**
 * Validate membership expiry and warn if expiring soon
 */
const checkExpiryWarning = async (req, res, next) => {
  try {
    if (!req.membership) {
      return next();
    }

    const expiryStatus = await membershipModel.getMembershipExpiryStatus(req.session.userId);

    if (expiryStatus && expiryStatus.expiry_status === "Expiring soon") {
      res.locals.expiryWarning = {
        message: "Your membership is expiring soon",
        expiryDate: expiryStatus.membership_expiry_date,
        daysRemaining: Math.ceil(
          (new Date(expiryStatus.membership_expiry_date) - new Date()) / (1000 * 60 * 60 * 24)
        ),
      };
    }

    next();
  } catch (error) {
    console.error("Error checking expiry warning:", error.message);
    next();
  }
};

// Export middleware
module.exports = {
  isAuthenticated,
  isAdmin,
  isAccountActive,
  requireFeatureAccess,
  checkUsageLimits,
  canUpgrade,
  canDowngrade,
  loadUserMembership,
  logActivity,
  allowSuspendedAccess,
  checkExpiryWarning,
};
