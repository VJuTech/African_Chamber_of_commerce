const pool = require("../database/connection");

const priorityValues = ["critical", "high", "medium", "low"];
const categoryValues = ["functional", "non_functional", "security", "performance"];
const coverageValues = ["complete", "partial", "missing", "blocked"];

function validateRequirement(input = {}) {
  const requirementId = String(input.requirementId || "").trim().toUpperCase();
  if (!/^FR-[A-Z0-9]+-[0-9]{3}$/.test(requirementId)) return { success: false, message: "Requirement ID must use FR-MODULE-000 format." };
  if (!String(input.name || "").trim() || !String(input.description || "").trim() || !String(input.actor || "").trim()) return { success: false, message: "Name, description, and actor are required." };
  if (!priorityValues.includes(input.priority)) return { success: false, message: "Select a valid priority." };
  if (!categoryValues.includes(input.category)) return { success: false, message: "Select a valid requirement category." };
  return { success: true, requirementId };
}

function mapRequirement(row) {
  return {
    ...row,
    dependencies: row.dependencies || [],
    databaseObjects: row.database_objects || [],
    ownerId: row.owner_id ? Number(row.owner_id) : null,
    traceability: row.traceability || null,
    validationRules: row.validation_rules || [],
    changes: row.changes || [],
    complianceControls: row.compliance_controls || [],
  };
}

async function getRequirements(filters = {}) {
  const values = [];
  const conditions = ["r.status <> 'deprecated'"];
  if (filters.category && categoryValues.includes(filters.category)) { values.push(filters.category); conditions.push(`r.category = $${values.length}`); }
  if (filters.coverage && coverageValues.includes(filters.coverage)) { values.push(filters.coverage); conditions.push(`COALESCE(t.coverage_status, 'missing') = $${values.length}`); }
  if (filters.search) { values.push(`%${String(filters.search).trim()}%`); conditions.push(`(r.requirement_id ILIKE $${values.length} OR r.name ILIKE $${values.length})`); }
  const result = await pool.query(
    `SELECT r.id, r.requirement_id, r.name, r.description, r.actor, r.priority, r.category, r.status, r.version,
            COALESCE(t.coverage_status, 'missing') AS coverage_status, r.updated_at
     FROM requirements r LEFT JOIN requirement_traceability t ON t.requirement_id = r.id
     WHERE ${conditions.join(" AND ")} ORDER BY r.requirement_id`,
    values
  );
  return result.rows;
}

async function getRequirementById(id) {
  const result = await pool.query(
    `SELECT r.*, jsonb_build_object(
       'userStory', t.user_story, 'uiReference', t.ui_reference, 'apiReference', t.api_reference,
       'databaseObjects', t.database_objects, 'testCase', t.test_case, 'sprint', t.sprint,
       'release', t.release, 'coverageStatus', t.coverage_status, 'notes', t.notes
     ) FILTER (WHERE t.id IS NOT NULL) AS traceability,
     COALESCE((SELECT jsonb_agg(jsonb_build_object('id', vr.id, 'fieldName', vr.field_name, 'ruleKey', vr.rule_key, 'description', vr.rule_description, 'errorMessage', vr.error_message) ORDER BY vr.id) FROM requirement_validation_rules vr WHERE vr.requirement_id = r.id), '[]'::jsonb) AS validation_rules,
     COALESCE((SELECT jsonb_agg(jsonb_build_object('version', ch.version, 'changeType', ch.change_type, 'summary', ch.change_summary, 'createdAt', ch.created_at) ORDER BY ch.version DESC) FROM requirement_changes ch WHERE ch.requirement_id = r.id), '[]'::jsonb) AS changes,
     COALESCE((SELECT jsonb_agg(jsonb_build_object('framework', cc.framework, 'controlKey', cc.control_key, 'description', cc.control_description, 'status', cc.status, 'evidence', cc.evidence_reference) ORDER BY cc.framework, cc.control_key) FROM requirement_compliance_controls cc WHERE cc.requirement_id = r.id), '[]'::jsonb) AS compliance_controls
     FROM requirements r LEFT JOIN requirement_traceability t ON t.requirement_id = r.id
     WHERE r.id = $1`,
    [Number(id)]
  );
  return result.rows[0] ? mapRequirement(result.rows[0]) : null;
}

async function createRequirement(actorId, input = {}) {
  const validation = validateRequirement(input);
  if (!validation.success) return validation;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const created = await client.query(
      `INSERT INTO requirements (requirement_id, name, description, actor, preconditions, postconditions, priority, category, dependencies, owner_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [validation.requirementId, String(input.name).trim(), String(input.description).trim(), String(input.actor).trim(), String(input.preconditions || "Not specified").trim(), String(input.postconditions || "Not specified").trim(), input.priority, input.category, String(input.dependencies || "").split(",").map((value) => value.trim()).filter(Boolean), actorId]
    );
    const requirementId = created.rows[0].id;
    await client.query("INSERT INTO requirement_changes (requirement_id, version, change_type, change_summary, changed_by) VALUES ($1, 1, 'created', $2, $3)", [requirementId, "Requirement created from traceability workspace.", actorId]);
    await client.query("INSERT INTO audit_logs (event_type, user_id, outcome, details) VALUES ('requirement_created', $1, 'success', $2::jsonb)", [actorId, JSON.stringify({ requirementId: validation.requirementId })]);
    await client.query("COMMIT");
    return { success: true, id: requirementId, message: "Requirement created successfully." };
  } catch (error) { await client.query("ROLLBACK"); if (error.code === "23505") return { success: false, message: "That requirement ID already exists." }; throw error; } finally { client.release(); }
}

async function updateCoverage(actorId, id, input = {}) {
  if (!coverageValues.includes(input.coverageStatus)) return { success: false, message: "Select a valid coverage status." };
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const requirement = await client.query("SELECT * FROM requirements WHERE id = $1 FOR UPDATE", [Number(id)]);
    if (!requirement.rows[0]) { await client.query("ROLLBACK"); return { success: false, message: "Requirement not found." }; }
    const current = requirement.rows[0];
    const nextVersion = Number(current.version) + 1;
    await client.query(
      `INSERT INTO requirement_traceability (requirement_id, user_story, ui_reference, api_reference, database_objects, test_case, sprint, release, coverage_status, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (requirement_id) DO UPDATE SET user_story=EXCLUDED.user_story, ui_reference=EXCLUDED.ui_reference, api_reference=EXCLUDED.api_reference, database_objects=EXCLUDED.database_objects, test_case=EXCLUDED.test_case, sprint=EXCLUDED.sprint, release=EXCLUDED.release, coverage_status=EXCLUDED.coverage_status, notes=EXCLUDED.notes, updated_at=CURRENT_TIMESTAMP`,
      [Number(id), String(input.userStory || "").trim(), String(input.uiReference || "").trim(), String(input.apiReference || "").trim(), String(input.databaseObjects || "").split(",").map((value) => value.trim()).filter(Boolean), String(input.testCase || "").trim(), String(input.sprint || "").trim(), String(input.release || "").trim(), input.coverageStatus, String(input.notes || "").trim()]
    );
    await client.query("UPDATE requirements SET version = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2", [nextVersion, Number(id)]);
    await client.query("INSERT INTO requirement_changes (requirement_id, version, change_type, change_summary, changed_by) VALUES ($1,$2,'updated',$3,$4)", [Number(id), nextVersion, `Traceability coverage updated to ${input.coverageStatus}.`, actorId]);
    await client.query("INSERT INTO audit_logs (event_type, user_id, outcome, details) VALUES ('requirement_traceability_updated', $1, 'success', $2::jsonb)", [actorId, JSON.stringify({ requirementId: Number(id), coverageStatus: input.coverageStatus, version: nextVersion })]);
    await client.query("COMMIT");
    return { success: true, message: "Traceability coverage updated." };
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}

module.exports = { getRequirements, getRequirementById, createRequirement, updateCoverage, priorityValues, categoryValues, coverageValues };
