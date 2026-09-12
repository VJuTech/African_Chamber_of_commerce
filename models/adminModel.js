const pool = require("../database/connection");

const ADMIN_ROLES = ["super_admin", "platform_admin", "system_admin", "acc_management_admin", "moderator", "support_staff", "compliance_officer"];

async function audit(client, adminId, action, resourceType, resourceId, details = {}, request = {}) {
  const result = await client.query(
    `INSERT INTO admin_audit_logs (admin_id, action, resource_type, resource_id, details, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, created_at`,
    [adminId || null, action, resourceType, resourceId == null ? null : String(resourceId), details, request.ip || null, request.userAgent || null]
  );
  return result.rows[0];
}

async function getDashboard() {
  const [counts, activity, transactions] = await Promise.all([
    pool.query(`SELECT
      (SELECT COUNT(*) FROM users) AS users,
      (SELECT COUNT(*) FROM users WHERE last_login_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours') AS active_users,
      (SELECT COUNT(*) FROM business_accounts) AS businesses,
      (SELECT COUNT(*) FROM business_accounts WHERE status IN ('pending', 'draft') OR verification_status IN ('pending', 'not_started')) AS pending_businesses,
      (SELECT COUNT(*) FROM marketplace_listings WHERE status = 'active') AS active_listings,
      (SELECT COUNT(*) FROM orders WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '30 days') AS transactions,
      (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status IN ('successful', 'completed')) AS payment_volume,
      (SELECT COUNT(*) FROM admin_moderation_reports WHERE status IN ('open', 'reviewing')) AS moderation_queue`),
    pool.query(`SELECT id, action, resource_type, resource_id, outcome, details, created_at
      FROM admin_audit_logs ORDER BY created_at DESC LIMIT 12`),
    pool.query(`SELECT date_trunc('day', created_at) AS day, COUNT(*)::integer AS count
      FROM orders WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '14 days'
      GROUP BY 1 ORDER BY 1`),
  ]);
  return { counts: counts.rows[0], activity: activity.rows, transactions: transactions.rows };
}

async function listUsers(search = "") {
  const term = `%${String(search).trim()}%`;
  const result = await pool.query(`SELECT u.id, u.name, u.email, u.status, u.account_status, u.role, u.email_verified,
      u.last_login_at, u.created_at, COALESCE(string_agg(DISTINCT r.display_name, ', ' ORDER BY r.display_name), '') AS assigned_roles
    FROM users u LEFT JOIN user_roles ur ON ur.user_id = u.id LEFT JOIN roles r ON r.id = ur.role_id
    WHERE ($1 = '%%' OR u.name ILIKE $1 OR u.email ILIKE $1 OR u.role ILIKE $1)
    GROUP BY u.id ORDER BY u.created_at DESC LIMIT 200`, [term]);
  return result.rows;
}

async function listBusinesses(search = "") {
  const term = `%${String(search).trim()}%`;
  const result = await pool.query(`SELECT b.id, b.business_name, b.business_type, b.country_of_registration,
      b.status, b.verification_status, b.verification_notes, b.owner_id, u.name AS owner_name, b.created_at
    FROM business_accounts b JOIN users u ON u.id = b.owner_id
    WHERE ($1 = '%%' OR b.business_name ILIKE $1 OR b.country_of_registration ILIKE $1 OR u.name ILIKE $1)
    ORDER BY b.created_at DESC LIMIT 200`, [term]);
  return result.rows;
}

async function listModeration() {
  const result = await pool.query(`SELECT id, content_type, content_id, reason, details, status, action_taken, created_at, reviewed_at
    FROM admin_moderation_reports WHERE status IN ('open', 'reviewing') ORDER BY created_at ASC LIMIT 200`);
  return result.rows;
}

async function getSettings() {
  const [settings, flags] = await Promise.all([
    pool.query("SELECT * FROM system_settings ORDER BY setting_key"),
    pool.query("SELECT * FROM system_feature_flags ORDER BY display_name"),
  ]);
  return { settings: settings.rows, flags: flags.rows };
}

async function listLogs(search = "") {
  const term = `%${String(search).trim()}%`;
  const [adminLogs, platformLogs] = await Promise.all([
    pool.query(`SELECT l.id, l.action AS event_type, l.resource_type, l.resource_id, l.outcome, l.details, l.created_at,
        u.name AS actor_name FROM admin_audit_logs l LEFT JOIN users u ON u.id = l.admin_id
      WHERE ($1 = '%%' OR l.action ILIKE $1 OR l.resource_type ILIKE $1 OR l.outcome ILIKE $1 OR l.details::text ILIKE $1)
      ORDER BY l.created_at DESC LIMIT 200`, [term]),
    pool.query(`SELECT a.id, a.event_type, 'platform' AS resource_type, a.user_id::text AS resource_id, a.outcome, a.details, a.created_at,
        u.name AS actor_name FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id
      WHERE ($1 = '%%' OR a.event_type ILIKE $1 OR a.outcome ILIKE $1 OR a.details::text ILIKE $1)
      ORDER BY a.created_at DESC LIMIT 200`, [term]),
  ]);
  return [...adminLogs.rows, ...platformLogs.rows].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 250);
}

async function updateUserStatus(adminId, userId, status, request) {
  if (!["active", "suspended", "inactive"].includes(status)) throw new Error("Invalid account status.");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query("UPDATE users SET status = $1::varchar, account_status = $1::varchar, suspension_reason = CASE WHEN $1::varchar = 'suspended' THEN suspension_reason ELSE NULL END, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, status", [status, Number(userId)]);
    if (!result.rowCount) throw new Error("User account was not found.");
    await audit(client, adminId, `user_${status}`, "user", userId, { status }, request);
    await client.query("COMMIT");
    return result.rows[0];
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}

async function updateBusiness(adminId, businessId, action, notes, request) {
  const actions = { approve: ["verified", "approved"], verify: ["verified", "approved"], restrict: ["restricted", "restricted"], remove: ["removed", "rejected"] };
  if (!actions[action]) throw new Error("Invalid business action.");
  const [status, verificationStatus] = actions[action];
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(`UPDATE business_accounts SET status = $1::varchar, verification_status = $2::varchar,
      verification_notes = COALESCE($3::text, verification_notes), verified_at = CASE WHEN $2::varchar = 'approved' THEN CURRENT_TIMESTAMP ELSE verified_at END,
      rejected_reason = CASE WHEN $2::varchar = 'rejected' THEN $3::text ELSE rejected_reason END, updated_at = CURRENT_TIMESTAMP WHERE id = $4 RETURNING id, status, verification_status`, [status, verificationStatus, notes || null, Number(businessId)]);
    if (!result.rowCount) throw new Error("Business was not found.");
    await audit(client, adminId, `business_${action}`, "business", businessId, { action, notes }, request);
    await client.query("COMMIT");
    return result.rows[0];
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}

async function moderate(adminId, reportId, action, request) {
  const actions = { remove: "removed", dismiss: "dismissed", resolve: "resolved" };
  if (!actions[action]) throw new Error("Invalid moderation action.");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const report = await client.query("SELECT * FROM admin_moderation_reports WHERE id = $1 FOR UPDATE", [Number(reportId)]);
    if (!report.rowCount) throw new Error("Moderation report was not found.");
    const item = report.rows[0];
    if (action === "remove") {
      if (item.content_type === "listing") await client.query("UPDATE marketplace_listings SET status = 'removed', visibility = 'private', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [item.content_id]);
      if (item.content_type === "review") await client.query("UPDATE business_reviews SET status = 'removed', flagged = TRUE, moderation_note = 'Removed by administration', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [item.content_id]);
      if (item.content_type === "message") await client.query("INSERT INTO message_deletions (message_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [item.content_id, adminId]);
    }
    await client.query("UPDATE admin_moderation_reports SET status = $1, action_taken = $2, reviewed_by = $3, reviewed_at = CURRENT_TIMESTAMP WHERE id = $4", [actions[action], action, adminId, Number(reportId)]);
    await audit(client, adminId, `moderation_${action}`, item.content_type, item.content_id, { reportId: Number(reportId) }, request);
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}

async function updateSetting(adminId, key, value, request) { return updateConfig(adminId, "system_settings", key, value, request); }
async function updateFeature(adminId, key, enabled, request) { return updateConfig(adminId, "system_feature_flags", key, enabled, request); }
async function updateConfig(adminId, table, key, value, request) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = table === "system_settings"
      ? await client.query("UPDATE system_settings SET setting_value = $1, updated_by = $2, updated_at = CURRENT_TIMESTAMP WHERE setting_key = $3 RETURNING *", [value, adminId, key])
      : await client.query("UPDATE system_feature_flags SET enabled = $1, updated_by = $2, updated_at = CURRENT_TIMESTAMP WHERE feature_key = $3 RETURNING *", [Boolean(value), adminId, key]);
    if (!result.rowCount) throw new Error("Configuration key was not found.");
    await audit(client, adminId, "configuration_updated", table, key, { value }, request);
    await client.query("COMMIT");
    return result.rows[0];
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}

async function getReport(type) {
  if (type === "users") return (await pool.query("SELECT id, name, email, status, role, country, created_at, last_login_at FROM users ORDER BY created_at DESC")).rows;
  if (type === "transactions") return (await pool.query("SELECT o.id, o.created_at, o.status, o.payment_status, o.total_price, o.currency, b.name AS buyer_name, s.name AS seller_name FROM orders o JOIN users b ON b.id = o.buyer_id JOIN users s ON s.id = o.seller_id ORDER BY o.created_at DESC")).rows;
  if (type === "financial") return (await pool.query("SELECT id, transaction_id, amount, currency, status, provider, initiated_at, processed_at FROM payments ORDER BY initiated_at DESC")).rows;
  throw new Error("Unknown report type.");
}

module.exports = { ADMIN_ROLES, getDashboard, listUsers, listBusinesses, listModeration, getSettings, listLogs, updateUserStatus, updateBusiness, moderate, updateSetting, updateFeature, getReport };
