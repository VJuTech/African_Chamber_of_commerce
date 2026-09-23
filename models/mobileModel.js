const pool = require("../database/connection");

const MOBILE_REQUIREMENTS = [
  ["ACC-FRS-MOB-001", "Mobile and PWA availability", "Members can access ACC services through responsive web and an installable PWA on Android and iOS.", "high"],
  ["ACC-FRS-MOB-002", "Secure mobile authentication", "Mobile access uses the shared verified account session and exposes optional platform biometric capability detection.", "critical"],
  ["ACC-FRS-MOB-003", "Responsive mobile experience", "Core member workflows remain usable on small touch screens and low bandwidth connections.", "high"],
  ["ACC-FRS-MOB-004", "Push notifications", "The platform stores device push subscriptions and links them to persisted notification preferences.", "high"],
  ["ACC-FRS-MOB-005", "Offline cache and sync", "The client can queue non-sensitive actions offline and reconcile them with PostgreSQL after reconnecting.", "high"],
  ["ACC-FRS-MOB-006", "Camera and document capture", "Authenticated members can submit validated image or document uploads from a mobile device.", "high"],
  ["ACC-FRS-MOB-007", "Location services", "Members can opt in to store coarse location signals for nearby business and delivery experiences.", "medium"],
  ["ACC-FRS-MOB-008", "Backend synchronization", "Mobile device state, sync operations, and upload metadata are durable and auditable in PostgreSQL.", "critical"],
  ["ACC-FRS-MOB-009", "Low-bandwidth performance", "Mobile responses support compact payloads, cache headers, and connection-aware client behavior.", "high"],
  ["ACC-FRS-MOB-010", "Secure storage and transport", "Sensitive data remains server-side, sessions are HttpOnly, and mobile endpoints validate ownership and input.", "critical"],
];

async function ensureSchema() {
  await pool.query(`
    ALTER TABLE requirements DROP CONSTRAINT IF EXISTS requirements_requirement_id_check;
    ALTER TABLE requirements ADD CONSTRAINT requirements_requirement_id_check CHECK (requirement_id ~ '^(FR-[A-Z0-9]+|ACC-FRS-(PERF|MOB))-[0-9]{3}$');
    CREATE TABLE IF NOT EXISTS mobile_devices (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      installation_id VARCHAR(180) NOT NULL,
      platform VARCHAR(20) NOT NULL CHECK (platform IN ('android','ios','web','other')),
      device_label VARCHAR(120),
      user_agent VARCHAR(500),
      capabilities JSONB NOT NULL DEFAULT '{}'::jsonb,
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, installation_id)
    );
    CREATE TABLE IF NOT EXISTS mobile_push_subscriptions (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      device_id BIGINT REFERENCES mobile_devices(id) ON DELETE CASCADE,
      endpoint TEXT NOT NULL UNIQUE,
      subscription JSONB NOT NULL,
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS mobile_sync_queue (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      device_id BIGINT REFERENCES mobile_devices(id) ON DELETE SET NULL,
      client_action_id VARCHAR(180) NOT NULL,
      action_type VARCHAR(80) NOT NULL,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      status VARCHAR(20) NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','synced','rejected')),
      error_message TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      synced_at TIMESTAMPTZ,
      UNIQUE(user_id, client_action_id)
    );
    CREATE TABLE IF NOT EXISTS mobile_location_events (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      device_id BIGINT REFERENCES mobile_devices(id) ON DELETE SET NULL,
      latitude NUMERIC(9,6) NOT NULL CHECK (latitude BETWEEN -90 AND 90),
      longitude NUMERIC(9,6) NOT NULL CHECK (longitude BETWEEN -180 AND 180),
      accuracy_m NUMERIC(10,2),
      purpose VARCHAR(40) NOT NULL DEFAULT 'nearby_search',
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS mobile_uploads (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      device_id BIGINT REFERENCES mobile_devices(id) ON DELETE SET NULL,
      original_name VARCHAR(255) NOT NULL,
      stored_path VARCHAR(500) NOT NULL,
      mime_type VARCHAR(120) NOT NULL,
      size_bytes INTEGER NOT NULL CHECK (size_bytes > 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS mobile_devices_user_idx ON mobile_devices(user_id, last_seen_at DESC);
    CREATE INDEX IF NOT EXISTS mobile_sync_queue_user_idx ON mobile_sync_queue(user_id, status, created_at);
    CREATE INDEX IF NOT EXISTS mobile_location_user_idx ON mobile_location_events(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS mobile_uploads_user_idx ON mobile_uploads(user_id, created_at DESC);
  `);
  await pool.query(`INSERT INTO permissions (permission_key, resource, action, description) VALUES ('mobile.access','mobile','access','Use the authenticated ACC mobile and PWA experience.') ON CONFLICT (permission_key) DO NOTHING`);
  for (const [requirementId, name, description, priority] of MOBILE_REQUIREMENTS) {
    await pool.query(`INSERT INTO requirements (requirement_id, name, description, actor, preconditions, postconditions, priority, category, dependencies) VALUES ($1,$2,$3,'ACC member','A verified ACC account and PostgreSQL are available.','Mobile activity is validated and persisted.',$4,'functional',ARRAY['mobile_devices','mobile_sync_queue']) ON CONFLICT (requirement_id) DO NOTHING`, [requirementId, name, description, priority]);
  }
}

function mapDevice(row) {
  return row ? { id: String(row.id), installationId: row.installation_id, platform: row.platform, deviceLabel: row.device_label, capabilities: row.capabilities || {}, lastSeenAt: new Date(row.last_seen_at).toISOString() } : null;
}

async function registerDevice(userId, input = {}) {
  const installationId = String(input.installationId || "").trim().slice(0, 180);
  if (!installationId) throw new Error("installationId is required");
  const platform = ["android", "ios", "web", "other"].includes(input.platform) ? input.platform : "web";
  const result = await pool.query(`INSERT INTO mobile_devices (user_id, installation_id, platform, device_label, user_agent, capabilities, last_seen_at) VALUES ($1,$2,$3,$4,$5,$6,CURRENT_TIMESTAMP) ON CONFLICT (user_id, installation_id) DO UPDATE SET platform=EXCLUDED.platform, device_label=EXCLUDED.device_label, user_agent=EXCLUDED.user_agent, capabilities=EXCLUDED.capabilities, last_seen_at=CURRENT_TIMESTAMP RETURNING *`, [userId, installationId, platform, String(input.deviceLabel || "ACC mobile").slice(0, 120), String(input.userAgent || "").slice(0, 500), input.capabilities || {}]);
  return mapDevice(result.rows[0]);
}

async function savePushSubscription(userId, deviceId, subscription) {
  const endpoint = String(subscription && subscription.endpoint || "").trim();
  if (!endpoint || endpoint.length > 2048) throw new Error("A valid push endpoint is required");
  const result = await pool.query(`INSERT INTO mobile_push_subscriptions (user_id, device_id, endpoint, subscription, last_seen_at) VALUES ($1,$2,$3,$4,CURRENT_TIMESTAMP) ON CONFLICT (endpoint) DO UPDATE SET user_id=EXCLUDED.user_id, device_id=EXCLUDED.device_id, subscription=EXCLUDED.subscription, enabled=TRUE, last_seen_at=CURRENT_TIMESTAMP RETURNING id`, [userId, deviceId || null, endpoint, subscription]);
  return { id: String(result.rows[0].id), enabled: true };
}

async function queueAction(userId, input = {}) {
  const clientActionId = String(input.clientActionId || "").trim().slice(0, 180);
  const actionType = String(input.actionType || "").trim().slice(0, 80);
  if (!clientActionId || !actionType) throw new Error("clientActionId and actionType are required");
  const result = await pool.query(`INSERT INTO mobile_sync_queue (user_id, device_id, client_action_id, action_type, payload) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (user_id, client_action_id) DO UPDATE SET payload=EXCLUDED.payload RETURNING id, status, created_at`, [userId, input.deviceId || null, clientActionId, actionType, input.payload || {}]);
  return { id: String(result.rows[0].id), status: result.rows[0].status, createdAt: new Date(result.rows[0].created_at).toISOString() };
}

async function syncActions(userId, deviceId) {
  const result = await pool.query(`UPDATE mobile_sync_queue SET status='synced', synced_at=CURRENT_TIMESTAMP WHERE user_id=$1 AND status='queued' AND ($2::bigint IS NULL OR device_id=$2) RETURNING id, client_action_id AS "clientActionId", action_type AS "actionType", payload, status, synced_at AS "syncedAt"`, [userId, deviceId || null]);
  return result.rows.map((row) => ({ ...row, id: String(row.id), syncedAt: new Date(row.syncedAt).toISOString() }));
}

async function recordLocation(userId, input = {}) {
  const latitude = Number(input.latitude); const longitude = Number(input.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) throw new Error("Valid coordinates are required");
  const result = await pool.query(`INSERT INTO mobile_location_events (user_id, device_id, latitude, longitude, accuracy_m, purpose) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, latitude, longitude, accuracy_m AS "accuracyM", purpose, created_at AS "createdAt"`, [userId, input.deviceId || null, latitude, longitude, Number.isFinite(Number(input.accuracyM)) ? Number(input.accuracyM) : null, String(input.purpose || "nearby_search").slice(0, 40)]);
  return { ...result.rows[0], id: String(result.rows[0].id), createdAt: new Date(result.rows[0].createdAt).toISOString() };
}

async function recordUpload(userId, deviceId, file) {
  const result = await pool.query(`INSERT INTO mobile_uploads (user_id, device_id, original_name, stored_path, mime_type, size_bytes) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, original_name AS "originalName", stored_path AS "storedPath", mime_type AS "mimeType", size_bytes AS "sizeBytes", created_at AS "createdAt"`, [userId, deviceId || null, file.originalname, file.path, file.mimetype, file.size]);
  return { ...result.rows[0], id: String(result.rows[0].id), createdAt: new Date(result.rows[0].createdAt).toISOString() };
}

async function getMobileSummary(userId) {
  const [devices, queue, uploads] = await Promise.all([pool.query("SELECT * FROM mobile_devices WHERE user_id=$1 ORDER BY last_seen_at DESC", [userId]), pool.query("SELECT COUNT(*)::int AS queued FROM mobile_sync_queue WHERE user_id=$1 AND status='queued'", [userId]), pool.query("SELECT COUNT(*)::int AS uploads FROM mobile_uploads WHERE user_id=$1", [userId])]);
  return { devices: devices.rows.map(mapDevice), queuedActions: queue.rows[0].queued, uploads: uploads.rows[0].uploads };
}

module.exports = { MOBILE_REQUIREMENTS, ensureSchema, registerDevice, savePushSubscription, queueAction, syncActions, recordLocation, recordUpload, getMobileSummary };
