const crypto = require("crypto");
const pool = require("../database/connection");

const KEY_PREFIX = "acc_live_";
const API_SCOPES = [
  "users.read",
  "businesses.read",
  "listings.read",
  "orders.read",
  "payments.read",
];

function hashSecret(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function createSecret(prefix = KEY_PREFIX) {
  return `${prefix}${crypto.randomBytes(30).toString("base64url")}`;
}

function parseScopes(value) {
  if (Array.isArray(value)) return value.filter((scope) => API_SCOPES.includes(scope));
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed.filter((scope) => API_SCOPES.includes(scope)) : [];
  } catch (error) {
    return [];
  }
}

function normalizeClient(row = {}) {
  return {
    id: Number(row.id),
    ownerId: row.owner_id == null ? null : Number(row.owner_id),
    clientName: row.client_name,
    clientType: row.client_type,
    status: row.status,
    description: row.description || "",
    rateLimitPerMinute: Number(row.rate_limit_per_minute),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    activeKeys: Number(row.active_keys || 0),
    webhookCount: Number(row.webhook_count || 0),
  };
}

async function createClient(ownerId, input = {}) {
  const clientName = String(input.clientName || "").trim().slice(0, 160);
  if (!clientName) return { success: false, message: "Client name is required." };
  const clientType = ["developer", "partner", "mobile", "internal"].includes(input.clientType) ? input.clientType : "partner";
  const rateLimit = Math.max(1, Math.min(10000, Number(input.rateLimitPerMinute) || 60));
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const created = await client.query(
      `INSERT INTO api_clients (owner_id, client_name, client_type, description, rate_limit_per_minute)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [Number(ownerId), clientName, clientType, String(input.description || "").trim().slice(0, 2000), rateLimit]
    );
    const secret = createSecret();
    const key = await client.query(
      `INSERT INTO api_keys (client_id, key_prefix, key_hash, label, scopes)
       VALUES ($1, $2, $3, 'Primary key', $4::jsonb)
       RETURNING id, key_prefix, scopes, created_at`,
      [created.rows[0].id, secret.slice(0, 16), hashSecret(secret), JSON.stringify(parseScopes(input.scopes || API_SCOPES))]
    );
    await client.query(
      `INSERT INTO audit_logs (event_type, user_id, outcome, details)
       VALUES ('api_client_created', $1, 'success', $2::jsonb)`,
      [Number(ownerId), JSON.stringify({ clientId: created.rows[0].id, clientName })]
    );
    await client.query("COMMIT");
    return { success: true, client: normalizeClient(created.rows[0]), apiKey: secret, key: key.rows[0] };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function authenticateKey(secret) {
  if (!secret) return null;
  const result = await pool.query(
    `SELECT c.*, k.id AS api_key_id, k.scopes, k.expires_at, k.status AS key_status
     FROM api_keys k JOIN api_clients c ON c.id = k.client_id
     WHERE k.key_hash = $1 AND k.status = 'active' AND c.status = 'active'
       AND (k.expires_at IS NULL OR k.expires_at > CURRENT_TIMESTAMP)
     LIMIT 1`,
    [hashSecret(secret)]
  );
  if (!result.rows[0]) return null;
  const row = result.rows[0];
  await pool.query("UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE id = $1", [row.api_key_id]);
  return {
    clientId: Number(row.id),
    clientName: row.client_name,
    ownerId: row.owner_id == null ? null : Number(row.owner_id),
    apiKeyId: Number(row.api_key_id),
    scopes: parseScopes(row.scopes),
    rateLimitPerMinute: Number(row.rate_limit_per_minute),
  };
}

async function consumeRateLimit(clientId, limit) {
  const windowStart = new Date(Math.floor(Date.now() / 60000) * 60000);
  const result = await pool.query(
    `INSERT INTO api_rate_limit_windows (client_id, window_started_at, request_count, updated_at)
     VALUES ($1, $2, 1, CURRENT_TIMESTAMP)
     ON CONFLICT (client_id, window_started_at)
     DO UPDATE SET request_count = api_rate_limit_windows.request_count + 1, updated_at = CURRENT_TIMESTAMP
     RETURNING request_count`,
    [Number(clientId), windowStart]
  );
  const count = Number(result.rows[0].request_count);
  return { allowed: count <= Number(limit), count, limit: Number(limit), resetAt: new Date(windowStart.getTime() + 60000) };
}

async function recordRequest(input = {}) {
  await pool.query(
    `INSERT INTO api_request_logs
      (client_id, api_key_id, user_id, method, path, version, status_code, latency_ms, ip_address, user_agent, request_id, error_code, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)`,
    [input.clientId || null, input.apiKeyId || null, input.userId || null, input.method, input.path, input.version || "v1", Number(input.statusCode || 0), Number(input.latencyMs || 0), input.ipAddress || null, input.userAgent || null, input.requestId || null, input.errorCode || null, JSON.stringify(input.metadata || {})]
  );
}

async function listClients() {
  const result = await pool.query(
    `SELECT c.*, COUNT(DISTINCT k.id) FILTER (WHERE k.status = 'active') AS active_keys,
            COUNT(DISTINCT w.id) FILTER (WHERE w.status = 'active') AS webhook_count
     FROM api_clients c
     LEFT JOIN api_keys k ON k.client_id = c.id
     LEFT JOIN webhook_subscriptions w ON w.client_id = c.id
     GROUP BY c.id ORDER BY c.created_at DESC`
  );
  return result.rows.map(normalizeClient);
}

async function revokeKey(actorId, keyId) {
  const result = await pool.query("UPDATE api_keys SET status = 'revoked', revoked_at = CURRENT_TIMESTAMP WHERE id = $1 AND status = 'active' RETURNING client_id", [Number(keyId)]);
  if (!result.rows[0]) return { success: false, message: "API key was not found or already revoked." };
  await pool.query("INSERT INTO audit_logs (event_type, user_id, outcome, details) VALUES ('api_key_revoked', $1, 'success', $2::jsonb)", [Number(actorId), JSON.stringify({ keyId: Number(keyId), clientId: Number(result.rows[0].client_id) })]);
  return { success: true, message: "API key revoked." };
}

async function getUsageSummary() {
  const result = await pool.query(
    `SELECT COUNT(*)::integer AS requests,
            COUNT(*) FILTER (WHERE status_code >= 400)::integer AS errors,
            COALESCE(ROUND(AVG(latency_ms)), 0)::integer AS latency,
            COUNT(DISTINCT client_id)::integer AS clients
     FROM api_request_logs WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'`
  );
  return result.rows[0];
}

async function getRequestLogs() {
  const result = await pool.query(
    `SELECT l.created_at, l.method, l.path, l.status_code, l.latency_ms, c.client_name
     FROM api_request_logs l LEFT JOIN api_clients c ON c.id = l.client_id
     ORDER BY l.created_at DESC LIMIT 100`
  );
  return result.rows;
}

async function createWebhook(actorId, input = {}) {
  const clientId = Number(input.clientId);
  const targetUrl = String(input.targetUrl || "").trim();
  let parsedUrl;
  try { parsedUrl = new URL(targetUrl); } catch (error) { return { success: false, message: "Enter a valid webhook URL." }; }
  if (!/^https:$/.test(parsedUrl.protocol) && process.env.NODE_ENV === "production") return { success: false, message: "Webhook URLs must use HTTPS in production." };
  const eventTypes = String(input.eventTypes || "").split(",").map((item) => item.trim()).filter(Boolean).slice(0, 30);
  if (!clientId || !targetUrl || !eventTypes.length) return { success: false, message: "Client, webhook URL, and at least one event are required." };
  const secret = createSecret("whsec_");
  const result = await pool.query(
    `INSERT INTO webhook_subscriptions (client_id, target_url, secret_hash, event_types)
     VALUES ($1, $2, $3, $4::jsonb) RETURNING id, client_id, target_url, event_types, status, created_at`,
    [clientId, targetUrl, hashSecret(secret), JSON.stringify(eventTypes)]
  );
  await pool.query("INSERT INTO audit_logs (event_type, user_id, outcome, details) VALUES ('webhook_subscription_created', $1, 'success', $2::jsonb)", [Number(actorId), JSON.stringify({ subscriptionId: result.rows[0].id, clientId })]);
  return { success: true, subscription: result.rows[0], secret };
}

async function listWebhooks() {
  const result = await pool.query(
    `SELECT w.id, w.client_id, c.client_name, w.target_url, w.event_types, w.status, w.failure_count, w.last_delivered_at, w.created_at
     FROM webhook_subscriptions w JOIN api_clients c ON c.id = w.client_id ORDER BY w.created_at DESC`
  );
  return result.rows;
}

async function revokeWebhook(actorId, webhookId) {
  const result = await pool.query("UPDATE webhook_subscriptions SET status = 'revoked', updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND status <> 'revoked' RETURNING id", [Number(webhookId)]);
  if (!result.rows[0]) return { success: false, message: "Webhook was not found or already revoked." };
  await pool.query("INSERT INTO audit_logs (event_type, user_id, outcome, details) VALUES ('webhook_subscription_revoked', $1, 'success', $2::jsonb)", [Number(actorId), JSON.stringify({ subscriptionId: Number(webhookId) })]);
  return { success: true, message: "Webhook subscription revoked." };
}

async function retryWebhook(webhookId) {
  const result = await pool.query(
    `UPDATE webhook_deliveries
     SET status = 'retrying', next_attempt_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND status IN ('failed', 'retrying')
     RETURNING id`,
    [Number(webhookId)]
  );
  return result.rows[0] ? { success: true, message: "Webhook delivery queued for retry." } : { success: false, message: "Failed webhook delivery was not found." };
}

module.exports = {
  API_SCOPES,
  hashSecret,
  createClient,
  authenticateKey,
  consumeRateLimit,
  recordRequest,
  listClients,
  revokeKey,
  getUsageSummary,
  getRequestLogs,
  createWebhook,
  listWebhooks,
  revokeWebhook,
  retryWebhook,
};
