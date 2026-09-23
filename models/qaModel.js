const pool = require("../database/connection");

const QA_REQUIREMENTS = [
  ["ACC-FRS-QA-001", "Unit testing", "Individual components are tested independently.", "critical"],
  ["ACC-FRS-QA-002", "Integration testing", "Interactions between platform modules are validated.", "critical"],
  ["ACC-FRS-QA-003", "System testing", "Complete platform functionality is validated end to end.", "critical"],
  ["ACC-FRS-QA-004", "User acceptance testing", "Real users can approve the platform before release.", "critical"],
  ["ACC-FRS-QA-005", "Automated testing", "Automated scripts support repeatable validation.", "high"],
  ["ACC-FRS-QA-006", "Manual testing", "Testers can record human-driven validation.", "high"],
  ["ACC-FRS-QA-007", "Regression testing", "Existing features are re-tested after changes.", "critical"],
  ["ACC-FRS-QA-008", "Performance testing", "System behavior under load is validated against targets.", "high"],
  ["ACC-FRS-QA-009", "Security testing", "Security checks identify and track vulnerabilities.", "critical"],
  ["ACC-FRS-QA-010", "Test reporting", "Results and bug summaries are available for review.", "high"],
];

async function ensureSchema() {
  await pool.query(`
    ALTER TABLE requirements DROP CONSTRAINT IF EXISTS requirements_requirement_id_check;
    ALTER TABLE requirements ADD CONSTRAINT requirements_requirement_id_check CHECK (requirement_id ~ '^(FR-[A-Z0-9]+|ACC-FRS-(PERF|MOB|AVAIL|SUP|LOG|QA|REL|ONB|AI|PART|ROAD))-[0-9]{3}$');
    CREATE TABLE IF NOT EXISTS qa_test_plans (
      id BIGSERIAL PRIMARY KEY,
      name VARCHAR(180) NOT NULL,
      release_key VARCHAR(80) NOT NULL,
      scope TEXT NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','approved','archived')),
      owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS qa_test_cases (
      id BIGSERIAL PRIMARY KEY,
      plan_id BIGINT REFERENCES qa_test_plans(id) ON DELETE CASCADE,
      requirement_id BIGINT REFERENCES requirements(id) ON DELETE SET NULL,
      case_key VARCHAR(40) NOT NULL UNIQUE,
      title VARCHAR(220) NOT NULL,
      test_type VARCHAR(20) NOT NULL CHECK (test_type IN ('unit','integration','system','uat','performance','security')),
      execution_mode VARCHAR(20) NOT NULL CHECK (execution_mode IN ('automated','manual')),
      scenario TEXT NOT NULL,
      expected_result TEXT NOT NULL,
      priority VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','critical')),
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS qa_test_runs (
      id BIGSERIAL PRIMARY KEY,
      plan_id BIGINT REFERENCES qa_test_plans(id) ON DELETE SET NULL,
      case_id BIGINT NOT NULL REFERENCES qa_test_cases(id) ON DELETE CASCADE,
      run_type VARCHAR(20) NOT NULL CHECK (run_type IN ('unit','integration','system','uat','regression','performance','security')),
      execution_mode VARCHAR(20) NOT NULL CHECK (execution_mode IN ('automated','manual')),
      result VARCHAR(20) NOT NULL CHECK (result IN ('passed','failed','blocked','skipped','pending')),
      duration_ms INTEGER CHECK (duration_ms IS NULL OR duration_ms >= 0),
      evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
      notes TEXT,
      executed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      executed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS qa_bugs (
      id BIGSERIAL PRIMARY KEY,
      bug_key VARCHAR(40) NOT NULL UNIQUE,
      title VARCHAR(220) NOT NULL,
      description TEXT NOT NULL,
      severity VARCHAR(20) NOT NULL CHECK (severity IN ('low','medium','high','critical')),
      status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','fixed','retest','closed','rejected')),
      test_case_id BIGINT REFERENCES qa_test_cases(id) ON DELETE SET NULL,
      reported_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
      resolution_notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      resolved_at TIMESTAMPTZ
    );
    CREATE TABLE IF NOT EXISTS qa_reports (
      id BIGSERIAL PRIMARY KEY,
      report_key VARCHAR(40) NOT NULL UNIQUE,
      name VARCHAR(180) NOT NULL,
      report_type VARCHAR(20) NOT NULL CHECK (report_type IN ('test_results','bug_summary','release_readiness')),
      plan_id BIGINT REFERENCES qa_test_plans(id) ON DELETE SET NULL,
      summary JSONB NOT NULL DEFAULT '{}'::jsonb,
      generated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS qa_cases_type_idx ON qa_test_cases(test_type, execution_mode, active);
    CREATE INDEX IF NOT EXISTS qa_runs_result_idx ON qa_test_runs(result, executed_at DESC);
    CREATE INDEX IF NOT EXISTS qa_bugs_status_idx ON qa_bugs(status, severity, updated_at DESC);
    CREATE INDEX IF NOT EXISTS qa_reports_created_idx ON qa_reports(created_at DESC);
  `);
  await pool.query(`INSERT INTO permissions (permission_key, resource, action, description) VALUES ('admin.qa.read','admin_qa','read','View QA plans, test cases, runs, defects, and reports.'), ('admin.qa.manage','admin_qa','manage','Create and execute QA tests, track defects, and generate reports.') ON CONFLICT (permission_key) DO NOTHING`);
  await pool.query(`INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r CROSS JOIN permissions p WHERE r.role_key IN ('platform_admin','system_admin','acc_management_admin','super_admin') AND p.permission_key IN ('admin.qa.read','admin.qa.manage') ON CONFLICT DO NOTHING`);
  for (const [requirementId, name, description, priority] of QA_REQUIREMENTS) {
    await pool.query(`INSERT INTO requirements (requirement_id, name, description, actor, preconditions, postconditions, priority, category, dependencies) VALUES ($1,$2,$3,'QA administrator','PostgreSQL and an authorized QA operator are available.','Testing evidence is persisted, reviewable, and linked to defects and reports.',$4,'non_functional',ARRAY['qa_test_cases','qa_test_runs','qa_bugs','qa_reports']) ON CONFLICT (requirement_id) DO NOTHING`, [requirementId, name, description, priority]);
    await pool.query(`INSERT INTO requirement_traceability (requirement_id,user_story,ui_reference,api_reference,database_objects,test_case,sprint,release,coverage_status,notes) SELECT id,$2,'views/admin/qa.ejs','GET /admin/qa and POST /admin/qa/*',ARRAY['qa_test_plans','qa_test_cases','qa_test_runs','qa_bugs','qa_reports'],'tests/chapter40-qa.test.js','Testing and QA','1.0','complete','Chapter 40 QA controls are PostgreSQL-backed.' FROM requirements WHERE requirement_id=$1 ON CONFLICT (requirement_id) DO NOTHING`, [requirementId, `As a QA operator, I want ${name.toLowerCase()} so releases are validated before deployment.`]);
  }
}

async function getDashboard() {
  const [plans, cases, runs, bugs, reports] = await Promise.all([
    pool.query("SELECT id, name, release_key AS \"releaseKey\", scope, status, updated_at AS \"updatedAt\" FROM qa_test_plans ORDER BY updated_at DESC LIMIT 20"),
    pool.query("SELECT c.id, c.case_key AS \"caseKey\", c.title, c.test_type AS \"testType\", c.execution_mode AS \"executionMode\", c.priority, p.name AS \"planName\" FROM qa_test_cases c LEFT JOIN qa_test_plans p ON p.id=c.plan_id WHERE c.active=TRUE ORDER BY c.created_at DESC LIMIT 50"),
    pool.query("SELECT r.id, r.case_id AS \"caseId\", c.case_key AS \"caseKey\", c.title, r.run_type AS \"runType\", r.execution_mode AS \"executionMode\", r.result, r.duration_ms AS \"durationMs\", r.notes, r.executed_at AS \"executedAt\" FROM qa_test_runs r JOIN qa_test_cases c ON c.id=r.case_id ORDER BY r.executed_at DESC LIMIT 50"),
    pool.query("SELECT id, bug_key AS \"bugKey\", title, severity, status, test_case_id AS \"testCaseId\", created_at AS \"createdAt\", updated_at AS \"updatedAt\" FROM qa_bugs ORDER BY updated_at DESC LIMIT 50"),
    pool.query("SELECT id, report_key AS \"reportKey\", name, report_type AS \"reportType\", summary, created_at AS \"createdAt\" FROM qa_reports ORDER BY created_at DESC LIMIT 20"),
  ]);
  const resultCounts = runs.rows.reduce((counts, run) => { counts[run.result] = (counts[run.result] || 0) + 1; return counts; }, {});
  return { plans: plans.rows, cases: cases.rows, runs: runs.rows, bugs: bugs.rows, reports: reports.rows, counts: { totalCases: cases.rows.length, totalRuns: runs.rows.length, passed: resultCounts.passed || 0, failed: resultCounts.failed || 0, openBugs: bugs.rows.filter((bug) => !["closed", "rejected"].includes(bug.status)).length, criticalBugs: bugs.rows.filter((bug) => bug.severity === "critical" && !["closed", "rejected"].includes(bug.status)).length } };
}

async function createPlan(actorId, input = {}) {
  const result = await pool.query("INSERT INTO qa_test_plans (name, release_key, scope, status, owner_id) VALUES ($1,$2,$3,'draft',$4) RETURNING id", [String(input.name || "").trim(), String(input.releaseKey || "").trim(), String(input.scope || "").trim(), actorId]);
  return result.rows[0];
}

async function createCase(actorId, input = {}) {
  const result = await pool.query("INSERT INTO qa_test_cases (plan_id, case_key, title, test_type, execution_mode, scenario, expected_result, priority, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id", [Number(input.planId) || null, String(input.caseKey || "").trim(), String(input.title || "").trim(), input.testType, input.executionMode, String(input.scenario || "").trim(), String(input.expectedResult || "").trim(), ["low", "medium", "high", "critical"].includes(input.priority) ? input.priority : "medium", actorId]);
  return result.rows[0];
}

async function executeCase(actorId, input = {}) {
  const result = await pool.query("INSERT INTO qa_test_runs (plan_id, case_id, run_type, execution_mode, result, duration_ms, evidence, notes, executed_by) SELECT plan_id, id, $1, $2, $3, $4, $5, $6, $7 FROM qa_test_cases WHERE id=$8 RETURNING id", [input.runType, input.executionMode, input.result, input.durationMs ? Number(input.durationMs) : null, input.evidence ? JSON.parse(input.evidence) : {}, String(input.notes || "").trim(), actorId, Number(input.caseId)]);
  if (!result.rowCount) throw new Error("QA test case was not found.");
  return result.rows[0];
}

async function createBug(actorId, input = {}) {
  const result = await pool.query("INSERT INTO qa_bugs (bug_key, title, description, severity, test_case_id, reported_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id", [String(input.bugKey || "").trim(), String(input.title || "").trim(), String(input.description || "").trim(), input.severity, Number(input.testCaseId) || null, actorId]);
  return result.rows[0];
}

async function updateBug(actorId, bugId, input = {}) {
  const result = await pool.query("UPDATE qa_bugs SET status=$1, assigned_to=$2, resolution_notes=$3, updated_at=CURRENT_TIMESTAMP, resolved_at=CASE WHEN $1 IN ('closed','rejected') THEN CURRENT_TIMESTAMP ELSE resolved_at END WHERE id=$4 RETURNING id", [input.status, Number(input.assignedTo) || null, String(input.resolutionNotes || "").trim(), Number(bugId)]);
  if (!result.rowCount) throw new Error("QA defect was not found.");
  return result.rows[0];
}

async function generateReport(actorId, input = {}) {
  const dashboard = await getDashboard();
  const summary = { counts: dashboard.counts, generatedAt: new Date().toISOString(), planId: Number(input.planId) || null };
  const reportKey = `QA-${Date.now()}`;
  const result = await pool.query("INSERT INTO qa_reports (report_key, name, report_type, plan_id, summary, generated_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id", [reportKey, String(input.name || "QA report").trim(), input.reportType || "test_results", Number(input.planId) || null, summary, actorId]);
  return result.rows[0];
}

module.exports = { QA_REQUIREMENTS, ensureSchema, getDashboard, createPlan, createCase, executeCase, createBug, updateBug, generateReport };
