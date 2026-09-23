const crypto = require("crypto");
const pool = require("../database/connection");

const LOG_REQUIREMENTS = [
  ["ACC-FRS-LOG-001", "Event logging", "Critical system events are recorded accurately.", "critical"],
  ["ACC-FRS-LOG-002", "Error logging", "Application errors are captured with diagnostic details.", "critical"],
  ["ACC-FRS-LOG-003", "Log storage", "Logs are centralized and securely accessible.", "critical"],
  ["ACC-FRS-LOG-004", "Error classification", "Errors are categorized as critical, warning, or info.", "high"],
  ["ACC-FRS-LOG-005", "User-friendly error messages", "Users receive understandable error responses.", "critical"],
  ["ACC-FRS-LOG-006", "Error recovery mechanisms", "Retry and fail-safe recovery actions are recorded.", "high"],
  ["ACC-FRS-LOG-007", "Log monitoring", "Anomalies in logs are detected and surfaced.", "critical"],
  ["ACC-FRS-LOG-008", "Log retention policy", "Log retention periods are defined and reviewable.", "medium"],
  ["ACC-FRS-LOG-009", "Secure logging", "Logs are protected against unauthorized modification and access.", "critical"],
  ["ACC-FRS-LOG-010", "Logging audit trail", "Activities can be traced through durable log records.", "critical"],
];

function hashRecord(record) {
  return crypto.createHash("sha256").update(JSON.stringify(record)).digest("hex");
}

async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS application_logs (
      id BIGSERIAL PRIMARY KEY,
      event_type VARCHAR(120) NOT NULL,
      severity VARCHAR(20) NOT NULL DEFAULT 'info' CHECK (severity IN ('critical','warning','info')),
      source VARCHAR(80) NOT NULL DEFAULT 'application',
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      request_id VARCHAR(120),
      method VARCHAR(12),
      path VARCHAR(500),
      outcome VARCHAR(30) NOT NULL DEFAULT 'success',
      message TEXT NOT NULL,
      details JSONB NOT NULL DEFAULT '{}'::jsonb,
      previous_hash VARCHAR(64),
      record_hash VARCHAR(64) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS error_logs (
      id BIGSERIAL PRIMARY KEY,
      application_log_id BIGINT REFERENCES application_logs(id) ON DELETE SET NULL,
      error_name VARCHAR(160),
      error_code VARCHAR(80),
      message TEXT NOT NULL,
      stack_trace TEXT,
      severity VARCHAR(20) NOT NULL CHECK (severity IN ('critical','warning','info')),
      recoverable BOOLEAN NOT NULL DEFAULT FALSE,
      recovery_action VARCHAR(120),
      status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','resolved')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      resolved_at TIMESTAMPTZ
    );
    CREATE TABLE IF NOT EXISTS log_retention_policies (
      id BIGSERIAL PRIMARY KEY,
      log_type VARCHAR(40) NOT NULL UNIQUE CHECK (log_type IN ('application','error','security','audit')),
      retention_days INTEGER NOT NULL CHECK (retention_days > 0),
      active BOOLEAN NOT NULL DEFAULT TRUE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS log_monitor_alerts (
      id BIGSERIAL PRIMARY KEY,
      alert_type VARCHAR(80) NOT NULL,
      severity VARCHAR(20) NOT NULL CHECK (severity IN ('critical','warning','info')),
      message TEXT NOT NULL,
      signature VARCHAR(180),
      occurrence_count INTEGER NOT NULL DEFAULT 1,
      status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','resolved')),
      first_seen_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (alert_type, signature, status)
    );
    CREATE INDEX IF NOT EXISTS application_logs_created_idx ON application_logs(created_at DESC);
    CREATE INDEX IF NOT EXISTS application_logs_severity_idx ON application_logs(severity, created_at DESC);
    CREATE INDEX IF NOT EXISTS error_logs_status_idx ON error_logs(status, severity, created_at DESC);
    CREATE INDEX IF NOT EXISTS log_monitor_alerts_status_idx ON log_monitor_alerts(status, last_seen_at DESC);
  `);
  await pool.query(`INSERT INTO log_retention_policies (log_type, retention_days) VALUES ('application', 365), ('error', 730), ('security', 1095), ('audit', 2555) ON CONFLICT (log_type) DO NOTHING`);
  await pool.query(`INSERT INTO permissions (permission_key, resource, action, description) VALUES ('admin.logging.read','admin_logging','read','View application, error, security, audit, retention, and monitoring logs.'), ('admin.logging.manage','admin_logging','manage','Acknowledge log alerts and manage logging controls.') ON CONFLICT (permission_key) DO NOTHING`);
  await pool.query(`INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r CROSS JOIN permissions p WHERE r.role_key IN ('platform_admin','system_admin','acc_management_admin','super_admin') AND p.permission_key IN ('admin.logging.read','admin.logging.manage') ON CONFLICT DO NOTHING`);
  for (const [requirementId, name, description, priority] of LOG_REQUIREMENTS) {
    await pool.query(`INSERT INTO requirements (requirement_id, name, description, actor, preconditions, postconditions, priority, category, dependencies) VALUES ($1,$2,$3,'Platform operations administrator','PostgreSQL and the application request context are available.','Logging evidence is durable, classified, traceable, and reviewable.',$4,'non_functional',ARRAY['application_logs','error_logs','log_monitor_alerts']) ON CONFLICT (requirement_id) DO NOTHING`, [requirementId, name, description, priority]);
    await pool.query(`INSERT INTO requirement_traceability (requirement_id, user_story, ui_reference, api_reference, database_objects, test_case, sprint, release, coverage_status, notes) SELECT id, $2, 'views/admin/logging.ejs and error responses', 'GET /admin/logging and global error handler', ARRAY['application_logs','error_logs','log_retention_policies','log_monitor_alerts'], 'tests/chapter39-logging.test.js', 'Diagnostics', '1.0', 'complete', 'Chapter 39 logging controls are PostgreSQL-backed.' FROM requirements WHERE requirement_id = $1 ON CONFLICT (requirement_id) DO NOTHING`, [requirementId, `As a platform operator, I want ${name.toLowerCase()} so ACC remains diagnosable and accountable.`]);
  }
}

async function latestHash() {
  const result = await pool.query("SELECT record_hash AS hash FROM application_logs ORDER BY id DESC LIMIT 1");
  return result.rows[0] ? result.rows[0].hash : null;
}

async function recordEvent(input = {}) {
  const details = input.details || {};
  const previousHash = await latestHash();
  const base = { eventType: input.eventType || "system_event", severity: input.severity || "info", source: input.source || "application", userId: input.userId || null, requestId: input.requestId || null, method: input.method || null, path: input.path || null, outcome: input.outcome || "success", message: String(input.message || "System event"), details, previousHash };
  const recordHash = hashRecord(base);
  const result = await pool.query(`INSERT INTO application_logs (event_type, severity, source, user_id, request_id, method, path, outcome, message, details, previous_hash, record_hash) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id, created_at`, [base.eventType, base.severity, base.source, base.userId, base.requestId, base.method, base.path, base.outcome, base.message, base.details, previousHash, recordHash]);
  return { ...result.rows[0], recordHash };
}

async function recordError(error, req, options = {}) {
  const statusCode = Number(options.statusCode || error.statusCode || 500);
  const severity = options.severity || (statusCode >= 500 ? "critical" : statusCode >= 400 ? "warning" : "info");
  const userId = req && req.session && req.session.user ? req.session.user.id : null;
  const event = await recordEvent({ eventType: "error", severity, source: "error_handler", userId, requestId: req && req.id, method: req && req.method, path: req && req.originalUrl, outcome: "failure", message: error && error.message ? error.message : "Unhandled application error", details: { statusCode, errorName: error && error.name, errorCode: error && error.code } });
  await pool.query(`INSERT INTO error_logs (application_log_id, error_name, error_code, message, stack_trace, severity, recoverable, recovery_action) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [event.id, error && error.name, error && error.code, error && error.message ? error.message : String(error), error && error.stack, severity, Boolean(options.recoverable), options.recoveryAction || null]);
  const signature = `${error && error.name || "Error"}:${error && error.code || statusCode}:${req && req.path || "unknown"}`;
  await pool.query(`INSERT INTO log_monitor_alerts (alert_type, severity, message, signature) VALUES ('error_anomaly',$1,$2,$3) ON CONFLICT (alert_type, signature, status) DO UPDATE SET occurrence_count = log_monitor_alerts.occurrence_count + 1, last_seen_at = CURRENT_TIMESTAMP, message = EXCLUDED.message`, [severity, `Error activity detected at ${req && req.path ? req.path : "unknown path"}.`, signature]);
  return event;
}

async function getDashboard(filters = {}) {
  const severity = ["critical", "warning", "info"].includes(filters.severity) ? filters.severity : null;
  const params = severity ? [severity] : [];
  const where = severity ? "WHERE l.severity = $1" : "";
  const [logs, errors, alerts, retention, counts] = await Promise.all([
    pool.query(`SELECT l.id, l.event_type AS "eventType", l.severity, l.source, l.outcome, l.message, l.path, l.method, l.details, l.record_hash AS "recordHash", l.created_at AS "createdAt", u.name AS "userName" FROM application_logs l LEFT JOIN users u ON u.id=l.user_id ${where} ORDER BY l.created_at DESC LIMIT 100`, params),
    pool.query("SELECT id, error_name AS \"errorName\", error_code AS \"errorCode\", message, severity, recoverable, recovery_action AS \"recoveryAction\", status, created_at AS \"createdAt\" FROM error_logs ORDER BY created_at DESC LIMIT 50"),
    pool.query("SELECT id, alert_type AS \"alertType\", severity, message, occurrence_count AS \"occurrenceCount\", status, first_seen_at AS \"firstSeenAt\", last_seen_at AS \"lastSeenAt\" FROM log_monitor_alerts ORDER BY last_seen_at DESC LIMIT 30"),
    pool.query("SELECT log_type AS \"logType\", retention_days AS \"retentionDays\", active, updated_at AS \"updatedAt\" FROM log_retention_policies ORDER BY log_type"),
    pool.query("SELECT COUNT(*)::integer AS total, COUNT(*) FILTER (WHERE severity='critical')::integer AS critical, COUNT(*) FILTER (WHERE severity='warning')::integer AS warnings, COUNT(*) FILTER (WHERE outcome='failure')::integer AS failures FROM application_logs"),
  ]);
  return { logs: logs.rows, errors: errors.rows, alerts: alerts.rows, retention: retention.rows, counts: counts.rows[0] };
}

async function acknowledgeAlert(actorId, alertId, status) {
  if (!["acknowledged", "resolved"].includes(status)) return { success: false, message: "Invalid alert status." };
  const result = await pool.query("UPDATE log_monitor_alerts SET status=$1 WHERE id=$2 RETURNING id", [status, Number(alertId)]);
  if (!result.rowCount) return { success: false, message: "Log alert was not found." };
  await recordEvent({ eventType: "log_alert_updated", severity: "info", source: "logging_admin", userId: actorId, outcome: "success", message: `Log alert ${status}.`, details: { alertId: Number(alertId), status } });
  return { success: true, message: "Log alert updated." };
}

module.exports = { LOG_REQUIREMENTS, ensureSchema, recordEvent, recordError, getDashboard, acknowledgeAlert };
