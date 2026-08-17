/**
 * Membership Model
 * Handles all membership-related database operations
 * Chapter 9 - Membership & Account Management Integration
 */

const pool = require("../database/connection");
const { membershipAuditLog } = require("../utility/membershipAuditLog");

// ============================================================================
// MEMBERSHIP TIER OPERATIONS
// ============================================================================

/**
 * Get all available membership tiers
 * @returns {Promise<Array>} Array of membership tiers
 */
async function getAllMembershipTiers() {
  const query = `
    SELECT 
      id,
      tier_name,
      tier_slug,
      description,
      pricing,
      billing_cycle,
      features,
      is_active,
      created_at
    FROM membership_tiers
    WHERE is_active = TRUE
    ORDER BY id ASC
  `;
  
  try {
    const result = await pool.query(query);
    return result.rows;
  } catch (error) {
    console.error("Error fetching membership tiers:", error);
    throw error;
  }
}

/**
 * Get specific membership tier by ID
 * @param {number} tierId - Tier ID
 * @returns {Promise<Object>} Membership tier details
 */
async function getMembershipTierById(tierId) {
  const query = `
    SELECT 
      id,
      tier_name,
      tier_slug,
      description,
      pricing,
      billing_cycle,
      features,
      is_active
    FROM membership_tiers
    WHERE id = $1
  `;
  
  try {
    const result = await pool.query(query, [tierId]);
    return result.rows[0] || null;
  } catch (error) {
    console.error("Error fetching membership tier:", error);
    throw error;
  }
}

/**
 * Get membership tier features
 * @param {number} tierId - Tier ID
 * @returns {Promise<Array>} Array of features for the tier
 */
async function getTierFeatures(tierId) {
  const query = `
    SELECT 
      id,
      feature_name,
      feature_description,
      is_available
    FROM membership_features
    WHERE tier_id = $1 AND is_available = TRUE
    ORDER BY feature_name ASC
  `;
  
  try {
    const result = await pool.query(query, [tierId]);
    return result.rows;
  } catch (error) {
    console.error("Error fetching tier features:", error);
    throw error;
  }
}

/**
 * Get membership tier limits
 * @param {number} tierId - Tier ID
 * @returns {Promise<Array>} Array of limits for the tier
 */
async function getTierLimits(tierId) {
  const query = `
    SELECT 
      id,
      limit_key,
      limit_value,
      description
    FROM membership_limits
    WHERE tier_id = $1
    ORDER BY limit_key ASC
  `;
  
  try {
    const result = await pool.query(query, [tierId]);
    return result.rows;
  } catch (error) {
    console.error("Error fetching tier limits:", error);
    throw error;
  }
}

// ============================================================================
// USER MEMBERSHIP STATUS OPERATIONS
// ============================================================================

/**
 * Requirement ACC-FRS-MEM-001: View Membership Status
 * Get user's current membership status and benefits
 * @param {number} userId - User ID
 * @returns {Promise<Object>} User membership details with tier information
 */
async function getUserMembershipStatus(userId) {
  const query = `
    SELECT 
      u.id,
      u.name,
      u.email,
      u.membership_tier_id,
      mt.tier_name,
      mt.tier_slug,
      mt.description,
      mt.pricing,
      mt.billing_cycle,
      u.membership_status,
      u.account_status,
      u.membership_start_date,
      u.membership_expiry_date,
      u.membership_renewal_date,
      u.is_suspended,
      u.suspension_reason,
      u.is_deactivated,
      u.deactivation_reason
    FROM users u
    LEFT JOIN membership_tiers mt ON u.membership_tier_id = mt.id
    WHERE u.id = $1
  `;
  
  try {
    const result = await pool.query(query, [userId]);
    if (!result.rows[0]) return null;
    
    const userMembership = result.rows[0];
    
    // Get features and limits for the tier
    const features = await getTierFeatures(userMembership.membership_tier_id);
    const limits = await getTierLimits(userMembership.membership_tier_id);
    
    return {
      ...userMembership,
      features,
      limits
    };
  } catch (error) {
    console.error("Error fetching user membership status:", error);
    throw error;
  }
}

// ============================================================================
// MEMBERSHIP UPGRADE OPERATIONS
// ============================================================================

/**
 * Requirement ACC-FRS-MEM-002: Upgrade Membership
 * Upgrade user to a higher membership tier
 * @param {number} userId - User ID
 * @param {number} newTierId - New tier ID
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Result of upgrade operation
 */
async function upgradeMembership(userId, newTierId, options = {}) {
  const client = await pool.connect();
  
  try {
    await client.query("BEGIN");
    
    // Get current user membership
    const currentUser = await client.query(
      `SELECT membership_tier_id, membership_status FROM users WHERE id = $1`,
      [userId]
    );
    
    if (!currentUser.rows[0]) {
      throw new Error("User not found");
    }
    
    const { membership_tier_id: currentTierId } = currentUser.rows[0];
    
    // Get new tier info
    const newTierResult = await client.query(
      `SELECT tier_name, tier_slug FROM membership_tiers WHERE id = $1`,
      [newTierId]
    );
    
    if (!newTierResult.rows[0]) {
      throw new Error("Target membership tier not found");
    }
    
    const newTierName = newTierResult.rows[0].tier_name;
    
    // Update user membership
    const now = new Date();
    const renewalDate = new Date();
    renewalDate.setMonth(renewalDate.getMonth() + 1);
    
    const updateResult = await client.query(
      `UPDATE users SET
        membership_tier_id = $1,
        previous_tier_id = $2,
        tier_change_date = NOW(),
        membership_start_date = NOW(),
        membership_expiry_date = $3,
        membership_renewal_date = $4,
        membership_status = 'active',
        updated_at = NOW()
      WHERE id = $5
      RETURNING id, name, email`,
      [newTierId, currentTierId, options.expiryDate || null, renewalDate, userId]
    );
    
    // Record membership history
    await client.query(
      `INSERT INTO membership_history 
        (user_id, previous_tier_id, new_tier_id, change_type, reason, initiated_by, effective_date)
      VALUES ($1, $2, $3, 'UPGRADE', $4, $5, NOW())`,
      [userId, currentTierId, newTierId, options.reason || "User-initiated upgrade", options.initiatedBy || "user"]
    );
    
    // Log audit event
    await membershipAuditLog(client, {
      userId,
      eventType: "UPGRADE",
      action: "upgrade_membership",
      previousTier: currentTierId ? `Tier ${currentTierId}` : "Basic",
      newTier: newTierName,
      statusBefore: "active",
      statusAfter: "active",
      initiatedBy: options.initiatedBy || "user",
      ipAddress: options.ipAddress || "unknown",
      reason: options.reason || "User-initiated upgrade",
      outcome: "success"
    });
    
    await client.query("COMMIT");
    
    return {
      success: true,
      message: `Successfully upgraded to ${newTierName}`,
      user: updateResult.rows[0],
      newTier: newTierName
    };
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error upgrading membership:", error);
    throw error;
  } finally {
    client.release();
  }
}

// ============================================================================
// MEMBERSHIP DOWNGRADE OPERATIONS
// ============================================================================

/**
 * Requirement ACC-FRS-MEM-003: Downgrade Membership
 * Schedule membership downgrade for end of billing cycle
 * @param {number} userId - User ID
 * @param {number} newTierId - New tier ID
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Result of downgrade operation
 */
async function downgradeMembership(userId, newTierId, options = {}) {
  const client = await pool.connect();
  
  try {
    await client.query("BEGIN");
    
    // Get current user membership
    const currentUser = await client.query(
      `SELECT membership_tier_id, membership_status, membership_renewal_date FROM users WHERE id = $1`,
      [userId]
    );
    
    if (!currentUser.rows[0]) {
      throw new Error("User not found");
    }
    
    const { membership_tier_id: currentTierId, membership_renewal_date } = currentUser.rows[0];
    
    // Get new tier info
    const newTierResult = await client.query(
      `SELECT tier_name FROM membership_tiers WHERE id = $1`,
      [newTierId]
    );
    
    if (!newTierResult.rows[0]) {
      throw new Error("Target membership tier not found");
    }
    
    const newTierName = newTierResult.rows[0].tier_name;
    
    // Schedule downgrade for end of billing cycle (renewal date)
    const downgradeDate = membership_renewal_date || new Date();
    
    // Record membership history with scheduled status
    await client.query(
      `INSERT INTO membership_history 
        (user_id, previous_tier_id, new_tier_id, change_type, reason, initiated_by, effective_date)
      VALUES ($1, $2, $3, 'SCHEDULED_DOWNGRADE', $4, $5, $6)`,
      [userId, currentTierId, newTierId, options.reason || "User-initiated downgrade", options.initiatedBy || "user", downgradeDate]
    );
    
    // Log audit event
    await membershipAuditLog(client, {
      userId,
      eventType: "DOWNGRADE",
      action: "downgrade_membership",
      previousTier: `Tier ${currentTierId}`,
      newTier: newTierName,
      statusBefore: "active",
      statusAfter: "scheduled_downgrade",
      initiatedBy: options.initiatedBy || "user",
      ipAddress: options.ipAddress || "unknown",
      reason: options.reason || "User-initiated downgrade",
      metadata: { effectiveDate: downgradeDate.toISOString() },
      outcome: "scheduled"
    });
    
    await client.query("COMMIT");
    
    return {
      success: true,
      message: `Downgrade to ${newTierName} scheduled for ${downgradeDate.toLocaleDateString()}`,
      effectiveDate: downgradeDate
    };
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error downgrading membership:", error);
    throw error;
  } finally {
    client.release();
  }
}

// ============================================================================
// ACCOUNT SUSPENSION OPERATIONS
// ============================================================================

/**
 * Requirement ACC-FRS-MEM-004: Suspend Account
 * Admin ability to suspend user accounts
 * @param {number} userId - User ID to suspend
 * @param {string} reason - Reason for suspension
 * @param {string} adminId - Admin user ID
 * @param {string} ipAddress - IP address of admin
 * @returns {Promise<Object>} Result of suspension operation
 */
async function suspendAccount(userId, reason = "", adminId = null, ipAddress = "unknown") {
  const client = await pool.connect();
  
  try {
    await client.query("BEGIN");
    
    // Get user details before suspension
    const userResult = await client.query(
      `SELECT id, name, email, membership_tier_id FROM users WHERE id = $1`,
      [userId]
    );
    
    if (!userResult.rows[0]) {
      throw new Error("User not found");
    }
    
    // Suspend account
    await client.query(
      `UPDATE users SET
        is_suspended = TRUE,
        suspension_reason = $1,
        suspended_at = NOW(),
        account_status = 'suspended',
        membership_status = 'suspended',
        updated_at = NOW()
      WHERE id = $2`,
      [reason, userId]
    );
    
    // Get tier info for audit
    const tierResult = await client.query(
      `SELECT tier_name FROM membership_tiers WHERE id = $1`,
      [userResult.rows[0].membership_tier_id]
    );
    
    // Log audit event
    await membershipAuditLog(client, {
      userId,
      eventType: "SUSPENSION",
      action: "suspend_account",
      statusBefore: "active",
      statusAfter: "suspended",
      initiatedBy: adminId ? "admin" : "system",
      ipAddress,
      reason: reason || "Administrative action",
      outcome: "success"
    });
    
    await client.query("COMMIT");
    
    return {
      success: true,
      message: `Account for ${userResult.rows[0].name} has been suspended`,
      user: userResult.rows[0]
    };
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error suspending account:", error);
    throw error;
  } finally {
    client.release();
  }
}

// ============================================================================
// ACCOUNT REACTIVATION OPERATIONS
// ============================================================================

/**
 * Requirement ACC-FRS-MEM-005: Reactivate Account
 * Admin ability to reactivate suspended accounts
 * @param {number} userId - User ID to reactivate
 * @param {string} adminId - Admin user ID
 * @param {string} ipAddress - IP address of admin
 * @returns {Promise<Object>} Result of reactivation operation
 */
async function reactivateAccount(userId, adminId = null, ipAddress = "unknown") {
  const client = await pool.connect();
  
  try {
    await client.query("BEGIN");
    
    // Get user details
    const userResult = await client.query(
      `SELECT id, name, email, is_suspended FROM users WHERE id = $1`,
      [userId]
    );
    
    if (!userResult.rows[0]) {
      throw new Error("User not found");
    }
    
    // Reactivate account
    await client.query(
      `UPDATE users SET
        is_suspended = FALSE,
        suspension_reason = NULL,
        suspended_at = NULL,
        account_status = 'active',
        membership_status = 'active',
        updated_at = NOW()
      WHERE id = $1`,
      [userId]
    );
    
    // Log audit event
    await membershipAuditLog(client, {
      userId,
      eventType: "REACTIVATION",
      action: "reactivate_account",
      statusBefore: "suspended",
      statusAfter: "active",
      initiatedBy: adminId ? "admin" : "system",
      ipAddress,
      reason: "Administrative reactivation",
      outcome: "success"
    });
    
    await client.query("COMMIT");
    
    return {
      success: true,
      message: `Account for ${userResult.rows[0].name} has been reactivated`,
      user: userResult.rows[0]
    };
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error reactivating account:", error);
    throw error;
  } finally {
    client.release();
  }
}

// ============================================================================
// ACCOUNT DEACTIVATION OPERATIONS
// ============================================================================

/**
 * Requirement ACC-FRS-MEM-006: Deactivate Account (User Initiated)
 * Allow users to deactivate their own accounts
 * @param {number} userId - User ID
 * @param {string} reason - Reason for deactivation
 * @param {string} ipAddress - IP address of user
 * @returns {Promise<Object>} Result of deactivation operation
 */
async function deactivateAccount(userId, reason = "", ipAddress = "unknown") {
  const client = await pool.connect();
  
  try {
    await client.query("BEGIN");
    
    // Get user details
    const userResult = await client.query(
      `SELECT id, name, email FROM users WHERE id = $1`,
      [userId]
    );
    
    if (!userResult.rows[0]) {
      throw new Error("User not found");
    }
    
    // Deactivate account
    await client.query(
      `UPDATE users SET
        is_deactivated = TRUE,
        deactivated_at = NOW(),
        deactivation_reason = $1,
        account_status = 'deactivated',
        membership_status = 'deactivated',
        updated_at = NOW()
      WHERE id = $2`,
      [reason, userId]
    );
    
    // Log audit event
    await membershipAuditLog(client, {
      userId,
      eventType: "DEACTIVATION",
      action: "deactivate_account",
      statusBefore: "active",
      statusAfter: "deactivated",
      initiatedBy: "user",
      ipAddress,
      reason: reason || "User-initiated deactivation",
      outcome: "success"
    });
    
    await client.query("COMMIT");
    
    return {
      success: true,
      message: `Account for ${userResult.rows[0].name} has been deactivated`,
      user: userResult.rows[0]
    };
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error deactivating account:", error);
    throw error;
  } finally {
    client.release();
  }
}

// ============================================================================
// MEMBERSHIP EXPIRY MANAGEMENT OPERATIONS
// ============================================================================

/**
 * Requirement ACC-FRS-MEM-007: Membership Expiry Management
 * Track and enforce membership expiration
 * @param {number} userId - User ID
 * @returns {Promise<Object>} Expiry status
 */
async function checkMembershipExpiry(userId) {
  try {
    const result = await pool.query(
      `SELECT 
        id,
        name,
        email,
        membership_status,
        membership_expiry_date,
        membership_tier_id
      FROM users
      WHERE id = $1`,
      [userId]
    );
    
    if (!result.rows[0]) {
      return null;
    }
    
    const user = result.rows[0];
    const now = new Date();
    const expiryDate = new Date(user.membership_expiry_date);
    
    return {
      userId: user.id,
      isExpired: expiryDate < now && user.membership_expiry_date !== null,
      expiryDate: user.membership_expiry_date,
      daysUntilExpiry: Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24)),
      currentStatus: user.membership_status
    };
  } catch (error) {
    console.error("Error checking membership expiry:", error);
    throw error;
  }
}

/**
 * Process expired memberships
 * Updates status and restricts features for expired users
 * @returns {Promise<Object>} Result of expiry processing
 */
async function processExpiredMemberships() {
  const client = await pool.connect();
  
  try {
    await client.query("BEGIN");
    
    // Find expired memberships
    const expiredResult = await client.query(
      `SELECT id, name, email, membership_tier_id 
      FROM users 
      WHERE membership_expiry_date < NOW() 
        AND membership_status = 'active'
        AND membership_expiry_date IS NOT NULL`
    );
    
    const expiredUsers = expiredResult.rows;
    let processedCount = 0;
    
    for (const user of expiredUsers) {
      // Update membership status to expired
      await client.query(
        `UPDATE users SET
          membership_status = 'expired',
          account_status = 'active',
          updated_at = NOW()
        WHERE id = $1`,
        [user.id]
      );
      
      // Log audit event
      await membershipAuditLog(client, {
        userId: user.id,
        eventType: "EXPIRY",
        action: "membership_expired",
        statusBefore: "active",
        statusAfter: "expired",
        initiatedBy: "system",
        reason: "Membership expiration date reached",
        outcome: "success"
      });
      
      processedCount++;
    }
    
    await client.query("COMMIT");
    
    return {
      success: true,
      message: `Processed ${processedCount} expired memberships`,
      processedCount
    };
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error processing expired memberships:", error);
    throw error;
  } finally {
    client.release();
  }
}

// ============================================================================
// MEMBERSHIP HISTORY AND AUDIT OPERATIONS
// ============================================================================

/**
 * Get membership history for a user
 * @param {number} userId - User ID
 * @param {number} limit - Maximum records to return
 * @returns {Promise<Array>} Membership history records
 */
async function getMembershipHistory(userId, limit = 10) {
  const query = `
    SELECT 
      mh.id,
      mh.user_id,
      pt.tier_name as previous_tier_name,
      nt.tier_name as new_tier_name,
      mh.change_type,
      mh.effective_date,
      mh.reason,
      mh.initiated_by,
      mh.created_at
    FROM membership_history mh
    LEFT JOIN membership_tiers pt ON mh.previous_tier_id = pt.id
    LEFT JOIN membership_tiers nt ON mh.new_tier_id = nt.id
    WHERE mh.user_id = $1
    ORDER BY mh.created_at DESC
    LIMIT $2
  `;
  
  try {
    const result = await pool.query(query, [userId, limit]);
    return result.rows;
  } catch (error) {
    console.error("Error fetching membership history:", error);
    throw error;
  }
}

/**
 * Requirement ACC-FRS-MEM-008: Membership Audit Logging
 * Get membership audit logs
 * @param {Object} filters - Filter options
 * @returns {Promise<Array>} Audit log records
 */
async function getMembershipAuditLogs(filters = {}) {
  let query = `
    SELECT 
      id,
      user_id,
      event_type,
      action,
      previous_tier,
      new_tier,
      status_before,
      status_after,
      initiated_by,
      ip_address,
      reason,
      outcome,
      created_at
    FROM membership_audit_logs
    WHERE 1=1
  `;
  
  const params = [];
  let paramIndex = 1;
  
  if (filters.userId) {
    query += ` AND user_id = $${paramIndex}`;
    params.push(filters.userId);
    paramIndex++;
  }
  
  if (filters.eventType) {
    query += ` AND event_type = $${paramIndex}`;
    params.push(filters.eventType);
    paramIndex++;
  }
  
  if (filters.startDate) {
    query += ` AND created_at >= $${paramIndex}`;
    params.push(filters.startDate);
    paramIndex++;
  }
  
  if (filters.endDate) {
    query += ` AND created_at <= $${paramIndex}`;
    params.push(filters.endDate);
    paramIndex++;
  }
  
  query += ` ORDER BY created_at DESC`;
  
  if (filters.limit) {
    query += ` LIMIT $${paramIndex}`;
    params.push(filters.limit);
  }
  
  try {
    const result = await pool.query(query, params);
    return result.rows;
  } catch (error) {
    console.error("Error fetching membership audit logs:", error);
    throw error;
  }
}

// ============================================================================
// MEMBERSHIP ACCESS CONTROL
// ============================================================================

/**
 * Check if user has access to specific features based on membership tier
 * @param {number} userId - User ID
 * @param {string} featureName - Feature name to check
 * @returns {Promise<Boolean>} True if user has access
 */
async function hasFeatureAccess(userId, featureName) {
  try {
    const result = await pool.query(
      `SELECT COUNT(*) FROM membership_features mf
       JOIN users u ON u.membership_tier_id = mf.tier_id
       WHERE u.id = $1 
         AND mf.feature_name = $2 
         AND mf.is_available = TRUE
         AND u.membership_status = 'active'
         AND u.account_status = 'active'`,
      [userId, featureName]
    );
    
    return parseInt(result.rows[0].count) > 0;
  } catch (error) {
    console.error("Error checking feature access:", error);
    return false;
  }
}

/**
 * Check membership tier limits
 * @param {number} userId - User ID
 * @param {string} limitKey - Limit key to check
 * @returns {Promise<Number|null>} Limit value or null if not found
 */
async function checkMembershipLimit(userId, limitKey) {
  try {
    const result = await pool.query(
      `SELECT ml.limit_value FROM membership_limits ml
       JOIN users u ON u.membership_tier_id = ml.tier_id
       WHERE u.id = $1 AND ml.limit_key = $2`,
      [userId, limitKey]
    );
    
    return result.rows[0] ? result.rows[0].limit_value : null;
  } catch (error) {
    console.error("Error checking membership limit:", error);
    return null;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Tier operations
  getAllMembershipTiers,
  getMembershipTierById,
  getTierFeatures,
  getTierLimits,
  
  // User membership status
  getUserMembershipStatus,
  
  // Membership operations
  upgradeMembership,
  downgradeMembership,
  
  // Account suspension
  suspendAccount,
  reactivateAccount,
  
  // Account deactivation
  deactivateAccount,
  
  // Expiry management
  checkMembershipExpiry,
  processExpiredMemberships,
  
  // History and audit
  getMembershipHistory,
  getMembershipAuditLogs,
  
  // Access control
  hasFeatureAccess,
  checkMembershipLimit
};
