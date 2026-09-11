const pool = require("../database/connection");

function platformOperator(req) {
  return req.apiAccess && req.apiAccess.roles.some((role) => ["platform_admin", "system_admin", "acc_management_admin", "super_admin"].includes(role.key));
}

async function listUsers(req, res, next) {
  try {
    const result = await pool.query(
      `SELECT id, name, email, country, status, role, email_verified, created_at
       FROM users ${platformOperator(req) ? "" : "WHERE id = $1"}
       ORDER BY created_at DESC LIMIT 100`,
      platformOperator(req) ? [] : [req.apiClient.ownerId]
    );
    return res.json({ success: true, data: result.rows, meta: { count: result.rowCount, version: req.apiVersion } });
  } catch (error) { return next(error); }
}

async function listBusinesses(req, res, next) {
  try {
    const result = await pool.query(
      `SELECT id, business_name, business_type, country_of_registration, industry_category, status, verification_status, owner_id, created_at
       FROM business_accounts ${platformOperator(req) ? "" : "WHERE owner_id = $1"}
       ORDER BY created_at DESC LIMIT 100`,
      platformOperator(req) ? [] : [req.apiClient.ownerId]
    );
    return res.json({ success: true, data: result.rows, meta: { count: result.rowCount, version: req.apiVersion } });
  } catch (error) { return next(error); }
}

async function listListings(req, res, next) {
  try {
    const result = await pool.query(
      `SELECT id, business_id, user_id, title, description, category, listing_type, price, currency, availability, visibility, status, created_at, updated_at
       FROM marketplace_listings
       WHERE status = 'active' AND visibility = 'public'
       ORDER BY created_at DESC LIMIT 100`
    );
    return res.json({ success: true, data: result.rows, meta: { count: result.rowCount, version: req.apiVersion } });
  } catch (error) { return next(error); }
}

async function listOrders(req, res, next) {
  try {
    const filter = platformOperator(req) ? "" : "WHERE buyer_id = $1 OR seller_id = $1";
    const result = await pool.query(
      `SELECT id, buyer_id, seller_id, listing_id, listing_title, quantity, total_price, currency, payment_status, status, created_at, updated_at
       FROM orders ${filter} ORDER BY created_at DESC LIMIT 100`,
      platformOperator(req) ? [] : [req.apiClient.ownerId]
    );
    return res.json({ success: true, data: result.rows, meta: { count: result.rowCount, version: req.apiVersion } });
  } catch (error) { return next(error); }
}

async function listPayments(req, res, next) {
  try {
    const filter = platformOperator(req) ? "" : "WHERE buyer_id = $1 OR seller_id = $1";
    const result = await pool.query(
      `SELECT id, buyer_id, seller_id, order_id, amount, currency, provider, status, initiated_at, processed_at
       FROM payments ${filter} ORDER BY initiated_at DESC LIMIT 100`,
      platformOperator(req) ? [] : [req.apiClient.ownerId]
    );
    return res.json({ success: true, data: result.rows, meta: { count: result.rowCount, version: req.apiVersion } });
  } catch (error) { return next(error); }
}

function documentation(req, res) {
  return res.json({
    name: "ACC API",
    version: "v1",
    authentication: { apiKey: "Send x-api-key or Authorization: ApiKey <key>" },
    rateLimiting: "Per-client requests per minute; limits are returned in x-ratelimit-* headers.",
    endpoints: [
      { method: "GET", path: "/api/v1/users", scope: "users.read" },
      { method: "GET", path: "/api/v1/businesses", scope: "businesses.read" },
      { method: "GET", path: "/api/v1/listings", scope: "listings.read" },
      { method: "GET", path: "/api/v1/orders", scope: "orders.read" },
      { method: "GET", path: "/api/v1/payments", scope: "payments.read" },
    ],
  });
}

module.exports = { listUsers, listBusinesses, listListings, listOrders, listPayments, documentation };
