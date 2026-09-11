const os = require("os");
const { performance } = require("perf_hooks");
const pool = require("../database/connection");

function environmentId(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

async function audit(client, actorId, environmentIdValue, eventType, details = {}) {
  await client.query(
    `INSERT INTO deployment_audit_logs (environment_id, actor_id, event_type, outcome, details)
     VALUES ($1, $2, $3, 'success', $4::jsonb)`,
    [environmentIdValue, actorId || null, eventType, JSON.stringify(details)]
  );
}

function runtimeMetrics(startedAt) {
  const memory = process.memoryUsage();
  const totalMemory = os.totalmem() || 1;
  const load = os.loadavg()[0] || 0;
  const cpuPercent = Math.min(100, Math.max(0, (load / Math.max(1, os.cpus().length)) * 100));
  return {
    cpuPercent: Number(cpuPercent.toFixed(2)),
    memoryPercent: Number(((memory.rss / totalMemory) * 100).toFixed(2)),
    responseTimeMs: Math.max(0, Math.round(performance.now() - startedAt)),
    requestCount: 1,
    errorRate: 0,
  };
}

async function recordMetric(environmentKey = process.env.DEPLOYMENT_ENV || "development", startedAt = performance.now()) {
  const environment = await pool.query("SELECT id FROM deployment_environments WHERE environment_key = $1", [environmentKey]);
  if (!environment.rows[0]) return null;
  const metric = runtimeMetrics(startedAt);
  const result = await pool.query(
    `INSERT INTO deployment_metrics (environment_id, cpu_percent, memory_percent, response_time_ms, request_count, error_rate)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, cpu_percent AS "cpuPercent", memory_percent AS "memoryPercent", response_time_ms AS "responseTimeMs", request_count AS "requestCount", error_rate AS "errorRate", captured_at AS "capturedAt"`,
    [environment.rows[0].id, metric.cpuPercent, metric.memoryPercent, metric.responseTimeMs, metric.requestCount, metric.errorRate]
  );
  const environmentIdValue = environment.rows[0].id;
  const thresholds = [
    ["cpu_high", metric.cpuPercent >= 85, `CPU usage reached ${metric.cpuPercent}%.`],
    ["memory_high", metric.memoryPercent >= 85, `Memory usage reached ${metric.memoryPercent}%.`],
    ["response_time_high", metric.responseTimeMs >= 2000, `Response time reached ${metric.responseTimeMs} ms.`],
  ];
  for (const [alertType, triggered, message] of thresholds) {
    if (triggered) {
      await pool.query(
        `INSERT INTO deployment_alerts (environment_id, severity, alert_type, message)
         SELECT $1, 'warning', $2, $3
         WHERE NOT EXISTS (
           SELECT 1 FROM deployment_alerts
           WHERE environment_id = $1 AND alert_type = $2 AND status IN ('open', 'acknowledged')
         )`,
        [environmentIdValue, alertType, message]
      );
    }
  }
  return result.rows[0];
}

async function databaseHealth() {
  const startedAt = performance.now();
  try {
    await pool.query("SELECT 1");
    return { status: "healthy", responseTimeMs: Math.round(performance.now() - startedAt) };
  } catch (error) {
    return { status: "offline", responseTimeMs: null, message: error.message };
  }
}

async function getDashboard() {
  const [environments, releases, metrics, alerts, backups, auditLogs] = await Promise.all([
    pool.query(`SELECT id, environment_key AS "environmentKey", display_name AS "displayName", provider, region, base_url AS "baseUrl", status, desired_instances AS "desiredInstances", min_instances AS "minInstances", max_instances AS "maxInstances", isolation_notes AS "isolationNotes", configuration, updated_at AS "updatedAt" FROM deployment_environments ORDER BY CASE environment_key WHEN 'production' THEN 1 WHEN 'staging' THEN 2 WHEN 'qa' THEN 3 ELSE 4 END`),
    pool.query(`SELECT r.id, r.version, r.commit_sha AS "commitSha", r.status, r.pipeline_url AS "pipelineUrl", r.started_at AS "startedAt", r.completed_at AS "completedAt", e.environment_key AS "environmentKey", e.display_name AS "environmentName" FROM deployment_releases r JOIN deployment_environments e ON e.id = r.environment_id ORDER BY r.started_at DESC LIMIT 12`),
    pool.query(`SELECT m.id, m.cpu_percent AS "cpuPercent", m.memory_percent AS "memoryPercent", m.response_time_ms AS "responseTimeMs", m.request_count AS "requestCount", m.error_rate AS "errorRate", m.captured_at AS "capturedAt", e.environment_key AS "environmentKey" FROM deployment_metrics m JOIN deployment_environments e ON e.id = m.environment_id ORDER BY m.captured_at DESC LIMIT 20`),
    pool.query(`SELECT a.id, a.severity, a.alert_type AS "alertType", a.message, a.status, a.triggered_at AS "triggeredAt", e.environment_key AS "environmentKey" FROM deployment_alerts a LEFT JOIN deployment_environments e ON e.id = a.environment_id ORDER BY a.triggered_at DESC LIMIT 20`),
    pool.query(`SELECT b.id, b.backup_type AS "backupType", b.status, b.storage_reference AS "storageReference", b.size_bytes AS "sizeBytes", b.started_at AS "startedAt", b.completed_at AS "completedAt", b.verified_at AS "verifiedAt", e.environment_key AS "environmentKey" FROM deployment_backups b JOIN deployment_environments e ON e.id = b.environment_id ORDER BY b.started_at DESC LIMIT 12`),
    pool.query(`SELECT d.id, d.event_type AS "eventType", d.outcome, d.details, d.created_at AS "createdAt", e.environment_key AS "environmentKey" FROM deployment_audit_logs d LEFT JOIN deployment_environments e ON e.id = d.environment_id ORDER BY d.created_at DESC LIMIT 12`),
  ]);
  return { environments: environments.rows, releases: releases.rows, metrics: metrics.rows, alerts: alerts.rows, backups: backups.rows, auditLogs: auditLogs.rows, database: await databaseHealth() };
}

async function updateEnvironment(actorId, id, input = {}) {
  const statuses = ["planned", "healthy", "degraded", "maintenance", "offline"];
  const status = String(input.status || "").toLowerCase();
  const desired = Math.max(1, Number(input.desiredInstances) || 1);
  const minimum = Math.max(1, Number(input.minInstances) || 1);
  const maximum = Math.max(minimum, Number(input.maxInstances) || minimum);
  if (!statuses.includes(status)) return { success: false, message: "Select a valid environment status." };
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(`UPDATE deployment_environments SET status = $1, desired_instances = $2, min_instances = $3, max_instances = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5 RETURNING id`, [status, desired, minimum, maximum, Number(id)]);
    if (!result.rowCount) { await client.query("ROLLBACK"); return { success: false, message: "Deployment environment was not found." }; }
    await audit(client, actorId, Number(id), "environment_updated", { status, desired, minimum, maximum });
    await client.query("COMMIT");
    return { success: true, message: "Deployment environment updated." };
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}

async function createRelease(actorId, input = {}) {
  const environment = environmentId(input.environmentId);
  const version = String(input.version || "").trim().slice(0, 120);
  if (!environment || !version) return { success: false, message: "Environment and release version are required." };
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(`INSERT INTO deployment_releases (environment_id, version, commit_sha, pipeline_url, status, deployed_by, notes) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`, [environment, version, String(input.commitSha || "").trim() || null, String(input.pipelineUrl || "").trim() || null, String(input.status || "queued"), actorId, String(input.notes || "").trim() || null]);
    await audit(client, actorId, environment, "release_recorded", { releaseId: result.rows[0].id, version });
    await client.query("COMMIT");
    return { success: true, message: "Release recorded." };
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}

async function createBackup(actorId, input = {}) {
  const environment = environmentId(input.environmentId);
  const backupType = ["scheduled", "manual", "restore_test"].includes(input.backupType) ? input.backupType : "manual";
  if (!environment) return { success: false, message: "Select a deployment environment." };
  const result = await pool.query(`INSERT INTO deployment_backups (environment_id, backup_type, status, storage_reference, requested_by, notes) VALUES ($1, $2, 'requested', $3, $4, $5) RETURNING id`, [environment, backupType, String(input.storageReference || "").trim() || null, actorId, String(input.notes || "").trim() || null]);
  await pool.query(`INSERT INTO deployment_audit_logs (environment_id, actor_id, event_type, outcome, details) VALUES ($1, $2, 'backup_requested', 'success', $3::jsonb)`, [environment, actorId, JSON.stringify({ backupId: result.rows[0].id, backupType })]);
  return { success: true, message: "Backup or restore test recorded for operations." };
}

async function acknowledgeAlert(actorId, id, status) {
  if (!["acknowledged", "resolved"].includes(status)) return { success: false, message: "Invalid alert action." };
  const result = await pool.query(`UPDATE deployment_alerts SET status = $1, acknowledged_at = CASE WHEN $1 = 'acknowledged' THEN CURRENT_TIMESTAMP ELSE acknowledged_at END, acknowledged_by = CASE WHEN $1 = 'acknowledged' THEN $2 ELSE acknowledged_by END, resolved_at = CASE WHEN $1 = 'resolved' THEN CURRENT_TIMESTAMP ELSE resolved_at END WHERE id = $3 RETURNING id`, [status, actorId, Number(id)]);
  return { success: Boolean(result.rowCount), message: result.rowCount ? "Deployment alert updated." : "Deployment alert was not found." };
}

module.exports = { getDashboard, recordMetric, updateEnvironment, createRelease, createBackup, acknowledgeAlert };
