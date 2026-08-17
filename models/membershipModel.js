/**
 * membershipModel.js - Database operations for membership management
 * Implements all database interactions for Chapter 9 requirements
 * ACC-FRS-MEM-001 through ACC-FRS-MEM-008
 */

const pool = require("../database/connection");

// ============================================
// MEMBERSHIP TIER OPERATIONS
// ============================================

/**
 * Get all membership tiers
 */
const getMembershipTiers = async () => {
  try {
    const query = `
      SELECT 
        mt.id, 
        mt.tier_name, 
        mt.tier_level,
        mt.description,
        mt.pricing,
        mt.billing_cycle,
        COUNT(DISTINCT mf.id) as feature_count,
        COUNT(DISTINCT ml.id) as limit_count
      FROM membership_tiers mt
      LEFT JOIN membership_features mf ON mt.id = mf.tier_id
      LEFT JOIN membership_limits ml ON mt.id = ml.tier_id
      GROUP BY mt.id
      ORDER BY mt.tier_level ASC
    `;
    const result = await pool.query(query);
    return result.rows;
  } catch (err) {
    console.error("Error fetching membership tiers:", err.message);
    throw err;
  }
};

/**
 * Get a specific membership tier with all features and limits
 */
const getMembershipTierDetails = async (tierId) => {
  try {
    const tierQuery = "SELECT * FROM membership_tiers WHERE id = $1";
    const featuresQuery = "SELECT * FROM membership_features WHERE tier_id = $1 AND enabled = TRUE";
    const limitsQuery = "SELECT * FROM membership_limits WHERE tier_id = $1";

    const [tierResult, featuresResult, limitsResult] = await Promise.all([
      pool.query(tierQuery, [tierId]),
      pool.query(featuresQuery, [tierId]),
      pool.query(limitsQuery, [tierId]),
    ]);

    if (tierResult.rows.length === 0) {
      return null;
    }

    return {
      ...tierResult.rows[0],
      features: featuresResult.rows,
      limits: limitsResult.rows,
    };
  } catch (err) {
    console.error("Error fetching tier details:", err.message);
    throw err;
  }
};

// ============================================
// USER MEMBERSHIP OPERATIONS (ACC-FRS-MEM-001)
// ============================================

/**
 * Get user's current membership status
 */
const getUserMembershipStatus = async (userId) => {
  try {
    const query = `
      SELECT 
        um.id,
        um.user_id,
        um.tier_id,
        mt.tier_name,
        mt.tier_level,
        mt.description,
        mt.pricing,
        um.membership_status,
        um.membership_start_date,
        um.membership_expiry_date,
        um.renewal_date,
        u.account_status,
        u.suspended_at,
        u.suspension_reason
      FROM user_memberships um
      JOIN membership_tiers mt ON um.tier_id = mt.id
      JOIN users u ON um.user_id = u.id
      WHERE um.user_id = $1
    `;
    const result = await pool.query(query, [userId]);
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (err) {
    console.error("Error fetching user membership:", err.message);
    throw err;
  }
};

/**
 * Create initial membership for a new user (Basic tier by default)
 */
const createUserMembership = async (userId, tierId = 1) => {
  try {
    const query = `
      INSERT INTO user_memberships (user_id, tier_id, membership_status)
      VALUES ($1, $2, 'active')
      ON CONFLICT (user_id) DO NOTHING
      RETURNING *
    `;
    const result = await pool.query(query, [userId, tierId]);
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (err) {
    console.error("Error creating user membership:", err.message);
    throw err;
  }
};

// ============================================
// MEMBERSHIP UPGRADE/DOWNGRADE (ACC-FRS-MEM-002, MEM-003)
// ============================================

/**
 * Upgrade user membership tier
 */
const upgradeMembership = async (userId, newTierId) => {
  try {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Get current membership
      const currentQuery = "SELECT * FROM user_memberships WHERE user_id = $1";
      const currentResult = await client.query(currentQuery, [userId]);
      const currentMembership = currentResult.rows[0];

      if (!currentMembership) {
        throw new Error("User membership not found");
      }

      // Get tier details
      const tierQuery = "SELECT * FROM membership_tiers WHERE id = $1";
      const tierResult = await client.query(tierQuery, [newTierId]);
      if (tierResult.rows.length === 0) {
        throw new Error("Tier not found");
      }

      const newTier = tierResult.rows[0];

      // Upgrade membership (effective immediately)
      const updateQuery = `
        UPDATE user_memberships 
        SET tier_id = $1, membership_status = 'active', updated_at = NOW()
        WHERE user_id = $2
        RETURNING *
      `;
      const updateResult = await client.query(updateQuery, [newTierId, userId]);

      // Update users table
      const updateUserQuery = `
        UPDATE users 
        SET current_tier_id = $1, membership_tier_updated_at = NOW()
        WHERE id = $2
      `;
      await client.query(updateUserQuery, [newTierId, userId]);

      // Record in history
      const historyQuery = `
        INSERT INTO membership_history (user_id, from_tier_id, to_tier_id, change_type, completed_date)
        VALUES ($1, $2, $3, 'upgrade', NOW())
      `;
      await client.query(historyQuery, [userId, currentMembership.tier_id, newTierId]);

      await client.query("COMMIT");
      return updateResult.rows[0];
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Error upgrading membership:", err.message);
    throw err;
  }
};

/**
 * Downgrade user membership tier (scheduled for end of billing cycle)
 */
const downgradeMembership = async (userId, newTierId, scheduleDate = null) => {
  try {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Get current membership
      const currentQuery = "SELECT * FROM user_memberships WHERE user_id = $1";
      const currentResult = await client.query(currentQuery, [userId]);
      const currentMembership = currentResult.rows[0];

      if (!currentMembership) {
        throw new Error("User membership not found");
      }

      // Get tier details
      const tierQuery = "SELECT * FROM membership_tiers WHERE id = $1";
      const tierResult = await client.query(tierQuery, [newTierId]);
      if (tierResult.rows.length === 0) {
        throw new Error("Tier not found");
      }

      // Record downgrade as scheduled (not immediate)
      const historyQuery = `
        INSERT INTO membership_history (user_id, from_tier_id, to_tier_id, change_type, scheduled_date, reason)
        VALUES ($1, $2, $3, 'downgrade', $4, 'User-initiated downgrade scheduled for end of billing cycle')
        RETURNING *
      `;
      const scheduledDate = scheduleDate || new Date();
      const historyResult = await client.query(historyQuery, [
        userId,
        currentMembership.tier_id,
        newTierId,
        scheduledDate,
      ]);

      await client.query("COMMIT");
      return historyResult.rows[0];
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Error downgrading membership:", err.message);
    throw err;
  }
};

// ============================================
// ACCOUNT SUSPENSION/REACTIVATION (ACC-FRS-MEM-004, MEM-005)
// ============================================

/**
 * Suspend user account (admin action)
 */
const suspendAccount = async (userId, reason, adminId) => {
  try {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Update user account status
      const updateQuery = `
        UPDATE users 
        SET account_status = 'suspended', suspension_reason = $1, suspended_at = NOW()
        WHERE id = $2
        RETURNING *
      `;
      const updateResult = await client.query(updateQuery, [reason, userId]);

      // Update membership status
      const membershipQuery = `
        UPDATE user_memberships 
        SET membership_status = 'suspended'
        WHERE user_id = $1
      `;
      await client.query(membershipQuery, [userId]);

      // Log the suspension
      const logQuery = `
        INSERT INTO membership_audit_logs (user_id, admin_id, event_type, old_status, new_status, details, outcome)
        VALUES ($1, $2, 'suspension', 'active', 'suspended', $3, 'success')
      `;
      const details = { reason };
      await client.query(logQuery, [userId, adminId, JSON.stringify(details)]);

      await client.query("COMMIT");
      return updateResult.rows[0];
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Error suspending account:", err.message);
    throw err;
  }
};

/**
 * Reactivate suspended user account (admin action)
 */
const reactivateAccount = async (userId, adminId) => {
  try {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Get current user to check previous status
      const userQuery = "SELECT account_status, suspension_reason FROM users WHERE id = $1";
      const userResult = await client.query(userQuery, [userId]);
      if (userResult.rows.length === 0) {
        throw new Error("User not found");
      }

      const oldStatus = userResult.rows[0].account_status;

      // Update user account status
      const updateQuery = `
        UPDATE users 
        SET account_status = 'active', suspension_reason = NULL, reactivated_at = NOW()
        WHERE id = $1
        RETURNING *
      `;
      const updateResult = await client.query(updateQuery, [userId]);

      // Update membership status
      const membershipQuery = `
        UPDATE user_memberships 
        SET membership_status = 'active'
        WHERE user_id = $1
      `;
      await client.query(membershipQuery, [userId]);

      // Log the reactivation
      const logQuery = `
        INSERT INTO membership_audit_logs (user_id, admin_id, event_type, old_status, new_status, outcome)
        VALUES ($1, $2, 'reactivation', $3, 'active', 'success')
      `;
      await client.query(logQuery, [userId, adminId, oldStatus]);

      await client.query("COMMIT");
      return updateResult.rows[0];
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Error reactivating account:", err.message);
    throw err;
  }
};

// ============================================
// USER-INITIATED DEACTIVATION (ACC-FRS-MEM-006)
// ============================================

/**
 * Deactivate user account (user-initiated)
 */
const deactivateAccount = async (userId) => {
  try {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Update user account status
      const updateQuery = `
        UPDATE users 
        SET account_status = 'deactivated'
        WHERE id = $1
        RETURNING *
      `;
      const updateResult = await client.query(updateQuery, [userId]);

      // Update membership status
      const membershipQuery = `
        UPDATE user_memberships 
        SET membership_status = 'deactivated'
        WHERE user_id = $1
      `;
      await client.query(membershipQuery, [userId]);

      // Log the deactivation
      const logQuery = `
        INSERT INTO membership_audit_logs (user_id, event_type, old_status, new_status, outcome)
        VALUES ($1, 'deactivation', 'active', 'deactivated', 'success')
      `;
      await client.query(logQuery, [userId]);

      await client.query("COMMIT");
      return updateResult.rows[0];
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Error deactivating account:", err.message);
    throw err;
  }
};

// ============================================
// MEMBERSHIP EXPIRY MANAGEMENT (ACC-FRS-MEM-007)
// ============================================

/**
 * Check and process expired memberships
 */
const checkAndProcessExpiredMemberships = async () => {
  try {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Find expired memberships
      const expiredQuery = `
        SELECT um.*, u.email, mt.tier_name
        FROM user_memberships um
        JOIN users u ON um.user_id = u.id
        JOIN membership_tiers mt ON um.tier_id = mt.id
        WHERE um.membership_expiry_date < NOW() 
        AND um.membership_status = 'active'
      `;
      const expiredResult = await client.query(expiredQuery);

      // Process each expired membership
      for (const membership of expiredResult.rows) {
        // Downgrade to basic tier
        const basicTierQuery = "SELECT id FROM membership_tiers WHERE tier_name = 'Basic'";
        const basicTierResult = await client.query(basicTierQuery);
        const basicTierId = basicTierResult.rows[0].id;

        // Update membership
        const updateQuery = `
          UPDATE user_memberships 
          SET tier_id = $1, membership_status = 'expired'
          WHERE id = $2
        `;
        await client.query(updateQuery, [basicTierId, membership.id]);

        // Record in history
        const historyQuery = `
          INSERT INTO membership_history (user_id, from_tier_id, to_tier_id, change_type, completed_date, reason)
          VALUES ($1, $2, $3, 'expiry', NOW(), 'Automatic downgrade due to membership expiry')
        `;
        await client.query(historyQuery, [membership.user_id, membership.tier_id, basicTierId]);

        // Log the expiry event
        const logQuery = `
          INSERT INTO membership_audit_logs (user_id, event_type, membership_tier, old_status, new_status, outcome)
          VALUES ($1, 'expiry', $2, 'active', 'expired', 'success')
        `;
        await client.query(logQuery, [membership.user_id, membership.tier_name]);
      }

      await client.query("COMMIT");
      return expiredResult.rows.length;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Error processing expired memberships:", err.message);
    throw err;
  }
};

/**
 * Get membership expiry status for a user
 */
const getMembershipExpiryStatus = async (userId) => {
  try {
    const query = `
      SELECT 
        um.membership_expiry_date,
        um.membership_status,
        mt.tier_name,
        CASE 
          WHEN um.membership_expiry_date IS NULL THEN 'No expiry date'
          WHEN um.membership_expiry_date < NOW() THEN 'Expired'
          WHEN um.membership_expiry_date < NOW() + INTERVAL '7 days' THEN 'Expiring soon'
          ELSE 'Active'
        END as expiry_status,
        (um.membership_expiry_date - NOW()) as time_remaining
      FROM user_memberships um
      JOIN membership_tiers mt ON um.tier_id = mt.id
      WHERE um.user_id = $1
    `;
    const result = await pool.query(query, [userId]);
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (err) {
    console.error("Error fetching expiry status:", err.message);
    throw err;
  }
};

// ============================================
// MEMBERSHIP HISTORY
// ============================================

/**
 * Get membership change history for a user
 */
const getMembershipHistory = async (userId) => {
  try {
    const query = `
      SELECT 
        mh.*,
        ft.tier_name as from_tier,
        tt.tier_name as to_tier
      FROM membership_history mh
      LEFT JOIN membership_tiers ft ON mh.from_tier_id = ft.id
      LEFT JOIN membership_tiers tt ON mh.to_tier_id = tt.id
      WHERE mh.user_id = $1
      ORDER BY mh.created_at DESC
    `;
    const result = await pool.query(query, [userId]);
    return result.rows;
  } catch (err) {
    console.error("Error fetching membership history:", err.message);
    throw err;
  }
};

// ============================================
// MEMBERSHIP AUDIT LOGGING (ACC-FRS-MEM-008)
// ============================================

/**
 * Log membership-related event
 */
const logMembershipAudit = async (auditData) => {
  try {
    const {
      userId,
      adminId = null,
      eventType,
      membershipTier = null,
      oldStatus = null,
      newStatus = null,
      ipAddress = null,
      userAgent = null,
      details = null,
      outcome = "success",
    } = auditData;

    const query = `
      INSERT INTO membership_audit_logs 
      (user_id, admin_id, event_type, membership_tier, old_status, new_status, ip_address, user_agent, details, outcome)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;

    const result = await pool.query(query, [
      userId,
      adminId,
      eventType,
      membershipTier,
      oldStatus,
      newStatus,
      ipAddress,
      userAgent,
      details ? JSON.stringify(details) : null,
      outcome,
    ]);

    return result.rows[0];
  } catch (err) {
    console.error("Error logging membership audit:", err.message);
    throw err;
  }
};

/**
 * Get audit logs for a user
 */
const getUserAuditLogs = async (userId, limit = 50) => {
  try {
    const query = `
      SELECT * FROM membership_audit_logs
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `;
    const result = await pool.query(query, [userId, limit]);
    return result.rows;
  } catch (err) {
    console.error("Error fetching audit logs:", err.message);
    throw err;
  }
};

/**
 * Get all audit logs (admin view)
 */
const getAllAuditLogs = async (limit = 100, offset = 0) => {
  try {
    const query = `
      SELECT 
        mal.*,
        u.email as user_email,
        u.name as user_name,
        admin.email as admin_email
      FROM membership_audit_logs mal
      LEFT JOIN users u ON mal.user_id = u.id
      LEFT JOIN users admin ON mal.admin_id = admin.id
      ORDER BY mal.created_at DESC
      LIMIT $1 OFFSET $2
    `;
    const result = await pool.query(query, [limit, offset]);
    return result.rows;
  } catch (err) {
    console.error("Error fetching all audit logs:", err.message);
    throw err;
  }
};

// ============================================
// ADMIN OPERATIONS
// ============================================

/**
 * Change user membership tier (admin only)
 */
const adminChangeMembershipTier = async (userId, newTierId, reason, adminId) => {
  try {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Get current membership
      const currentQuery = "SELECT * FROM user_memberships WHERE user_id = $1";
      const currentResult = await client.query(currentQuery, [userId]);
      const currentMembership = currentResult.rows[0];

      if (!currentMembership) {
        throw new Error("User membership not found");
      }

      // Update membership
      const updateQuery = `
        UPDATE user_memberships 
        SET tier_id = $1, updated_at = NOW()
        WHERE user_id = $2
        RETURNING *
      `;
      const updateResult = await client.query(updateQuery, [newTierId, userId]);

      // Update users table
      const updateUserQuery = `
        UPDATE users 
        SET current_tier_id = $1, membership_tier_updated_at = NOW()
        WHERE id = $2
      `;
      await client.query(updateUserQuery, [newTierId, userId]);

      // Record in history
      const historyQuery = `
        INSERT INTO membership_history (user_id, from_tier_id, to_tier_id, change_type, completed_date, reason)
        VALUES ($1, $2, $3, 'admin_change', NOW(), $4)
      `;
      await client.query(historyQuery, [userId, currentMembership.tier_id, newTierId, reason]);

      // Log the admin action
      const tierQuery = "SELECT tier_name FROM membership_tiers WHERE id = $1";
      const tierResult = await client.query(tierQuery, [newTierId]);
      const tierName = tierResult.rows[0].tier_name;

      const logQuery = `
        INSERT INTO membership_audit_logs (user_id, admin_id, event_type, membership_tier, old_status, new_status, details, outcome)
        VALUES ($1, $2, 'admin_change', $3, 'N/A', 'N/A', $4, 'success')
      `;
      const details = { reason, changed_by: "admin" };
      await client.query(logQuery, [userId, adminId, tierName, JSON.stringify(details)]);

      await client.query("COMMIT");
      return updateResult.rows[0];
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Error changing membership tier:", err.message);
    throw err;
  }
};

/**
 * Get all users with a specific membership tier
 */
const getUsersByMembershipTier = async (tierId) => {
  try {
    const query = `
      SELECT 
        u.id,
        u.name,
        u.email,
        u.organization_name,
        mt.tier_name,
        um.membership_status,
        um.membership_start_date,
        um.membership_expiry_date
      FROM user_memberships um
      JOIN users u ON um.user_id = u.id
      JOIN membership_tiers mt ON um.tier_id = mt.id
      WHERE um.tier_id = $1
      ORDER BY u.name ASC
    `;
    const result = await pool.query(query, [tierId]);
    return result.rows;
  } catch (err) {
    console.error("Error fetching users by tier:", err.message);
    throw err;
  }
};

/**
 * Get membership statistics
 */
const getMembershipStatistics = async () => {
  try {
    const query = `
      SELECT 
        mt.tier_name,
        mt.tier_level,
        COUNT(um.id) as user_count,
        COUNT(CASE WHEN um.membership_status = 'active' THEN 1 END) as active_count,
        COUNT(CASE WHEN um.membership_status = 'suspended' THEN 1 END) as suspended_count,
        COUNT(CASE WHEN um.membership_status = 'expired' THEN 1 END) as expired_count
      FROM membership_tiers mt
      LEFT JOIN user_memberships um ON mt.id = um.tier_id
      GROUP BY mt.id, mt.tier_name, mt.tier_level
      ORDER BY mt.tier_level ASC
    `;
    const result = await pool.query(query);
    return result.rows;
  } catch (err) {
    console.error("Error fetching membership statistics:", err.message);
    throw err;
  }
};

// Export all functions
module.exports = {
  // Tier operations
  getMembershipTiers,
  getMembershipTierDetails,

  // User membership operations
  getUserMembershipStatus,
  createUserMembership,

  // Upgrade/Downgrade
  upgradeMembership,
  downgradeMembership,

  // Suspension/Reactivation
  suspendAccount,
  reactivateAccount,

  // Deactivation
  deactivateAccount,

  // Expiry management
  checkAndProcessExpiredMemberships,
  getMembershipExpiryStatus,

  // History
  getMembershipHistory,

  // Audit logging
  logMembershipAudit,
  getUserAuditLogs,
  getAllAuditLogs,

  // Admin operations
  adminChangeMembershipTier,
  getUsersByMembershipTier,
  getMembershipStatistics,
};
