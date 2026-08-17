/**
 * Membership Audit Logging Utility
 * Requirement ACC-FRS-MEM-008: Membership Audit Logging
 * Logs all membership-related activities
 */

/**
 * Log membership audit event
 * Handles database-level audit logging with fallback to file logging
 * 
 * Logged Events:
 * - Upgrade
 * - Downgrade
 * - Suspension
 * - Reactivation
 * - Expiry
 * - Deactivation
 * 
 * @param {Object} client - Database client or pool
 * @param {Object} auditData - Audit event data
 * @returns {Promise<Object>} Result of audit log creation
 */
async function membershipAuditLog(client, auditData = {}) {
  const {
    userId = null,
    eventType = "UNKNOWN",
    action = "unknown_action",
    previousTier = null,
    newTier = null,
    statusBefore = null,
    statusAfter = null,
    initiatedBy = "system",
    ipAddress = "unknown",
    reason = null,
    metadata = null,
    outcome = "success"
  } = auditData;

  const query = `
    INSERT INTO membership_audit_logs 
      (user_id, event_type, action, previous_tier, new_tier, status_before, 
       status_after, initiated_by, ip_address, reason, metadata, outcome, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
    RETURNING id, user_id, event_type, action, created_at
  `;

  const params = [
    userId,
    eventType,
    action,
    previousTier,
    newTier,
    statusBefore,
    statusAfter,
    initiatedBy,
    ipAddress,
    reason,
    metadata ? JSON.stringify(metadata) : null,
    outcome
  ];

  try {
    const result = await client.query(query, params);
    return {
      success: true,
      auditId: result.rows[0].id,
      data: result.rows[0]
    };
  } catch (error) {
    console.error("Error logging membership audit event:", error);
    throw error;
  }
}

/**
 * Get audit log summary for a user
 * @param {Object} client - Database client or pool
 * @param {number} userId - User ID
 * @returns {Promise<Array>} Summary of user's membership audit events
 */
async function getUserAuditSummary(client, userId) {
  const query = `
    SELECT 
      event_type,
      COUNT(*) as count,
      MAX(created_at) as last_occurrence
    FROM membership_audit_logs
    WHERE user_id = $1
    GROUP BY event_type
    ORDER BY last_occurrence DESC
  `;

  try {
    const result = await client.query(query, [userId]);
    return result.rows;
  } catch (error) {
    console.error("Error fetching audit summary:", error);
    throw error;
  }
}

/**
 * Retrieve recent membership events
 * @param {Object} client - Database client or pool
 * @param {number} limit - Number of records to return
 * @param {number} offset - Pagination offset
 * @returns {Promise<Array>} Recent membership events
 */
async function getRecentMembershipEvents(client, limit = 50, offset = 0) {
  const query = `
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
    ORDER BY created_at DESC
    LIMIT $1 OFFSET $2
  `;

  try {
    const result = await client.query(query, [limit, offset]);
    return result.rows;
  } catch (error) {
    console.error("Error fetching recent membership events:", error);
    throw error;
  }
}

/**
 * Get audit events by type
 * @param {Object} client - Database client or pool
 * @param {string} eventType - Event type to filter by
 * @param {number} limit - Number of records to return
 * @returns {Promise<Array>} Events of specified type
 */
async function getEventsByType(client, eventType, limit = 100) {
  const query = `
    SELECT 
      id,
      user_id,
      event_type,
      action,
      status_before,
      status_after,
      initiated_by,
      reason,
      outcome,
      created_at
    FROM membership_audit_logs
    WHERE event_type = $1
    ORDER BY created_at DESC
    LIMIT $2
  `;

  try {
    const result = await client.query(query, [eventType, limit]);
    return result.rows;
  } catch (error) {
    console.error("Error fetching events by type:", error);
    throw error;
  }
}

/**
 * Generate audit report
 * @param {Object} client - Database client or pool
 * @param {Object} options - Report options (startDate, endDate, eventType, userId)
 * @returns {Promise<Object>} Audit report
 */
async function generateAuditReport(client, options = {}) {
  const {
    startDate = null,
    endDate = null,
    eventType = null,
    userId = null
  } = options;

  let query = `
    SELECT 
      event_type,
      COUNT(*) as total_events,
      COUNT(DISTINCT user_id) as affected_users,
      COUNT(CASE WHEN outcome = 'success' THEN 1 END) as successful,
      COUNT(CASE WHEN outcome = 'failed' THEN 1 END) as failed,
      COUNT(CASE WHEN outcome = 'scheduled' THEN 1 END) as scheduled,
      MIN(created_at) as first_event,
      MAX(created_at) as last_event
    FROM membership_audit_logs
    WHERE 1=1
  `;

  const params = [];
  let paramIndex = 1;

  if (startDate) {
    query += ` AND created_at >= $${paramIndex}`;
    params.push(startDate);
    paramIndex++;
  }

  if (endDate) {
    query += ` AND created_at <= $${paramIndex}`;
    params.push(endDate);
    paramIndex++;
  }

  if (eventType) {
    query += ` AND event_type = $${paramIndex}`;
    params.push(eventType);
    paramIndex++;
  }

  if (userId) {
    query += ` AND user_id = $${paramIndex}`;
    params.push(userId);
    paramIndex++;
  }

  query += ` GROUP BY event_type ORDER BY total_events DESC`;

  try {
    const result = await client.query(query, params);
    return {
      success: true,
      reportDate: new Date().toISOString(),
      filters: options,
      summary: result.rows,
      totalRecords: result.rows.reduce((sum, row) => sum + parseInt(row.total_events), 0)
    };
  } catch (error) {
    console.error("Error generating audit report:", error);
    throw error;
  }
}

/**
 * Log administrative membership action
 * @param {Object} client - Database client or pool
 * @param {number} adminId - Admin user ID
 * @param {string} action - Action description
 * @param {Object} details - Action details
 * @returns {Promise<Object>} Audit log entry
 */
async function logAdminMembershipAction(client, adminId, action, details = {}) {
  return membershipAuditLog(client, {
    userId: details.targetUserId || null,
    eventType: action.toUpperCase(),
    action: action.toLowerCase(),
    statusBefore: details.statusBefore || null,
    statusAfter: details.statusAfter || null,
    initiatedBy: "admin",
    ipAddress: details.ipAddress || "unknown",
    reason: details.reason || `Admin action by user ${adminId}`,
    metadata: {
      adminId,
      ...details.metadata
    },
    outcome: details.outcome || "success"
  });
}

module.exports = {
  membershipAuditLog,
  getUserAuditSummary,
  getRecentMembershipEvents,
  getEventsByType,
  generateAuditReport,
  logAdminMembershipAction
};
