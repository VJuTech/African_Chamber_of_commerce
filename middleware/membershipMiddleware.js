/**
 * Membership Access Control Middleware
 * Validates user membership status and enforces access restrictions
 * Chapter 9 - Membership & Account Management Integration
 */

const membershipModel = require("../models/membershipModel");

/**
 * Middleware to check if user account is active
 * Blocks access if account is suspended or deactivated
 */
const ensureAccountActive = async (req, res, next) => {
  try {
    const userId = req.session?.userId || req.user?.id;
    
    if (!userId) {
      return res.status(401).render("accounts/login", {
        title: "Sign In",
        error: "Please log in to continue"
      });
    }

    const membershipData = await membershipModel.getUserMembershipStatus(userId);
    
    if (!membershipData) {
      return res.status(404).render("error/404", {
        title: "Not Found",
        message: "User account not found"
      });
    }

    // Check if account is suspended
    if (membershipData.is_suspended) {
      return res.status(403).render("error/403", {
        title: "Account Suspended",
        message: `Your account has been suspended. Reason: ${membershipData.suspension_reason || "No reason provided"}. Please contact support for assistance.`
      });
    }

    // Check if account is deactivated
    if (membershipData.is_deactivated) {
      return res.status(403).render("error/403", {
        title: "Account Deactivated",
        message: "Your account has been deactivated. Please contact support if you wish to reactivate it."
      });
    }

    // Store membership data in request for later use
    req.membership = membershipData;
    next();
  } catch (error) {
    console.error("Error checking account status:", error);
    return next(error);
  }
};

/**
 * Middleware to check if user's membership is active
 * Allows access but may restrict features based on membership status
 */
const checkMembershipStatus = async (req, res, next) => {
  try {
    const userId = req.session?.userId || req.user?.id;
    
    if (!userId) {
      return next();
    }

    const membershipData = await membershipModel.getUserMembershipStatus(userId);
    
    if (membershipData) {
      // Check if membership is expired
      if (membershipData.membership_expiry_date) {
        const now = new Date();
        const expiryDate = new Date(membershipData.membership_expiry_date);
        
        if (expiryDate < now && membershipData.membership_status !== "expired") {
          // Membership is expired
          req.membership = { ...membershipData, membership_status: "expired" };
        } else {
          req.membership = membershipData;
        }
      } else {
        req.membership = membershipData;
      }
    }

    next();
  } catch (error) {
    console.error("Error checking membership status:", error);
    next();
  }
};

/**
 * Middleware to enforce feature access based on membership tier
 * Blocks access to premium features if user doesn't have required tier
 */
const requireFeatureAccess = (featureName) => {
  return async (req, res, next) => {
    try {
      const userId = req.session?.userId || req.user?.id;
      
      if (!userId) {
        return res.status(401).render("accounts/login", {
          title: "Sign In",
          error: "Please log in to access this feature"
        });
      }

      const hasAccess = await membershipModel.hasFeatureAccess(userId, featureName);
      
      if (!hasAccess) {
        return res.status(403).render("error/403", {
          title: "Premium Feature",
          message: `This feature is not available in your current membership tier. Please upgrade your membership to access "${featureName}".`
        });
      }

      next();
    } catch (error) {
      console.error("Error checking feature access:", error);
      return next(error);
    }
  };
};

/**
 * Middleware to check membership tier requirements
 */
const requireMembershipTier = (allowedTiers = []) => {
  return async (req, res, next) => {
    try {
      const userId = req.session?.userId || req.user?.id;
      
      if (!userId) {
        return res.status(401).render("accounts/login", {
          title: "Sign In",
          error: "Please log in to continue"
        });
      }

      const membershipData = await membershipModel.getUserMembershipStatus(userId);
      
      if (!membershipData) {
        return res.status(404).render("error/404", {
          title: "Not Found",
          message: "Membership information not found"
        });
      }

      // Check if user's tier is in allowed tiers
      if (allowedTiers.length > 0 && !allowedTiers.includes(membershipData.tier_slug)) {
        return res.status(403).render("error/403", {
          title: "Tier Required",
          message: `This feature requires one of the following membership tiers: ${allowedTiers.join(", ")}. Your current tier is: ${membershipData.tier_slug}`
        });
      }

      req.membership = membershipData;
      next();
    } catch (error) {
      console.error("Error checking membership tier:", error);
      return next(error);
    }
  };
};

/**
 * Middleware to enforce usage limits
 */
const checkUsageLimits = (limitKey) => {
  return async (req, res, next) => {
    try {
      const userId = req.session?.userId || req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const limit = await membershipModel.checkMembershipLimit(userId, limitKey);
      
      if (limit !== null) {
        // Attach limit information to request
        req.membershipLimit = {
          key: limitKey,
          value: limit
        };
      }

      next();
    } catch (error) {
      console.error("Error checking usage limits:", error);
      return next(error);
    }
  };
};

/**
 * Middleware for admin access verification
 */
const ensureAdmin = (req, res, next) => {
  if (!req.session?.isAdmin) {
    return res.status(403).render("error/403", {
      title: "Forbidden",
      message: "Admin access required to perform this action"
    });
  }
  next();
};

/**
 * Middleware to check if user is platform administrator
 */
const ensureSuperAdmin = (req, res, next) => {
  const userRole = req.session?.role;
  
  if (userRole !== "super_admin" && userRole !== "platform_admin") {
    return res.status(403).render("error/403", {
      title: "Forbidden",
      message: "Super administrator access required"
    });
  }
  next();
};

/**
 * Middleware to log membership-related actions
 */
const logMembershipAction = async (req, res, next) => {
  // Store original send method
  const originalSend = res.send;
  
  // Override send method to capture response
  res.send = function (data) {
    try {
      const userId = req.session?.userId || req.user?.id;
      
      if (userId && req.path.includes("/membership")) {
        // Log membership action
        console.log({
          timestamp: new Date().toISOString(),
          userId,
          path: req.path,
          method: req.method,
          statusCode: res.statusCode,
          ip: req.ip
        });
      }
    } catch (error) {
      console.error("Error logging membership action:", error);
    }
    
    // Call original send
    return originalSend.call(this, data);
  };
  
  next();
};

/**
 * Middleware to attach membership data to locals for views
 */
const attachMembershipToLocals = (req, res, next) => {
  if (req.membership) {
    res.locals.membership = req.membership;
    res.locals.membershipTier = req.membership.tier_slug;
    res.locals.isMembershipActive = req.membership.membership_status === "active";
    res.locals.isMembershipExpired = req.membership.membership_status === "expired";
  }
  next();
};

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Account status checks
  ensureAccountActive,
  checkMembershipStatus,
  
  // Feature and tier access
  requireFeatureAccess,
  requireMembershipTier,
  checkUsageLimits,
  
  // Admin checks
  ensureAdmin,
  ensureSuperAdmin,
  
  // Logging and data attachment
  logMembershipAction,
  attachMembershipToLocals
};
