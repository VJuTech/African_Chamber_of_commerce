/**
 * membershipAuditLog.js - Audit logging utility for membership operations
 * Implements ACC-FRS-MEM-008: Membership Audit Logging
 */

const pool = require("../database/connection");

/**
 * Log a membership event
 * Logs all membership-related activities with IP, timestamp, and details
 */
const logMembershipAudit = async (auditData) => {
  try {
    const {
      userId = null,
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
    // Don't throw - audit logging should not block operations
    return null;
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
    return [];
  }
};

/**
 * Get audit logs by event type
 */
const getAuditLogsByEventType = async (eventType, limit = 100) => {
  try {
    const query = `
      SELECT * FROM membership_audit_logs
      WHERE event_type = $1
      ORDER BY created_at DESC
      LIMIT $2
    `;
    const result = await pool.query(query, [eventType, limit]);
    return result.rows;
  } catch (err) {
    console.error("Error fetching logs by event type:", err.message);
    return [];
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
    return [];
  }
};

/**
 * Get audit logs for a date range
 */
const getAuditLogsByDateRange = async (startDate, endDate, limit = 100) => {
  try {
    const query = `
      SELECT * FROM membership_audit_logs
      WHERE created_at BETWEEN $1 AND $2
      ORDER BY created_at DESC
      LIMIT $3
    `;
    const result = await pool.query(query, [startDate, endDate, limit]);
    return result.rows;
  } catch (err) {
    console.error("Error fetching logs by date range:", err.message);
    return [];
  }
};

/**
 * Log upgrade event
 */
const logUpgradeEvent = async (userId, fromTier, toTier, ipAddress, userAgent) => {
  return logMembershipAudit({
    userId,
    eventType: "upgrade",
    membershipTier: toTier,
    oldStatus: "active",
    newStatus: "active",
    ipAddress,
    userAgent,
    outcome: "success",
  });
};

/**
 * Log downgrade event
 */
const logDowngradeEvent = async (userId, fromTier, toTier, ipAddress, userAgent) => {
  return logMembershipAudit({
    userId,
    eventType: "downgrade",
    membershipTier: fromTier,
    oldStatus: "active",
    newStatus: "scheduled",
    ipAddress,
    userAgent,
    outcome: "success",
  });
};

/**
 * Log suspension event
 */
const logSuspensionEvent = async (userId, adminId, reason, ipAddress, userAgent) => {
  return logMembershipAudit({
    userId,
    adminId,
    eventType: "suspension",
    oldStatus: "active",
    newStatus: "suspended",
    ipAddress,
    userAgent,
    details: { reason },
    outcome: "success",
  });
};

/**
 * Log reactivation event
 */
const logReactivationEvent = async (userId, adminId, ipAddress, userAgent) => {
  return logMembershipAudit({
    userId,
    adminId,
    eventType: "reactivation",
    oldStatus: "suspended",
    newStatus: "active",
    ipAddress,
    userAgent,
    outcome: "success",
  });
};

/**
 * Log deactivation event
 */
const logDeactivationEvent = async (userId, ipAddress, userAgent) => {
  return logMembershipAudit({
    userId,
    eventType: "deactivation",
    oldStatus: "active",
    newStatus: "deactivated",
    ipAddress,
    userAgent,
    outcome: "success",
  });
};

/**
 * Log expiry event
 */
const logExpiryEvent = async (userId, tierName, ipAddress = null, userAgent = null) => {
  return logMembershipAudit({
    userId,
    eventType: "expiry",
    membershipTier: tierName,
    oldStatus: "active",
    newStatus: "expired",
    ipAddress,
    userAgent,
    outcome: "success",
  });
};

/**
 * Generate audit report for admin
 */
const generateAuditReport = async (startDate, endDate) => {
  try {
    const logs = await getAuditLogsByDateRange(startDate, endDate, 10000);

    // Group by event type
    const eventTypeSummary = {};
    const userSummary = {};

    logs.forEach((log) => {
      // Count by event type
      eventTypeSummary[log.event_type] = (eventTypeSummary[log.event_type] || 0) + 1;

      // Count by user
      if (log.user_id) {
        if (!userSummary[log.user_id]) {
          userSummary[log.user_id] = {
            events: 0,
            userName: log.user_email,
            lastActivity: log.created_at,
          };
        }
        userSummary[log.user_id].events++;
        userSummary[log.user_id].lastActivity = log.created_at;
      }
    });

    return {
      totalEvents: logs.length,
      dateRange: { startDate, endDate },
      eventTypeSummary,
      userSummary,
      logs,
    };
  } catch (err) {
    console.error("Error generating audit report:", err.message);
    return null;
  }
};

// Export all functions
module.exports = {
  logMembershipAudit,
  getUserAuditLogs,
  getAuditLogsByEventType,
  getAllAuditLogs,
  getAuditLogsByDateRange,
  logUpgradeEvent,
  logDowngradeEvent,
  logSuspensionEvent,
  logReactivationEvent,
  logDeactivationEvent,
  logExpiryEvent,
  generateAuditReport,
};
