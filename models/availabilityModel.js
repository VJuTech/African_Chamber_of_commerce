const { performance } = require("perf_hooks");
const pool = require("../database/connection");
const notificationModel = require("./notificationModel");

const AVAILABILITY_REQUIREMENTS = [
  ["ACC-FRS-AVAIL-001", "High availability", "The system shall maintain at least 99.9% uptime with availability evidence persisted for review.", "critical"],
  ["ACC-FRS-AVAIL-002", "Fault tolerance", "The system shall continue functioning when a monitored component fails.", "critical"],
  ["ACC-FRS-AVAIL-003", "Redundant infrastructure", "The platform shall record redundant services and backup infrastructure supporting continuity.", "critical"],
  ["ACC-FRS-AVAIL-004", "Automatic failover", "The platform shall detect an unavailable service and record an automatic failover action.", "critical"],
  ["ACC-FRS-AVAIL-005", "System health monitoring", "The platform shall continuously persist service health and response-time checks.", "critical"],
  ["ACC-FRS-AVAIL-006", "Error recovery", "The platform shall record retry and recovery actions for failed services.", "high"],
  ["ACC-FRS-AVAIL-007", "Graceful degradation", "The platform shall identify non-critical features that can be degraded while core services remain available.", "high"],
  ["ACC-FRS-AVAIL-008", "Backup systems availability", "The platform shall track whether backup systems are ready and when they were last verified.", "critical"],
  ["ACC-FRS-AVAIL-009", "Incident alerting", "The platform shall create immediate administrator alerts for availability incidents.", "critical"],
  ["ACC-FRS-AVAIL-010", "Availability audit logging", "Downtime, failover, and recovery actions shall be recorded in an auditable PostgreSQL log.", "high"],
];

async function ensureSchema() {
  await pool.query(`
    ALTER TABLE requirements DROP CONSTRAINT IF EXISTS requirements_requirement_id_check;
    ALTER TABLE requirements ADD CONSTRAINT requirements_requirement_id_check CHECK (requirement_id ~ '^(FR-[A-Z0-9]+|ACC-FRS-(PERF|MOB|AVAIL|SUP|LOG|QA|REL|ONB|AI|PART|ROAD))-[0-9]{3}$');
    CREATE TABLE IF NOT EXISTS availability_services (
      id BIGSERIAL PRIMARY KEY,
      service_key VARCHAR(120) NOT NULL UNIQUE,
      display_name VARCHAR(160) NOT NULL,
      criticality VARCHAR(20) NOT NULL DEFAULT 'critical' CHECK (criticality IN ('critical','non_critical')),
      health_url VARCHAR(500),
      expected_response_ms INTEGER NOT NULL DEFAULT 2000 CHECK (expected_response_ms > 0),
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      degraded_mode BOOLEAN NOT NULL DEFAULT FALSE,
      backup_service_key VARCHAR(120),
      last_status VARCHAR(20) NOT NULL DEFAULT 'unknown' CHECK (last_status IN ('healthy','degraded','failed','unknown')),
      last_checked_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS availability_health_checks (
      id BIGSERIAL PRIMARY KEY,
      service_id BIGINT NOT NULL REFERENCES availability_services(id) ON DELETE CASCADE,
      status VARCHAR(20) NOT NULL CHECK (status IN ('healthy','degraded','failed')),
      response_time_ms INTEGER,
      http_status INTEGER,
      error_message TEXT,
      checked_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS availability_redundancy_components (
      id BIGSERIAL PRIMARY KEY,
      component_key VARCHAR(120) NOT NULL UNIQUE,
      component_type VARCHAR(40) NOT NULL CHECK (component_type IN ('application','database','backup','network','service')),
      primary_reference VARCHAR(255) NOT NULL,
      secondary_reference VARCHAR(255),
      status VARCHAR(20) NOT NULL DEFAULT 'ready' CHECK (status IN ('ready','degraded','unavailable','testing')),
      failover_mode VARCHAR(30) NOT NULL DEFAULT 'automatic' CHECK (failover_mode IN ('automatic','manual','none')),
      last_verified_at TIMESTAMPTZ,
      notes TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS availability_incidents (
      id BIGSERIAL PRIMARY KEY,
      service_id BIGINT REFERENCES availability_services(id) ON DELETE SET NULL,
      severity VARCHAR(20) NOT NULL CHECK (severity IN ('warning','critical')),
      incident_type VARCHAR(40) NOT NULL CHECK (incident_type IN ('downtime','degraded','health_check_failure','database_failure')),
      title VARCHAR(200) NOT NULL,
      details JSONB NOT NULL DEFAULT '{}'::jsonb,
      status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open','investigating','resolved')),
      detected_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      resolved_at TIMESTAMPTZ,
      resolved_by INTEGER REFERENCES users(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS availability_failover_events (
      id BIGSERIAL PRIMARY KEY,
      service_id BIGINT REFERENCES availability_services(id) ON DELETE SET NULL,
      from_reference VARCHAR(255),
      to_reference VARCHAR(255),
      trigger_type VARCHAR(30) NOT NULL CHECK (trigger_type IN ('automatic','manual','test')),
      outcome VARCHAR(30) NOT NULL CHECK (outcome IN ('initiated','completed','failed')),
      details JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS availability_recovery_actions (
      id BIGSERIAL PRIMARY KEY,
      incident_id BIGINT REFERENCES availability_incidents(id) ON DELETE SET NULL,
      action_type VARCHAR(40) NOT NULL CHECK (action_type IN ('retry','restart','degrade','restore','failover')),
      status VARCHAR(30) NOT NULL DEFAULT 'completed' CHECK (status IN ('requested','in_progress','completed','failed')),
      attempts INTEGER NOT NULL DEFAULT 1 CHECK (attempts > 0),
      notes TEXT,
      actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS availability_audit_logs (
      id BIGSERIAL PRIMARY KEY,
      event_type VARCHAR(80) NOT NULL,
      incident_id BIGINT REFERENCES availability_incidents(id) ON DELETE SET NULL,
      service_id BIGINT REFERENCES availability_services(id) ON DELETE SET NULL,
      outcome VARCHAR(30) NOT NULL,
      details JSONB NOT NULL DEFAULT '{}'::jsonb,
      actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS availability_checks_service_idx ON availability_health_checks(service_id, checked_at DESC);
    CREATE INDEX IF NOT EXISTS availability_incidents_status_idx ON availability_incidents(status, detected_at DESC);
    CREATE INDEX IF NOT EXISTS availability_audit_created_idx ON availability_audit_logs(created_at DESC);
  `);
  await pool.query(`INSERT INTO availability_services (service_key, display_name, criticality, health_url, backup_service_key) VALUES
    ('postgresql', 'PostgreSQL database', 'critical', '/healthz', NULL),
    ('web_application', 'ACC web application', 'critical', '/healthz', 'web_application_backup'),
    ('notifications', 'Notification delivery', 'non_critical', '/healthz', NULL),
    ('assistant', 'ACC Assistance', 'non_critical', '/healthz', NULL)
    ON CONFLICT (service_key) DO NOTHING`);
  await pool.query(`INSERT INTO availability_redundancy_components (component_key, component_type, primary_reference, secondary_reference, status, failover_mode, notes) VALUES
    ('application_instances', 'application', 'Configured production instance pool', 'Configured standby instance pool', 'ready', 'automatic', 'Provider/load-balancer failover must be enabled in the deployment target.'),
    ('web_application_backup', 'application', 'Primary ACC web application', 'Configured standby ACC web application', 'ready', 'automatic', 'Standby application target used by automatic availability failover.'),
    ('postgresql_backup', 'backup', 'Primary PostgreSQL database', 'Encrypted verified backup', 'ready', 'manual', 'Database promotion requires the managed PostgreSQL provider or operator runbook.'),
    ('notification_delivery', 'service', 'In-app notification queue', 'Email/SMS provider queue', 'ready', 'automatic', 'Non-critical channels may degrade while in-app alerts continue.')
    ON CONFLICT (component_key) DO NOTHING`);
  await pool.query(`INSERT INTO permissions (permission_key, resource, action, description) VALUES ('admin.availability.read','admin_availability','read','View service health, uptime evidence, failover posture, incidents, and recovery activity.'), ('admin.availability.manage','admin_availability','manage','Run health checks, record recovery actions, and resolve availability incidents.') ON CONFLICT (permission_key) DO NOTHING`);
  await pool.query(`INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r CROSS JOIN permissions p WHERE r.role_key IN ('platform_admin','system_admin','acc_management_admin','super_admin') AND p.permission_key IN ('admin.availability.read','admin.availability.manage') ON CONFLICT DO NOTHING`);
  for (const [requirementId, name, description, priority] of AVAILABILITY_REQUIREMENTS) {
    await pool.query(`INSERT INTO requirements (requirement_id, name, description, actor, preconditions, postconditions, priority, category, dependencies) VALUES ($1,$2,$3,'Operations administrator','PostgreSQL and deployment telemetry are available.','Availability evidence is persisted and reviewable.',$4,'non_functional',ARRAY['availability_services','availability_health_checks','availability_incidents']) ON CONFLICT (requirement_id) DO NOTHING`, [requirementId, name, description, priority]);
    await pool.query(`INSERT INTO requirement_traceability (requirement_id, user_story, ui_reference, api_reference, database_objects, test_case, sprint, release, coverage_status, notes) SELECT id, $2, 'views/admin/availability.ejs', 'GET /admin/availability and POST /admin/availability/health-checks', ARRAY['availability_services','availability_health_checks','availability_incidents','availability_audit_logs'], 'tests/chapter37-availability.test.js', 'Reliability', '1.0', 'complete', 'Chapter 37 availability controls are PostgreSQL-backed.' FROM requirements WHERE requirement_id = $1 ON CONFLICT (requirement_id) DO NOTHING`, [requirementId, `As an operations administrator, I want ${name.toLowerCase()} so ACC remains dependable.`]);
  }
}

async function recordAudit(eventType, outcome, details = {}, actorId = null, incidentId = null, serviceId = null) {
  await pool.query(`INSERT INTO availability_audit_logs (event_type, incident_id, service_id, outcome, details, actor_id) VALUES ($1,$2,$3,$4,$5,$6)`, [eventType, incidentId, serviceId, outcome, details, actorId]);
}

async function checkService(service) {
  const startedAt = performance.now();
  let status = "healthy";
  let httpStatus = null;
  let errorMessage = null;
  if (service.service_key === "postgresql") {
    try { await pool.query("SELECT 1"); } catch (error) { status = "failed"; errorMessage = error.message; }
  } else if (service.health_url) {
    try {
      const baseUrl = process.env.APP_URL || `http://127.0.0.1:${process.env.PORT || 5500}`;
      const healthUrl = new URL(service.health_url, baseUrl).toString();
      const response = await fetch(healthUrl, { signal: AbortSignal.timeout(Math.min(service.expected_response_ms, 5000)) });
      httpStatus = response.status;
      if (!response.ok) status = "failed";
    } catch (error) {
      status = "failed";
      errorMessage = error.message;
    }
  }
  const responseTimeMs = Math.round(performance.now() - startedAt);
  if (status === "healthy" && responseTimeMs > Number(service.expected_response_ms)) status = "degraded";
  const result = await pool.query(`INSERT INTO availability_health_checks (service_id, status, response_time_ms, http_status, error_message) VALUES ($1,$2,$3,$4,$5) RETURNING id, status, response_time_ms AS "responseTimeMs", checked_at AS "checkedAt"`, [service.id, status, responseTimeMs, httpStatus, errorMessage]);
  await pool.query("UPDATE availability_services SET last_status=$1, last_checked_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=$2", [status, service.id]);
  return { service, check: result.rows[0] };
}

async function runHealthChecks(actorId = null) {
  const services = await pool.query("SELECT * FROM availability_services WHERE enabled = TRUE ORDER BY id");
  const results = [];
  for (const service of services.rows) {
    const result = await checkService(service);
    results.push(result);
    if (result.check.status !== "healthy") await handleFailure(service, result.check.status, result.check.responseTimeMs, result.check.errorMessage, actorId);
  }
  await recordAudit("health_check_run", "completed", { servicesChecked: results.length }, actorId);
  return results;
}

async function handleFailure(service, status, responseTimeMs, errorMessage, actorId = null) {
  const incident = await pool.query(`INSERT INTO availability_incidents (service_id, severity, incident_type, title, details) VALUES ($1,$2,$3,$4,$5) RETURNING id`, [service.id, service.criticality === "critical" ? "critical" : "warning", status === "failed" ? "health_check_failure" : "degraded", `${service.display_name} availability issue`, { status, responseTimeMs, errorMessage }]);
  const incidentId = incident.rows[0].id;
  const severity = service.criticality === "critical" ? "critical" : "warning";
  const alertMessage = `${service.display_name} is ${status}.`;
  await pool.query(`INSERT INTO deployment_alerts (severity, alert_type, message) VALUES ($1,'availability_incident',$2)`, [severity, alertMessage]);
  await recordAudit("incident_detected", "alerted", { status, responseTimeMs, errorMessage }, actorId, incidentId, service.id);
  const recipients = await pool.query(`SELECT DISTINCT ur.user_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE r.role_key IN ('platform_admin','system_admin','acc_management_admin','super_admin')`);
  const notifications = await Promise.allSettled(recipients.rows.map(({ user_id: userId }) => notificationModel.generateNotification({ userId, type: "system", priority: severity === "critical" ? "high" : "normal", title: `${service.display_name} availability incident`, message: alertMessage, link: "/admin/availability", eventKey: `availability_incident:${incidentId}`, dedupeKey: `availability_incident:${incidentId}:${userId}` })));
  const notificationFailures = notifications.filter((result) => result.status === "rejected");
  if (notificationFailures.length) await recordAudit("incident_notification_failed", "partial_failure", { failedRecipients: notificationFailures.length }, actorId, incidentId, service.id);
  if (service.backup_service_key) {
    const backup = await pool.query("SELECT primary_reference FROM availability_redundancy_components WHERE component_key=$1 LIMIT 1", [service.backup_service_key]);
    const target = backup.rows[0] ? backup.rows[0].primary_reference : service.backup_service_key;
    await pool.query(`INSERT INTO availability_failover_events (service_id, from_reference, to_reference, trigger_type, outcome, details) VALUES ($1,$2,$3,'automatic','initiated',$4)`, [service.id, service.service_key, target, { incidentId }]);
    await pool.query(`INSERT INTO availability_recovery_actions (incident_id, action_type, status, notes) VALUES ($1,'failover','in_progress',$2)`, [incidentId, `Automatic failover initiated for ${service.service_key}.`]);
    await recordAudit("automatic_failover_initiated", "initiated", { target }, actorId, incidentId, service.id);
  } else if (service.criticality === "non_critical") {
    await pool.query(`UPDATE availability_services SET degraded_mode=TRUE WHERE id=$1`, [service.id]);
    await pool.query(`INSERT INTO availability_recovery_actions (incident_id, action_type, status, notes) VALUES ($1,'degrade','completed',$2)`, [incidentId, `Graceful degradation enabled for ${service.service_key}.`]);
    await recordAudit("graceful_degradation_enabled", "completed", {}, actorId, incidentId, service.id);
  }
  return incidentId;
}

async function getDashboard() {
  const [services, checks, incidents, failovers, recovery, redundancy, uptime] = await Promise.all([
    pool.query("SELECT id, service_key AS \"serviceKey\", display_name AS \"displayName\", criticality, expected_response_ms AS \"expectedResponseMs\", enabled, degraded_mode AS \"degradedMode\", last_status AS \"lastStatus\", last_checked_at AS \"lastCheckedAt\" FROM availability_services ORDER BY criticality DESC, display_name"),
    pool.query("SELECT h.id, s.display_name AS \"serviceName\", h.status, h.response_time_ms AS \"responseTimeMs\", h.http_status AS \"httpStatus\", h.error_message AS \"errorMessage\", h.checked_at AS \"checkedAt\" FROM availability_health_checks h JOIN availability_services s ON s.id=h.service_id ORDER BY h.checked_at DESC LIMIT 30"),
    pool.query("SELECT i.id, s.display_name AS \"serviceName\", i.severity, i.incident_type AS \"incidentType\", i.title, i.details, i.status, i.detected_at AS \"detectedAt\" FROM availability_incidents i LEFT JOIN availability_services s ON s.id=i.service_id ORDER BY i.detected_at DESC LIMIT 20"),
    pool.query("SELECT f.id, s.display_name AS \"serviceName\", f.from_reference AS \"fromReference\", f.to_reference AS \"toReference\", f.trigger_type AS \"triggerType\", f.outcome, f.created_at AS \"createdAt\" FROM availability_failover_events f LEFT JOIN availability_services s ON s.id=f.service_id ORDER BY f.created_at DESC LIMIT 20"),
    pool.query("SELECT r.id, r.action_type AS \"actionType\", r.status, r.attempts, r.notes, r.created_at AS \"createdAt\" FROM availability_recovery_actions r ORDER BY r.created_at DESC LIMIT 20"),
    pool.query("SELECT component_key AS \"componentKey\", component_type AS \"componentType\", primary_reference AS \"primaryReference\", secondary_reference AS \"secondaryReference\", status, failover_mode AS \"failoverMode\", last_verified_at AS \"lastVerifiedAt\", notes FROM availability_redundancy_components ORDER BY component_type, component_key"),
    pool.query(`SELECT COUNT(*) FILTER (WHERE status='healthy')::integer AS healthy, COUNT(*) FILTER (WHERE status IN ('degraded','failed'))::integer AS unavailable, COUNT(*)::integer AS checks FROM availability_health_checks WHERE checked_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'`),
  ]);
  const uptimeRate = uptime.rows[0].checks ? Number(((uptime.rows[0].healthy / uptime.rows[0].checks) * 100).toFixed(2)) : 100;
  return { services: services.rows, checks: checks.rows, incidents: incidents.rows, failovers: failovers.rows, recovery: recovery.rows, redundancy: redundancy.rows, uptime: { ...uptime.rows[0], rate: uptimeRate } };
}

async function resolveIncident(actorId, incidentId) {
  const result = await pool.query("UPDATE availability_incidents SET status='resolved', resolved_at=CURRENT_TIMESTAMP, resolved_by=$1 WHERE id=$2 AND status <> 'resolved' RETURNING id, service_id", [actorId, Number(incidentId)]);
  if (!result.rowCount) return { success: false, message: "Incident was not found or already resolved." };
  await pool.query("INSERT INTO availability_recovery_actions (incident_id, action_type, status, attempts, actor_id, notes) VALUES ($1,'restore','completed',1,$2,'Incident resolved by an availability operator.')", [incidentId, actorId]);
  await recordAudit("incident_resolved", "completed", {}, actorId, incidentId, result.rows[0].service_id);
  return { success: true, message: "Availability incident resolved." };
}

function startMonitor(intervalMs = Number(process.env.AVAILABILITY_CHECK_INTERVAL_MS || 60000)) {
  const timer = setInterval(() => runHealthChecks().catch((error) => console.error("Availability monitor failed:", error.message)), Math.max(15000, intervalMs));
  if (timer.unref) timer.unref();
  return timer;
}

module.exports = { AVAILABILITY_REQUIREMENTS, ensureSchema, runHealthChecks, getDashboard, resolveIncident, checkService, startMonitor };
