const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const XLSX = require("xlsx");
const bcrypt = require("bcryptjs");
const pool = require("../database/connection");

const ONBOARDING_REQUIREMENTS = [
  ["ACC-FRS-ONB-001", "User onboarding process", "Users complete guided account and profile onboarding.", "critical"],
  ["ACC-FRS-ONB-002", "Business onboarding", "Businesses can register and submit documents for verification.", "critical"],
  ["ACC-FRS-ONB-003", "Bulk onboarding", "Authorized operators can bulk onboard users and businesses from CSV or Excel.", "high"],
  ["ACC-FRS-ONB-004", "Data migration via files", "Migration jobs parse uploaded CSV and Excel files into validated records.", "high"],
  ["ACC-FRS-ONB-005", "API-based data migration", "Authorized external systems can submit migration payloads through an API.", "high"],
  ["ACC-FRS-ONB-006", "Data validation during migration", "Required fields and supported formats are validated before storage.", "critical"],
  ["ACC-FRS-ONB-007", "Migration error handling", "Invalid rows are retained with clear, reviewable errors.", "high"],
  ["ACC-FRS-ONB-008", "Migration progress tracking", "Migration progress is visible through durable job counters and status.", "medium"],
  ["ACC-FRS-ONB-009", "Assisted onboarding", "Operators can assign guided onboarding tasks and support notes.", "medium"],
  ["ACC-FRS-ONB-010", "Onboarding and migration logging", "Onboarding, imports, and errors are logged in PostgreSQL.", "high"],
];

const importTypes = ["users", "businesses"];
const jobStatuses = ["uploaded", "validating", "processing", "completed", "completed_with_errors", "failed"];
const assistanceStatuses = ["requested", "assigned", "in_progress", "completed", "cancelled"];

function validateRow(importType, row) {
  const errors = [];
  if (importType === "users") {
    if (!String(row.email || "").trim()) errors.push("email is required");
    if (!String(row.first_name || row.firstName || "").trim()) errors.push("first_name is required");
    if (!String(row.last_name || row.lastName || "").trim()) errors.push("last_name is required");
    if (!String(row.country || "").trim()) errors.push("country is required");
    if (!String(row.password || "").trim()) errors.push("password is required for imported users");
    if (row.email && !/^\S+@\S+\.\S+$/.test(String(row.email).trim())) errors.push("email format is invalid");
  } else if (importType === "businesses") {
    for (const field of ["business_name", "business_type", "country_of_residence", "country_of_registration", "business_address", "contact_email", "contact_phone", "industry_category", "owner_email"]) {
      if (!String(row[field] || row[field.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())] || "").trim()) errors.push(`${field} is required`);
    }
    if (row.contact_email && !/^\S+@\S+\.\S+$/.test(String(row.contact_email).trim())) errors.push("contact_email format is invalid");
  }
  return errors;
}

function readRows(filePath, extension) {
  const workbook = XLSX.readFile(filePath, { cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error("The uploaded file has no worksheet.");
  return XLSX.utils.sheet_to_json(sheet, { defval: "" });
}

async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS onboarding_profiles (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      onboarding_type VARCHAR(20) NOT NULL CHECK (onboarding_type IN ('individual','business','enterprise')),
      current_step VARCHAR(60) NOT NULL DEFAULT 'account',
      progress_percent INTEGER NOT NULL DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),
      status VARCHAR(20) NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed','paused')),
      guidance JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS migration_jobs (
      id BIGSERIAL PRIMARY KEY,
      job_key VARCHAR(50) NOT NULL UNIQUE,
      import_type VARCHAR(20) NOT NULL CHECK (import_type IN ('users','businesses')),
      source_type VARCHAR(20) NOT NULL CHECK (source_type IN ('manual','file','api')),
      source_name VARCHAR(255),
      file_name VARCHAR(255),
      status VARCHAR(30) NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded','validating','processing','completed','completed_with_errors','failed')),
      total_rows INTEGER NOT NULL DEFAULT 0,
      processed_rows INTEGER NOT NULL DEFAULT 0,
      valid_rows INTEGER NOT NULL DEFAULT 0,
      imported_rows INTEGER NOT NULL DEFAULT 0,
      error_rows INTEGER NOT NULL DEFAULT 0,
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      initiated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS migration_rows (
      id BIGSERIAL PRIMARY KEY,
      job_id BIGINT NOT NULL REFERENCES migration_jobs(id) ON DELETE CASCADE,
      row_number INTEGER NOT NULL,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','valid','imported','error')),
      target_id BIGINT,
      errors JSONB NOT NULL DEFAULT '[]'::jsonb,
      processed_at TIMESTAMPTZ,
      UNIQUE(job_id, row_number)
    );
    CREATE TABLE IF NOT EXISTS migration_api_sources (
      id BIGSERIAL PRIMARY KEY,
      source_key VARCHAR(100) NOT NULL UNIQUE,
      source_name VARCHAR(180) NOT NULL,
      import_type VARCHAR(20) NOT NULL CHECK (import_type IN ('users','businesses')),
      endpoint_url VARCHAR(500),
      active BOOLEAN NOT NULL DEFAULT TRUE,
      last_job_id BIGINT REFERENCES migration_jobs(id) ON DELETE SET NULL,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS onboarding_assistance (
      id BIGSERIAL PRIMARY KEY,
      subject_type VARCHAR(20) NOT NULL CHECK (subject_type IN ('user','business','migration_job')),
      subject_id BIGINT NOT NULL,
      requested_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','assigned','in_progress','completed','cancelled')),
      task_title VARCHAR(220) NOT NULL,
      notes TEXT,
      due_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS onboarding_migration_audit_logs (
      id BIGSERIAL PRIMARY KEY,
      actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      job_id BIGINT REFERENCES migration_jobs(id) ON DELETE SET NULL,
      event_type VARCHAR(100) NOT NULL,
      outcome VARCHAR(30) NOT NULL DEFAULT 'success',
      details JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS migration_jobs_status_idx ON migration_jobs(status, created_at DESC);
    CREATE INDEX IF NOT EXISTS migration_rows_job_status_idx ON migration_rows(job_id, status, row_number);
    CREATE INDEX IF NOT EXISTS onboarding_assistance_status_idx ON onboarding_assistance(status, due_at);
    CREATE INDEX IF NOT EXISTS onboarding_audit_created_idx ON onboarding_migration_audit_logs(created_at DESC);
  `);
  await pool.query(`INSERT INTO permissions (permission_key, resource, action, description) VALUES ('admin.onboarding.read','admin_onboarding','read','View onboarding profiles, migration jobs, progress, errors, and assistance.'), ('admin.onboarding.manage','admin_onboarding','manage','Create migrations, process imports, configure API sources, and manage assisted onboarding.') ON CONFLICT (permission_key) DO NOTHING`);
  await pool.query(`INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r CROSS JOIN permissions p WHERE r.role_key IN ('platform_admin','system_admin','acc_management_admin','super_admin') AND p.permission_key IN ('admin.onboarding.read','admin.onboarding.manage') ON CONFLICT DO NOTHING`);
  for (const [requirementId, name, description, priority] of ONBOARDING_REQUIREMENTS) {
    await pool.query(`INSERT INTO requirements (requirement_id,name,description,actor,preconditions,postconditions,priority,category,dependencies) VALUES ($1,$2,$3,'Onboarding administrator','PostgreSQL and validated source data are available.','Onboarding and migration state is durable, validated, traceable, and reviewable.',$4,'functional',ARRAY['migration_jobs','migration_rows','onboarding_profiles','onboarding_migration_audit_logs']) ON CONFLICT (requirement_id) DO NOTHING`, [requirementId, name, description, priority]);
    await pool.query(`INSERT INTO requirement_traceability (requirement_id,user_story,ui_reference,api_reference,database_objects,test_case,sprint,release,coverage_status,notes) SELECT id,$2,'views/admin/onboarding.ejs','GET /admin/onboarding and POST /admin/onboarding/*',ARRAY['migration_jobs','migration_rows','migration_api_sources','onboarding_assistance','onboarding_migration_audit_logs'],'tests/chapter42-onboarding.test.js','Data Migration and Onboarding','1.0','complete','Chapter 42 onboarding controls are PostgreSQL-backed.' FROM requirements WHERE requirement_id=$1 ON CONFLICT (requirement_id) DO NOTHING`, [requirementId, `As an ACC growth operator, I want ${name.toLowerCase()} so onboarding scales safely.`]);
  }
}

async function audit(actorId, jobId, eventType, details = {}, outcome = "success") { await pool.query("INSERT INTO onboarding_migration_audit_logs (actor_id, job_id, event_type, outcome, details) VALUES ($1,$2,$3,$4,$5)", [actorId, jobId || null, eventType, outcome, details]); }

async function getDashboard() {
  const [jobs, rows, sources, assistance, profiles, auditLogs] = await Promise.all([
    pool.query("SELECT id, job_key AS \"jobKey\", import_type AS \"importType\", source_type AS \"sourceType\", source_name AS \"sourceName\", file_name AS \"fileName\", status, total_rows AS \"totalRows\", processed_rows AS \"processedRows\", valid_rows AS \"validRows\", imported_rows AS \"importedRows\", error_rows AS \"errorRows\", created_at AS \"createdAt\", completed_at AS \"completedAt\" FROM migration_jobs ORDER BY created_at DESC LIMIT 30"),
    pool.query("SELECT r.id, r.job_id AS \"jobId\", j.job_key AS \"jobKey\", r.row_number AS \"rowNumber\", r.status, r.errors, r.payload, r.target_id AS \"targetId\" FROM migration_rows r JOIN migration_jobs j ON j.id=r.job_id WHERE r.status='error' ORDER BY r.processed_at DESC NULLS LAST, r.row_number LIMIT 40"),
    pool.query("SELECT id, source_key AS \"sourceKey\", source_name AS \"sourceName\", import_type AS \"importType\", endpoint_url AS \"endpointUrl\", active, last_job_id AS \"lastJobId\" FROM migration_api_sources ORDER BY source_name"),
    pool.query("SELECT id, subject_type AS \"subjectType\", subject_id AS \"subjectId\", status, task_title AS \"taskTitle\", notes, due_at AS \"dueAt\", created_at AS \"createdAt\" FROM onboarding_assistance ORDER BY created_at DESC LIMIT 30"),
    pool.query("SELECT onboarding_type AS \"onboardingType\", status, COUNT(*)::integer AS count, COALESCE(ROUND(AVG(progress_percent)),0)::integer AS \"averageProgress\" FROM onboarding_profiles GROUP BY onboarding_type, status ORDER BY onboarding_type"),
    pool.query("SELECT id, event_type AS \"eventType\", outcome, details, created_at AS \"createdAt\" FROM onboarding_migration_audit_logs ORDER BY created_at DESC LIMIT 40"),
  ]);
  const activeJobs = jobs.rows.filter((job) => !["completed", "completed_with_errors", "failed"].includes(job.status));
  return { jobs: jobs.rows, errors: rows.rows, sources: sources.rows, assistance: assistance.rows, profiles: profiles.rows, auditLogs: auditLogs.rows, counts: { jobs: jobs.rows.length, activeJobs: activeJobs.length, imported: jobs.rows.reduce((sum, job) => sum + Number(job.importedRows || 0), 0), errors: jobs.rows.reduce((sum, job) => sum + Number(job.errorRows || 0), 0), assistance: assistance.rows.filter((item) => !["completed", "cancelled"].includes(item.status)).length } };
}

async function createJob(actorId, importType, sourceType, sourceName, fileName, rows) {
  if (!importTypes.includes(importType)) throw new Error("Unsupported migration type.");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const job = await client.query("INSERT INTO migration_jobs (job_key, import_type, source_type, source_name, file_name, status, total_rows, initiated_by) VALUES ($1,$2,$3,$4,$5,'validating',$6,$7) RETURNING id, job_key AS \"jobKey\"", [`MIG-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`, importType, sourceType, sourceName || null, fileName || null, rows.length, actorId]);
    let validRows = 0;
    for (let index = 0; index < rows.length; index += 1) {
      const sourceRow = rows[index];
      const errors = validateRow(importType, sourceRow);
      const status = errors.length ? "error" : "valid";
      if (!errors.length) validRows += 1;
      let storedRow = sourceRow;
      if (importType === "users" && !errors.length) {
        storedRow = { ...sourceRow, password_hash: await bcrypt.hash(String(sourceRow.password), 12) };
        delete storedRow.password;
      }
      await client.query("INSERT INTO migration_rows (job_id, row_number, payload, status, errors) VALUES ($1,$2,$3,$4,$5)", [job.rows[0].id, index + 2, storedRow, status, errors]);
    }
    await client.query("UPDATE migration_jobs SET status=$1, valid_rows=$2, error_rows=$3, processed_rows=$4 WHERE id=$5", [validRows ? "processing" : "failed", validRows, rows.length - validRows, rows.length, job.rows[0].id]);
    await client.query("INSERT INTO onboarding_migration_audit_logs (actor_id, job_id, event_type, details, outcome) VALUES ($1,$2,'migration_validated',$3,$4)", [actorId, job.rows[0].id, { totalRows: rows.length, validRows, errorRows: rows.length - validRows }, rows.length - validRows ? "warning" : "success"]);
    await client.query("COMMIT");
    const result = await processJob(actorId, job.rows[0].id);
    return { ...job.rows[0], ...result };
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}

async function processJob(actorId, jobId) {
  const jobResult = await pool.query("SELECT id, import_type AS \"importType\", status FROM migration_jobs WHERE id=$1", [Number(jobId)]);
  if (!jobResult.rows[0]) throw new Error("Migration job was not found.");
  if (jobResult.rows[0].status === "failed") return { status: "failed" };
  const rows = await pool.query("SELECT id, row_number AS \"rowNumber\", payload FROM migration_rows WHERE job_id=$1 AND status='valid' ORDER BY row_number", [Number(jobId)]);
  let imported = 0;
  for (const row of rows.rows) {
    try {
      let targetId;
      if (jobResult.rows[0].importType === "users") {
        const payload = row.payload;
        const passwordHash = String(payload.password_hash);
        const result = await pool.query("INSERT INTO users (first_name,last_name,name,email,country,password_hash,status,registration_state,email_verified,consent_terms,consent_privacy) VALUES ($1,$2,$3,$4,$5,$6,'pending_verification','started',FALSE,TRUE,TRUE) RETURNING id", [String(payload.first_name || payload.firstName).trim(), String(payload.last_name || payload.lastName).trim(), `${String(payload.first_name || payload.firstName).trim()} ${String(payload.last_name || payload.lastName).trim()}`, String(payload.email).trim().toLowerCase(), String(payload.country).trim(), passwordHash]);
        targetId = result.rows[0].id;
      } else {
        const owner = await pool.query("SELECT id FROM users WHERE email=$1", [String(row.payload.owner_email || row.payload.ownerEmail).trim().toLowerCase()]);
        if (!owner.rows[0]) throw new Error("owner_email does not match an existing user");
        const result = await pool.query("INSERT INTO business_accounts (business_name,business_type,country_of_residence,country_of_registration,business_address,contact_email,contact_phone,industry_category,registration_number,website,business_description,status,owner_id,ownership_role) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'draft',$12,'Business Owner') RETURNING id", [row.payload.business_name, row.payload.business_type, row.payload.country_of_residence, row.payload.country_of_registration, row.payload.business_address, row.payload.contact_email, row.payload.contact_phone, row.payload.industry_category, row.payload.registration_number || null, row.payload.website || null, row.payload.business_description || null, owner.rows[0].id]);
        targetId = result.rows[0].id;
      }
      await pool.query("UPDATE migration_rows SET status='imported', target_id=$1, processed_at=CURRENT_TIMESTAMP WHERE id=$2", [targetId, row.id]);
      imported += 1;
    } catch (error) {
      await pool.query("UPDATE migration_rows SET status='error', errors=$1, processed_at=CURRENT_TIMESTAMP WHERE id=$2", [[error.code === "23505" ? "Duplicate record" : error.message], row.id]);
    }
  }
  const counts = await pool.query("SELECT COUNT(*) FILTER (WHERE status='imported')::integer AS imported, COUNT(*) FILTER (WHERE status='error')::integer AS errors FROM migration_rows WHERE job_id=$1", [Number(jobId)]);
  const status = Number(counts.rows[0].errors) ? "completed_with_errors" : "completed";
  await pool.query("UPDATE migration_jobs SET status=$1, imported_rows=$2, error_rows=$3, completed_at=CURRENT_TIMESTAMP WHERE id=$4", [status, counts.rows[0].imported, counts.rows[0].errors, Number(jobId)]);
  await audit(actorId, jobId, "migration_completed", { importedRows: counts.rows[0].imported, errorRows: counts.rows[0].errors }, Number(counts.rows[0].errors) ? "warning" : "success");
  return { status, importedRows: counts.rows[0].imported, errorRows: counts.rows[0].errors };
}

async function importFile(actorId, importType, file) {
  const rows = readRows(file.path, path.extname(file.originalname).toLowerCase());
  try { return await createJob(actorId, importType, "file", file.originalname, file.originalname, rows); } finally { await fs.unlink(file.path).catch(() => {}); }
}
async function createApiSource(actorId, input = {}) { await pool.query("INSERT INTO migration_api_sources (source_key, source_name, import_type, endpoint_url, created_by) VALUES ($1,$2,$3,$4,$5)", [String(input.sourceKey || "").trim(), String(input.sourceName || "").trim(), input.importType, String(input.endpointUrl || "").trim() || null, actorId]); return { success: true, message: "API migration source registered." }; }
async function importApi(actorId, sourceId, rows) { const source = await pool.query("SELECT id, source_name AS \"sourceName\", import_type AS \"importType\" FROM migration_api_sources WHERE id=$1 AND active=TRUE", [Number(sourceId)]); if (!source.rows[0]) throw new Error("API migration source was not found or is inactive."); const result = await createJob(actorId, source.rows[0].importType, "api", source.rows[0].sourceName, null, rows); await pool.query("UPDATE migration_api_sources SET last_job_id=$1, updated_at=CURRENT_TIMESTAMP WHERE id=$2", [result.id, Number(sourceId)]); return result; }
async function createAssistance(actorId, input = {}) { await pool.query("INSERT INTO onboarding_assistance (subject_type, subject_id, requested_by, task_title, notes, due_at) VALUES ($1,$2,$3,$4,$5,$6)", [input.subjectType, Number(input.subjectId), actorId, String(input.taskTitle || "").trim(), String(input.notes || "").trim() || null, input.dueAt || null]); return { success: true, message: "Assisted onboarding task created." }; }
async function updateAssistance(actorId, id, input = {}) { const result = await pool.query("UPDATE onboarding_assistance SET status=$1, assigned_to=$2, notes=COALESCE($3,notes), completed_at=CASE WHEN $1='completed' THEN CURRENT_TIMESTAMP ELSE completed_at END, updated_at=CURRENT_TIMESTAMP WHERE id=$4 RETURNING id", [assistanceStatuses.includes(input.status) ? input.status : "in_progress", Number(input.assignedTo) || actorId, String(input.notes || "").trim() || null, Number(id)]); if (!result.rowCount) throw new Error("Assisted onboarding task was not found."); return { success: true, message: "Assisted onboarding task updated." }; }

module.exports = { ONBOARDING_REQUIREMENTS, ensureSchema, getDashboard, importFile, importApi, createApiSource, createAssistance, updateAssistance, validateRow, readRows };
