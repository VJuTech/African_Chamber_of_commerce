const pool = require("../database/connection");

const CATALOG = [
  ["users", "user", "users", "Profiles, authentication state, preferences, and consent metadata.", 3650, true],
  ["business_accounts", "business", "business_accounts", "Business registration, verification, ownership, and lifecycle data.", 3650, false],
  ["marketplace_listings", "business", "marketplace_listings", "Business listings and publishing state.", 1825, false],
  ["orders", "transaction", "orders", "Commerce order records and lifecycle state.", 3650, true],
  ["payments", "transaction", "payments", "Payment records, gateway status, and settlement references.", 3650, true],
  ["procurement_rfqs", "transaction", "procurement_rfqs", "Procurement requests and sourcing records.", 3650, false],
  ["audit_logs", "system", "audit_logs", "Core application audit events.", 3650, true],
  ["analytics_events", "system", "analytics_events", "Product activity and reporting events.", 1095, true],
  ["notifications", "system", "notifications", "Member notifications and delivery state.", 1095, true],
];

async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS data_catalog_resources (
      id BIGSERIAL PRIMARY KEY,
      resource_key VARCHAR(120) NOT NULL UNIQUE,
      category VARCHAR(40) NOT NULL,
      table_name VARCHAR(120) NOT NULL,
      description TEXT NOT NULL,
      retention_days INTEGER NOT NULL CHECK (retention_days > 0),
      sensitive BOOLEAN NOT NULL DEFAULT FALSE,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS data_integrity_checks (
      id BIGSERIAL PRIMARY KEY,
      check_key VARCHAR(120) NOT NULL,
      status VARCHAR(30) NOT NULL CHECK (status IN ('passed','warning','failed')),
      findings JSONB NOT NULL DEFAULT '{}'::jsonb,
      rows_checked INTEGER NOT NULL DEFAULT 0,
      checked_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
      checked_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS data_archives (
      id BIGSERIAL PRIMARY KEY,
      resource_key VARCHAR(120) NOT NULL REFERENCES data_catalog_resources(resource_key) ON DELETE RESTRICT,
      table_name VARCHAR(120) NOT NULL,
      record_id VARCHAR(120) NOT NULL,
      archived_data JSONB NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'archived' CHECK (status IN ('archived','restored','purged')),
      reason TEXT NOT NULL,
      archived_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
      restored_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
      archived_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      restored_at TIMESTAMPTZ
    );
    CREATE TABLE IF NOT EXISTS data_versions (
      id BIGSERIAL PRIMARY KEY,
      resource_key VARCHAR(120) NOT NULL REFERENCES data_catalog_resources(resource_key) ON DELETE RESTRICT,
      record_id VARCHAR(120) NOT NULL,
      version_number INTEGER NOT NULL CHECK (version_number > 0),
      change_type VARCHAR(30) NOT NULL CHECK (change_type IN ('created','updated','deleted','restored')),
      snapshot JSONB NOT NULL,
      changed_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (resource_key, record_id, version_number)
    );
    CREATE TABLE IF NOT EXISTS data_backup_schedules (
      id BIGSERIAL PRIMARY KEY,
      schedule_key VARCHAR(120) NOT NULL UNIQUE,
      frequency VARCHAR(40) NOT NULL CHECK (frequency IN ('hourly','daily','weekly','monthly')),
      retention_days INTEGER NOT NULL CHECK (retention_days > 0),
      storage_provider VARCHAR(80) NOT NULL,
      storage_reference TEXT,
      encrypted BOOLEAN NOT NULL DEFAULT TRUE,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      last_run_at TIMESTAMPTZ,
      next_run_at TIMESTAMPTZ,
      updated_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS data_recovery_requests (
      id BIGSERIAL PRIMARY KEY,
      backup_id BIGINT,
      target_resource VARCHAR(120),
      target_environment VARCHAR(40) NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','approved','in_progress','completed','rejected')),
      reason TEXT NOT NULL,
      requested_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
      approved_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
      requested_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      completed_at TIMESTAMPTZ,
      notes TEXT
    );
    CREATE TABLE IF NOT EXISTS data_management_audit_logs (
      id BIGSERIAL PRIMARY KEY,
      actor_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
      event_type VARCHAR(120) NOT NULL,
      resource_key VARCHAR(120),
      record_id VARCHAR(120),
      outcome VARCHAR(30) NOT NULL DEFAULT 'success',
      details JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS data_integrity_checks_key_idx ON data_integrity_checks(check_key, checked_at DESC);
    CREATE INDEX IF NOT EXISTS data_archives_resource_idx ON data_archives(resource_key, status, archived_at DESC);
    CREATE INDEX IF NOT EXISTS data_versions_record_idx ON data_versions(resource_key, record_id, version_number DESC);
    CREATE INDEX IF NOT EXISTS data_audit_created_idx ON data_management_audit_logs(created_at DESC);
  `);
  await pool.query(`DO $block$
    BEGIN
      IF to_regclass('public.deployment_backups') IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'data_recovery_requests_backup_id_fkey') THEN
        ALTER TABLE data_recovery_requests ADD CONSTRAINT data_recovery_requests_backup_id_fkey FOREIGN KEY (backup_id) REFERENCES deployment_backups(id) ON DELETE SET NULL;
      END IF;
    END
  $block$;`);
  for (const [key, category, tableName, description, retentionDays, sensitive] of CATALOG) {
    await pool.query(`INSERT INTO data_catalog_resources (resource_key, category, table_name, description, retention_days, sensitive) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (resource_key) DO UPDATE SET description=EXCLUDED.description, retention_days=EXCLUDED.retention_days, sensitive=EXCLUDED.sensitive, updated_at=CURRENT_TIMESTAMP`, [key, category, tableName, description, retentionDays, sensitive]);
  }
  await pool.query(`INSERT INTO data_backup_schedules (schedule_key, frequency, retention_days, storage_provider, encrypted, active) VALUES ('primary-postgresql-daily','daily',35,'encrypted-object-storage',TRUE,TRUE) ON CONFLICT (schedule_key) DO NOTHING`);
  await pool.query(`INSERT INTO permissions (permission_key, resource, action, description) VALUES ('admin.data.read','admin_data','read','View data catalog, integrity, lifecycle, backup, recovery, and audit evidence.'), ('admin.data.manage','admin_data','manage','Manage data integrity checks, archives, versions, backups, and recovery requests.') ON CONFLICT (permission_key) DO NOTHING`);
  await pool.query(`INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r CROSS JOIN permissions p WHERE r.role_key IN ('compliance_officer','platform_admin','system_admin','acc_management_admin','super_admin') AND p.permission_key IN ('admin.data.read','admin.data.manage') ON CONFLICT DO NOTHING`);
}

async function audit(actorUserId, eventType, details = {}, client = pool) {
  const result = await client.query(`INSERT INTO data_management_audit_logs (actor_user_id, event_type, resource_key, record_id, outcome, details) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, event_type AS "eventType", created_at AS "createdAt"`, [actorUserId || null, eventType, details.resourceKey || null, details.recordId == null ? null : String(details.recordId), details.outcome || "success", details.details || {}]);
  return result.rows[0];
}

async function getDashboard() {
  const [catalog, integrity, archives, versions, schedules, recovery, auditLogs] = await Promise.all([
    pool.query(`SELECT resource_key AS "resourceKey", category, table_name AS "tableName", description, retention_days AS "retentionDays", sensitive, active FROM data_catalog_resources WHERE active = TRUE ORDER BY category, resource_key`),
    pool.query(`SELECT DISTINCT ON (check_key) check_key AS "checkKey", status, findings, rows_checked AS "rowsChecked", checked_at AS "checkedAt" FROM data_integrity_checks ORDER BY check_key, checked_at DESC`),
    pool.query(`SELECT id, resource_key AS "resourceKey", table_name AS "tableName", record_id AS "recordId", status, reason, archived_by AS "archivedBy", archived_at AS "archivedAt" FROM data_archives ORDER BY archived_at DESC LIMIT 30`),
    pool.query(`SELECT resource_key AS "resourceKey", COUNT(*)::integer AS versions FROM data_versions GROUP BY resource_key ORDER BY resource_key`),
    pool.query(`SELECT schedule_key AS "scheduleKey", frequency, retention_days AS "retentionDays", storage_provider AS "storageProvider", encrypted, active, last_run_at AS "lastRunAt", next_run_at AS "nextRunAt" FROM data_backup_schedules ORDER BY schedule_key`),
    pool.query(`SELECT id, backup_id AS "backupId", target_resource AS "targetResource", target_environment AS "targetEnvironment", status, reason, requested_at AS "requestedAt" FROM data_recovery_requests ORDER BY requested_at DESC LIMIT 20`),
    pool.query(`SELECT id, actor_user_id AS "actorUserId", event_type AS "eventType", resource_key AS "resourceKey", record_id AS "recordId", outcome, details, created_at AS "createdAt" FROM data_management_audit_logs ORDER BY created_at DESC LIMIT 40`),
  ]);
  return { catalog: catalog.rows, integrity: integrity.rows, archives: archives.rows, versions: versions.rows, schedules: schedules.rows, recovery: recovery.rows, auditLogs: auditLogs.rows };
}

async function runIntegrityChecks(actorUserId) {
  const checks = [
    ["users_without_email", "SELECT COUNT(*)::integer AS count FROM users WHERE email IS NULL OR email = ''", "User records without an email address."],
    ["businesses_without_owner", "SELECT COUNT(*)::integer AS count FROM business_accounts b LEFT JOIN users u ON u.id = b.owner_id WHERE u.id IS NULL", "Business records with a missing owner."],
    ["orders_without_buyer", "SELECT COUNT(*)::integer AS count FROM orders o LEFT JOIN users u ON u.id = o.buyer_id WHERE u.id IS NULL", "Orders with a missing buyer."],
    ["payments_without_order", "SELECT COUNT(*)::integer AS count FROM payments p LEFT JOIN orders o ON o.id = p.order_id WHERE o.id IS NULL", "Payments with a missing order."],
  ];
  const results = [];
  for (const [checkKey, query, description] of checks) {
    const result = await pool.query(query);
    const count = Number(result.rows[0].count);
    const status = count === 0 ? "passed" : "warning";
    const saved = await pool.query(`INSERT INTO data_integrity_checks (check_key, status, findings, rows_checked, checked_by) VALUES ($1,$2,$3,$4,$5) RETURNING check_key AS "checkKey", status, findings, rows_checked AS "rowsChecked", checked_at AS "checkedAt"`, [checkKey, status, { description, count }, count, actorUserId]);
    results.push(saved.rows[0]);
  }
  await audit(actorUserId, "integrity_checks_run", { details: { checks: results.length } });
  return results;
}

async function requestBackup(actorUserId, input = {}) {
  const result = await pool.query(`INSERT INTO deployment_backups (environment_id, backup_type, status, storage_reference, requested_by, notes) VALUES ((SELECT id FROM deployment_environments WHERE environment_key = $1), 'scheduled', 'requested', $2, $3, $4) RETURNING id`, [input.environmentKey || "production", input.storageReference || null, actorUserId, input.notes || "Chapter 35 scheduled data backup request."]);
  await audit(actorUserId, "backup_requested", { details: { backupId: result.rows[0].id, environmentKey: input.environmentKey || "production" } });
  return result.rows[0];
}

async function requestRecovery(actorUserId, input = {}) {
  const result = await pool.query(`INSERT INTO data_recovery_requests (backup_id, target_resource, target_environment, reason, requested_by, notes) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`, [input.backupId || null, input.targetResource || null, input.targetEnvironment || "staging", input.reason, actorUserId, input.notes || null]);
  await audit(actorUserId, "recovery_requested", { details: { recoveryRequestId: result.rows[0].id } });
  return result.rows[0];
}

async function archiveRecord(actorUserId, resourceKey, recordId, snapshot, reason) {
  const result = await pool.query(`INSERT INTO data_archives (resource_key, table_name, record_id, archived_data, reason, archived_by) SELECT resource_key, table_name, $2, $4, $5, $1 FROM data_catalog_resources WHERE resource_key = $3 RETURNING id`, [actorUserId, String(recordId), resourceKey, snapshot, reason]);
  if (!result.rowCount) throw new Error("The data resource is not in the catalog.");
  await audit(actorUserId, "record_archived", { resourceKey, recordId, details: { archiveId: result.rows[0].id, reason } });
  return result.rows[0];
}

async function recordVersion(actorUserId, resourceKey, recordId, changeType, snapshot) {
  const result = await pool.query(`INSERT INTO data_versions (resource_key, record_id, version_number, change_type, snapshot, changed_by) SELECT $1,$2,COALESCE((SELECT MAX(version_number) + 1 FROM data_versions WHERE resource_key=$1 AND record_id=$2),1),$3,$4,$5 RETURNING id, version_number AS "versionNumber"`, [resourceKey, String(recordId), changeType, snapshot, actorUserId]);
  await audit(actorUserId, "data_version_recorded", { resourceKey, recordId, details: { versionId: result.rows[0].id, changeType } });
  return result.rows[0];
}

async function updateRecoveryStatus(actorUserId, requestId, status, notes) {
  const allowed = new Set(["approved", "in_progress", "completed", "rejected"]);
  if (!allowed.has(status)) throw new Error("Unsupported recovery status.");
  const result = await pool.query(`UPDATE data_recovery_requests SET status = $1, approved_by = CASE WHEN $1 = 'approved' THEN $2 ELSE approved_by END, completed_at = CASE WHEN $1 = 'completed' THEN CURRENT_TIMESTAMP ELSE completed_at END, notes = COALESCE($3, notes) WHERE id = $4 RETURNING id, status`, [status, actorUserId, notes || null, requestId]);
  if (!result.rowCount) throw new Error("Recovery request was not found.");
  await audit(actorUserId, "recovery_status_updated", { details: { recoveryRequestId: requestId, status } });
  return result.rows[0];
}

async function updateArchiveStatus(actorUserId, archiveId, status) {
  if (!new Set(["restored", "purged"]).has(status)) throw new Error("Unsupported archive status.");
  const result = await pool.query(`UPDATE data_archives SET status = $1, restored_by = CASE WHEN $1 = 'restored' THEN $2 ELSE restored_by END, restored_at = CASE WHEN $1 = 'restored' THEN CURRENT_TIMESTAMP ELSE restored_at END WHERE id = $3 AND status = 'archived' RETURNING id, status`, [status, actorUserId, archiveId]);
  if (!result.rowCount) throw new Error("Only an active archive can be restored or purged.");
  await audit(actorUserId, `record_${status}`, { details: { archiveId } });
  return result.rows[0];
}

module.exports = { ensureSchema, audit, getDashboard, runIntegrityChecks, requestBackup, requestRecovery, archiveRecord, recordVersion, updateRecoveryStatus, updateArchiveStatus };
