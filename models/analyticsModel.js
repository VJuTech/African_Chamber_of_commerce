const pool = require("../database/connection");

function rangeBounds(from, to) {
  const end = to ? new Date(`${to}T23:59:59.999Z`) : new Date();
  const start = from ? new Date(`${from}T00:00:00.000Z`) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) throw new Error("Invalid analytics date range.");
  return { start, end };
}

async function ownedBusinessIds(userId) {
  const result = await pool.query(`SELECT id FROM business_accounts WHERE owner_id = $1
    UNION SELECT business_id AS id FROM user_roles ur JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = $1 AND ur.business_id IS NOT NULL AND r.role_key IN ('business_member', 'business_admin')`, [Number(userId)]);
  return result.rows.map((row) => Number(row.id));
}

async function recordEvent({ userId, businessId, eventName, resourceType, resourceId, metadata = {} }) {
  const result = await pool.query(`INSERT INTO analytics_events (user_id, business_id, event_name, resource_type, resource_id, metadata)
    VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, occurred_at`, [userId || null, businessId || null, eventName, resourceType || null, resourceId == null ? null : String(resourceId), metadata]);
  return result.rows[0];
}

async function getDashboard({ userId, global = false, from, to }) {
  const bounds = rangeBounds(from, to);
  const businessIds = global ? [] : await ownedBusinessIds(userId);
  const params = [bounds.start, bounds.end, businessIds.length ? businessIds : [0]];
  const queryParams = global ? params.slice(0, 2) : params;
  const eventScope = global ? "TRUE" : "e.business_id = ANY($3::int[])";
  const orderScope = global ? "TRUE" : "ml.business_id = ANY($3::int[])";
  const [kpis, daily, engagement, listings] = await Promise.all([
    pool.query(`SELECT
      (SELECT COUNT(*) FROM users WHERE created_at BETWEEN $1 AND $2) AS new_users,
      (SELECT COUNT(DISTINCT e.user_id) FROM analytics_events e WHERE e.occurred_at BETWEEN $1 AND $2 AND e.user_id IS NOT NULL AND ${eventScope}) AS active_users,
      (SELECT COUNT(*) FROM orders o LEFT JOIN marketplace_listings ml ON ml.id = o.listing_id WHERE o.created_at BETWEEN $1 AND $2 AND ${orderScope}) AS transactions,
      (SELECT COALESCE(SUM(p.amount), 0) FROM payments p LEFT JOIN orders o ON o.id = p.order_id LEFT JOIN marketplace_listings ml ON ml.id = o.listing_id WHERE p.initiated_at BETWEEN $1 AND $2 AND p.status IN ('successful', 'completed') AND ${orderScope.replace(/ml\.business_id/g, "ml.business_id")}) AS revenue,
      (SELECT COUNT(*) FROM payments WHERE initiated_at BETWEEN $1 AND $2 AND status IN ('successful', 'completed')) AS successful_payments,
      (SELECT COUNT(*) FROM payments WHERE initiated_at BETWEEN $1 AND $2 AND status IN ('failed', 'reversed')) AS failed_payments`, queryParams),
    pool.query(`SELECT day::date, users_count, transactions_count, revenue FROM (
      SELECT date_trunc('day', d)::date AS day,
        (SELECT COUNT(DISTINCT e.user_id) FROM analytics_events e WHERE date_trunc('day', e.occurred_at) = date_trunc('day', d) AND e.event_name = 'user_activity' AND ${eventScope})::integer AS users_count,
        (SELECT COUNT(*) FROM orders o LEFT JOIN marketplace_listings ml ON ml.id = o.listing_id WHERE date_trunc('day', o.created_at) = date_trunc('day', d) AND ${orderScope})::integer AS transactions_count,
        (SELECT COALESCE(SUM(p.amount), 0) FROM payments p LEFT JOIN orders o ON o.id = p.order_id LEFT JOIN marketplace_listings ml ON ml.id = o.listing_id WHERE date_trunc('day', p.initiated_at) = date_trunc('day', d) AND p.status IN ('successful', 'completed') AND ${orderScope}) AS revenue
      FROM generate_series($1::timestamp, $2::timestamp, interval '1 day') d
    ) trend ORDER BY day`, queryParams),
    pool.query(`SELECT e.event_name, COUNT(*)::integer AS count FROM analytics_events e WHERE e.occurred_at BETWEEN $1 AND $2 AND ${eventScope} GROUP BY e.event_name ORDER BY count DESC LIMIT 12`, queryParams),
    pool.query(`SELECT ml.id, ml.title, ml.business_id, COUNT(DISTINCT o.id)::integer AS sales, COALESCE(SUM(o.total_price), 0) AS revenue
      FROM marketplace_listings ml LEFT JOIN orders o ON o.listing_id = ml.id AND o.created_at BETWEEN $1 AND $2
      WHERE ${global ? "TRUE" : "ml.business_id = ANY($3::int[])"} GROUP BY ml.id ORDER BY revenue DESC LIMIT 10`, queryParams),
  ]);
  return { range: bounds, kpis: kpis.rows[0], daily: daily.rows, engagement: engagement.rows, listings: listings.rows, businessIds };
}

async function getReport({ userId, global, type, from, to }) {
  const bounds = rangeBounds(from, to);
  const businessIds = global ? [] : await ownedBusinessIds(userId);
  const idsParam = global ? null : businessIds.length ? businessIds : [0];
  let result;
  if (type === "sales") result = await pool.query(`SELECT o.id, o.created_at, o.status, o.payment_status, o.total_price, o.currency, o.listing_title, b.business_name FROM orders o LEFT JOIN marketplace_listings ml ON ml.id = o.listing_id LEFT JOIN business_accounts b ON b.id = ml.business_id WHERE o.created_at BETWEEN $1 AND $2 AND ($3::boolean OR ml.business_id = ANY($4::int[])) ORDER BY o.created_at DESC`, [bounds.start, bounds.end, global, idsParam]);
  else if (type === "users") result = await pool.query(`SELECT date_trunc('day', created_at)::date AS day, COUNT(*)::integer AS registrations FROM users WHERE created_at BETWEEN $1 AND $2 GROUP BY 1 ORDER BY 1`, [bounds.start, bounds.end]);
  else if (type === "financial") result = await pool.query(`SELECT date_trunc('day', initiated_at)::date AS day, status, COUNT(*)::integer AS payments, COALESCE(SUM(amount), 0) AS amount FROM payments WHERE initiated_at BETWEEN $1 AND $2 GROUP BY 1, status ORDER BY 1, status`, [bounds.start, bounds.end]);
  else throw new Error("Unknown analytics report type.");
  return { rows: result.rows, bounds, type };
}

async function auditReport({ userId, type, format, filters, rowCount }) {
  await pool.query(`INSERT INTO analytics_report_audits (user_id, report_type, format, filters, row_count) VALUES ($1, $2, $3, $4, $5)`, [userId, type, format, filters, rowCount]);
}

async function getBusinessOptions(userId) {
  const result = await pool.query(`SELECT id, business_name FROM business_accounts WHERE owner_id = $1
    UNION SELECT b.id, b.business_name FROM business_accounts b JOIN user_roles ur ON ur.business_id = b.id
      WHERE ur.user_id = $1 ORDER BY business_name`, [Number(userId)]);
  return result.rows;
}

module.exports = { rangeBounds, ownedBusinessIds, recordEvent, getDashboard, getReport, auditReport, getBusinessOptions };
