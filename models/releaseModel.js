const pool = require("../database/connection");

const RELEASE_REQUIREMENTS = [
  ["ACC-FRS-REL-001", "Version control system", "System components and release versions are tracked accurately.", "critical"],
  ["ACC-FRS-REL-002", "Semantic versioning", "Versions follow Major.Minor.Patch semantic versioning.", "high"],
  ["ACC-FRS-REL-003", "Release planning", "Release schedules and feature lists are planned in advance.", "high"],
  ["ACC-FRS-REL-004", "Release deployment", "Prepared versions can be deployed through a controlled workflow.", "critical"],
  ["ACC-FRS-REL-005", "Rollback mechanism", "A release can be safely reverted to a previous version.", "critical"],
  ["ACC-FRS-REL-006", "Release notes", "New features, fixes, and changes are documented.", "high"],
  ["ACC-FRS-REL-007", "Feature flagging", "Features can be enabled or disabled without redeployment.", "high"],
  ["ACC-FRS-REL-008", "Backward compatibility", "Compatibility requirements for older integrations are recorded.", "high"],
  ["ACC-FRS-REL-009", "Release monitoring", "Post-release behavior and issues are monitored.", "critical"],
  ["ACC-FRS-REL-010", "Release audit logging", "Version, deployment, and rollback activities are durably logged.", "high"],
];

const VERSION_PATTERN = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?(?:\+([0-9A-Za-z.-]+))?$/;
const releaseTypes = ["major", "minor", "patch", "hotfix"];
const planStatuses = ["planned", "in_progress", "ready", "released", "rolled_back", "cancelled"];
const monitorStatuses = ["healthy", "watch", "incident", "resolved"];

function normalizeVersion(value) {
  const version = String(value || "").trim();
  if (!VERSION_PATTERN.test(version)) return null;
  return version.startsWith("v") ? version : `v${version}`;
}

async function ensureSchema() {
  await pool.query(`
    ALTER TABLE requirements DROP CONSTRAINT IF EXISTS requirements_requirement_id_check;
    ALTER TABLE requirements ADD CONSTRAINT requirements_requirement_id_check CHECK (requirement_id ~ '^(FR-[A-Z0-9]+|ACC-FRS-(PERF|MOB|AVAIL|SUP|LOG|QA|REL))-[0-9]{3}$');
    CREATE TABLE IF NOT EXISTS release_versions (
      id BIGSERIAL PRIMARY KEY,
      version VARCHAR(80) NOT NULL UNIQUE,
      major INTEGER NOT NULL CHECK (major >= 0),
      minor INTEGER NOT NULL CHECK (minor >= 0),
      patch INTEGER NOT NULL CHECK (patch >= 0),
      prerelease VARCHAR(120),
      build_metadata VARCHAR(120),
      component VARCHAR(120) NOT NULL DEFAULT 'acc-platform',
      commit_sha VARCHAR(120),
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS release_plans (
      id BIGSERIAL PRIMARY KEY,
      version_id BIGINT NOT NULL REFERENCES release_versions(id) ON DELETE CASCADE,
      release_type VARCHAR(20) NOT NULL CHECK (release_type IN ('major','minor','patch','hotfix')),
      title VARCHAR(220) NOT NULL,
      scope TEXT NOT NULL,
      environment_id INTEGER REFERENCES deployment_environments(id) ON DELETE SET NULL,
      scheduled_at TIMESTAMPTZ,
      status VARCHAR(20) NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','in_progress','ready','released','rolled_back','cancelled')),
      qa_report_id BIGINT REFERENCES qa_reports(id) ON DELETE SET NULL,
      previous_version_id BIGINT REFERENCES release_versions(id) ON DELETE SET NULL,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    ALTER TABLE release_plans ADD COLUMN IF NOT EXISTS environment_id INTEGER REFERENCES deployment_environments(id) ON DELETE SET NULL;
    CREATE TABLE IF NOT EXISTS release_notes (
      id BIGSERIAL PRIMARY KEY,
      release_plan_id BIGINT NOT NULL REFERENCES release_plans(id) ON DELETE CASCADE,
      category VARCHAR(20) NOT NULL CHECK (category IN ('feature','bug_fix','change','security','breaking')),
      title VARCHAR(220) NOT NULL,
      body TEXT NOT NULL,
      audience VARCHAR(20) NOT NULL DEFAULT 'admin' CHECK (audience IN ('user','admin','internal')),
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS release_compatibility (
      id BIGSERIAL PRIMARY KEY,
      release_plan_id BIGINT NOT NULL REFERENCES release_plans(id) ON DELETE CASCADE,
      integration_name VARCHAR(160) NOT NULL,
      minimum_version VARCHAR(80),
      compatibility_status VARCHAR(20) NOT NULL DEFAULT 'required' CHECK (compatibility_status IN ('required','verified','deprecated','breaking')),
      verification_notes TEXT,
      verified_at TIMESTAMPTZ,
      verified_by INTEGER REFERENCES users(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS release_monitoring (
      id BIGSERIAL PRIMARY KEY,
      release_plan_id BIGINT NOT NULL REFERENCES release_plans(id) ON DELETE CASCADE,
      environment_id INTEGER REFERENCES deployment_environments(id) ON DELETE SET NULL,
      status VARCHAR(20) NOT NULL CHECK (status IN ('healthy','watch','incident','resolved')),
      error_rate NUMERIC(7,4) CHECK (error_rate IS NULL OR error_rate >= 0),
      response_time_ms INTEGER CHECK (response_time_ms IS NULL OR response_time_ms >= 0),
      issue_summary TEXT,
      recorded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      recorded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS release_audit_logs (
      id BIGSERIAL PRIMARY KEY,
      release_plan_id BIGINT REFERENCES release_plans(id) ON DELETE SET NULL,
      version_id BIGINT REFERENCES release_versions(id) ON DELETE SET NULL,
      actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      event_type VARCHAR(80) NOT NULL,
      outcome VARCHAR(30) NOT NULL DEFAULT 'success',
      details JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS release_plans_status_idx ON release_plans(status, scheduled_at);
    CREATE INDEX IF NOT EXISTS release_notes_plan_idx ON release_notes(release_plan_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS release_monitoring_plan_idx ON release_monitoring(release_plan_id, recorded_at DESC);
    CREATE INDEX IF NOT EXISTS release_audit_created_idx ON release_audit_logs(created_at DESC);
  `);
  await pool.query(`INSERT INTO permissions (permission_key, resource, action, description) VALUES ('admin.release.read','admin_release','read','View versions, release plans, notes, compatibility, monitoring, and audit history.'), ('admin.release.manage','admin_release','manage','Plan releases, deploy or rollback versions, manage flags, notes, compatibility, and monitoring.') ON CONFLICT (permission_key) DO NOTHING`);
  await pool.query(`INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r CROSS JOIN permissions p WHERE r.role_key IN ('platform_admin','system_admin','acc_management_admin','super_admin') AND p.permission_key IN ('admin.release.read','admin.release.manage') ON CONFLICT DO NOTHING`);
  for (const [requirementId, name, description, priority] of RELEASE_REQUIREMENTS) {
    await pool.query(`INSERT INTO requirements (requirement_id,name,description,actor,preconditions,postconditions,priority,category,dependencies) VALUES ($1,$2,$3,'Release administrator','PostgreSQL, deployment, and QA records are available.','Version and release evidence is controlled, deployed, monitored, and auditable.',$4,'non_functional',ARRAY['release_versions','release_plans','release_audit_logs']) ON CONFLICT (requirement_id) DO NOTHING`, [requirementId, name, description, priority]);
    await pool.query(`INSERT INTO requirement_traceability (requirement_id,user_story,ui_reference,api_reference,database_objects,test_case,sprint,release,coverage_status,notes) SELECT id,$2,'views/admin/releases.ejs','GET /admin/releases and POST /admin/releases/*',ARRAY['release_versions','release_plans','release_notes','release_compatibility','release_monitoring','release_audit_logs'],'tests/chapter41-release.test.js','Versioning and Release Management','1.0','complete','Chapter 41 release controls are PostgreSQL-backed.' FROM requirements WHERE requirement_id=$1 ON CONFLICT (requirement_id) DO NOTHING`, [requirementId, `As a release administrator, I want ${name.toLowerCase()} so ACC evolves safely.`]);
  }
}

function parseVersion(version) {
  const normalized = normalizeVersion(version);
  if (!normalized) return null;
  const match = normalized.match(VERSION_PATTERN);
  return { normalized, major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]), prerelease: match[4] || null, buildMetadata: match[5] || null };
}

async function getDashboard() {
  const [versions, plans, notes, compatibility, monitoring, flags, audit] = await Promise.all([
    pool.query("SELECT id, version, component, commit_sha AS \"commitSha\", created_at AS \"createdAt\" FROM release_versions ORDER BY created_at DESC LIMIT 30"),
    pool.query("SELECT p.id, p.title, p.scope, p.environment_id AS \"environmentId\", p.release_type AS \"releaseType\", p.status, p.scheduled_at AS \"scheduledAt\", v.version, v.id AS \"versionId\", p.qa_report_id AS \"qaReportId\", pv.version AS \"previousVersion\", e.display_name AS \"environmentName\" FROM release_plans p JOIN release_versions v ON v.id=p.version_id LEFT JOIN release_versions pv ON pv.id=p.previous_version_id LEFT JOIN deployment_environments e ON e.id=p.environment_id ORDER BY COALESCE(p.scheduled_at,p.created_at) DESC LIMIT 30"),
    pool.query("SELECT n.id, n.release_plan_id AS \"releasePlanId\", n.category, n.title, n.body, n.audience, n.created_at AS \"createdAt\", v.version FROM release_notes n JOIN release_plans p ON p.id=n.release_plan_id JOIN release_versions v ON v.id=p.version_id ORDER BY n.created_at DESC LIMIT 40"),
    pool.query("SELECT c.id, c.release_plan_id AS \"releasePlanId\", c.integration_name AS \"integrationName\", c.minimum_version AS \"minimumVersion\", c.compatibility_status AS \"compatibilityStatus\", c.verification_notes AS \"verificationNotes\", v.version FROM release_compatibility c JOIN release_plans p ON p.id=c.release_plan_id JOIN release_versions v ON v.id=p.version_id ORDER BY c.id DESC LIMIT 30"),
    pool.query("SELECT m.id, m.release_plan_id AS \"releasePlanId\", m.status, m.error_rate AS \"errorRate\", m.response_time_ms AS \"responseTimeMs\", m.issue_summary AS \"issueSummary\", m.recorded_at AS \"recordedAt\", v.version, e.environment_key AS \"environmentKey\" FROM release_monitoring m JOIN release_plans p ON p.id=m.release_plan_id JOIN release_versions v ON v.id=p.version_id LEFT JOIN deployment_environments e ON e.id=m.environment_id ORDER BY m.recorded_at DESC LIMIT 30"),
    pool.query("SELECT feature_key AS \"featureKey\", display_name AS \"displayName\", enabled, description, updated_at AS \"updatedAt\" FROM system_feature_flags ORDER BY display_name"),
    pool.query("SELECT id, event_type AS \"eventType\", outcome, details, created_at AS \"createdAt\", v.version FROM release_audit_logs a LEFT JOIN release_versions v ON v.id=a.version_id ORDER BY a.created_at DESC LIMIT 40"),
  ]);
  return { versions: versions.rows, plans: plans.rows, notes: notes.rows, compatibility: compatibility.rows, monitoring: monitoring.rows, flags: flags.rows, audit: audit.rows, counts: { planned: plans.rows.filter((plan) => ["planned", "in_progress", "ready"].includes(plan.status)).length, activeMonitoring: monitoring.rows.filter((item) => ["watch", "incident"].includes(item.status)).length, openCompatibility: compatibility.rows.filter((item) => item.compatibilityStatus !== "verified").length } };
}

async function createVersion(actorId, input = {}) {
  const parsed = parseVersion(input.version);
  if (!parsed) return { success: false, message: "Version must use SemVer, for example v1.2.3." };
  const result = await pool.query("INSERT INTO release_versions (version, major, minor, patch, prerelease, build_metadata, component, commit_sha, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id", [parsed.normalized, parsed.major, parsed.minor, parsed.patch, parsed.prerelease, parsed.buildMetadata, String(input.component || "acc-platform").trim(), String(input.commitSha || "").trim() || null, actorId]);
  await pool.query("INSERT INTO release_audit_logs (version_id, actor_id, event_type, details) VALUES ($1,$2,'version_created',$3)", [result.rows[0].id, actorId, { version: parsed.normalized }]);
  return { success: true, message: "Version registered." };
}

async function createPlan(actorId, input = {}) {
  const parsed = parseVersion(input.version);
  if (!parsed || !releaseTypes.includes(input.releaseType)) return { success: false, message: "Provide a valid SemVer version and release type." };
  const version = await pool.query("SELECT id FROM release_versions WHERE version=$1", [parsed.normalized]);
  if (!version.rows[0]) return { success: false, message: "Register the version before creating a release plan." };
  const result = await pool.query("INSERT INTO release_plans (version_id, release_type, title, scope, environment_id, scheduled_at, qa_report_id, previous_version_id, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id", [version.rows[0].id, input.releaseType, String(input.title || "").trim(), String(input.scope || "").trim(), Number(input.environmentId) || null, input.scheduledAt || null, Number(input.qaReportId) || null, Number(input.previousVersionId) || null, actorId]);
  await pool.query("INSERT INTO release_audit_logs (release_plan_id, version_id, actor_id, event_type, details) VALUES ($1,$2,$3,'release_planned',$4)", [result.rows[0].id, version.rows[0].id, actorId, { releaseType: input.releaseType }]);
  return { success: true, message: "Release plan created." };
}

async function recordNote(actorId, input = {}) { await pool.query("INSERT INTO release_notes (release_plan_id, category, title, body, audience, created_by) VALUES ($1,$2,$3,$4,$5,$6)", [Number(input.releasePlanId), input.category, String(input.title || "").trim(), String(input.body || "").trim(), input.audience || "admin", actorId]); return { success: true, message: "Release note saved." }; }
async function recordCompatibility(actorId, input = {}) { await pool.query("INSERT INTO release_compatibility (release_plan_id, integration_name, minimum_version, compatibility_status, verification_notes, verified_at, verified_by) VALUES ($1,$2,$3,$4,$5,CASE WHEN $4='verified' THEN CURRENT_TIMESTAMP ELSE NULL END,CASE WHEN $4='verified' THEN $6 ELSE NULL END)", [Number(input.releasePlanId), String(input.integrationName || "").trim(), String(input.minimumVersion || "").trim() || null, input.compatibilityStatus || "required", String(input.verificationNotes || "").trim(), actorId]); return { success: true, message: "Compatibility record saved." }; }

async function deploy(actorId, input = {}) { return transitionPlan(actorId, input, "deployed", "release_deployed"); }
async function rollback(actorId, input = {}) { return transitionPlan(actorId, input, "rolled_back", "release_rolled_back"); }
async function transitionPlan(actorId, input, status, eventType) { const result = await pool.query("UPDATE release_plans SET status=$1, updated_at=CURRENT_TIMESTAMP WHERE id=$2 RETURNING id, version_id, environment_id", [status, Number(input.releasePlanId)]); if (!result.rowCount) return { success: false, message: "Release plan was not found." }; const plan = result.rows[0]; const version = await pool.query("SELECT version FROM release_versions WHERE id=$1", [plan.version_id]); if (plan.environment_id && version.rows[0]) { if (status === "deployed") await pool.query("INSERT INTO deployment_releases (environment_id, version, status, deployed_by, notes) VALUES ($1,$2,'deployed',$3,$4) ON CONFLICT (environment_id, version) DO UPDATE SET status='deployed', deployed_by=$3, completed_at=CURRENT_TIMESTAMP, notes=$4", [plan.environment_id, version.rows[0].version, actorId, String(input.reason || "Release deployment recorded.").trim()]); if (status === "rolled_back") await pool.query("UPDATE deployment_releases SET status='rolled_back', completed_at=CURRENT_TIMESTAMP, notes=$1 WHERE environment_id=$2 AND version=$3", [String(input.reason || "Release rollback recorded.").trim(), plan.environment_id, version.rows[0].version]); } await pool.query("INSERT INTO release_audit_logs (release_plan_id, version_id, actor_id, event_type, details) VALUES ($1,$2,$3,$4,$5)", [plan.id, plan.version_id, actorId, eventType, { reason: String(input.reason || "").trim(), deploymentLinked: Boolean(plan.environment_id) }]); return { success: true, message: status === "deployed" ? "Release deployment recorded." : "Release rollback recorded." }; }
async function monitor(actorId, input = {}) { await pool.query("INSERT INTO release_monitoring (release_plan_id, environment_id, status, error_rate, response_time_ms, issue_summary, recorded_by) VALUES ($1,$2,$3,$4,$5,$6,$7)", [Number(input.releasePlanId), Number(input.environmentId) || null, monitorStatuses.includes(input.status) ? input.status : "watch", input.errorRate ? Number(input.errorRate) : null, input.responseTimeMs ? Number(input.responseTimeMs) : null, String(input.issueSummary || "").trim() || null, actorId]); return { success: true, message: "Release monitoring observation recorded." }; }
async function toggleFeature(actorId, key, enabled) { const result = await pool.query("UPDATE system_feature_flags SET enabled=$1, updated_by=$2, updated_at=CURRENT_TIMESTAMP WHERE feature_key=$3 RETURNING feature_key", [enabled, actorId, key]); if (!result.rowCount) return { success: false, message: "Feature flag was not found." }; await pool.query("INSERT INTO release_audit_logs (actor_id,event_type,details) VALUES ($1,'feature_flag_changed',$2)", [actorId, { featureKey: key, enabled }]); return { success: true, message: "Feature flag updated." }; }

module.exports = { RELEASE_REQUIREMENTS, normalizeVersion, ensureSchema, getDashboard, createVersion, createPlan, recordNote, recordCompatibility, deploy, rollback, monitor, toggleFeature };
