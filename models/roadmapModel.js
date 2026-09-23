const pool = require("../database/connection");

const ROADMAP_REQUIREMENTS = [
  ["ACC-FRS-ROAD-001", "Roadmap management", "The system shall maintain a structured product roadmap.", "high"],
  ["ACC-FRS-ROAD-002", "Feature planning", "The system shall support planning of future features.", "high"],
  ["ACC-FRS-ROAD-003", "Innovation tracking", "The system shall track innovation initiatives.", "medium"],
  ["ACC-FRS-ROAD-004", "Feedback-driven development", "The system shall incorporate user feedback into roadmap decisions.", "high"],
  ["ACC-FRS-ROAD-005", "Technology evaluation", "The system shall evaluate new technologies for adoption.", "medium"],
  ["ACC-FRS-ROAD-006", "Roadmap visibility", "The system shall provide visibility of future plans to stakeholders.", "medium"],
  ["ACC-FRS-ROAD-007", "Strategic alignment", "The system shall align roadmap with business goals.", "high"],
  ["ACC-FRS-ROAD-008", "Incremental delivery", "The system shall deliver features in phases.", "high"],
  ["ACC-FRS-ROAD-009", "Scalability planning", "The system shall plan for future scalability.", "high"],
  ["ACC-FRS-ROAD-010", "Roadmap audit logging", "The system shall log roadmap changes.", "medium"],
];

const phaseStatuses = ["planned", "active", "completed", "paused"];
const featureStatuses = ["idea", "planned", "in_progress", "pilot", "released", "deferred", "cancelled"];
const priorities = ["critical", "high", "medium", "low"];
const evaluationStatuses = ["proposed", "researching", "pilot", "adopted", "rejected", "deferred"];
const feedbackStatuses = ["new", "reviewed", "accepted", "declined", "converted"];

function clean(value, max = 240) { return String(value || "").trim().slice(0, max); }
function numberOrNull(value) { return Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : null; }

async function ensureSchema() {
  await pool.query(`
    ALTER TABLE requirements DROP CONSTRAINT IF EXISTS requirements_requirement_id_check;
    ALTER TABLE requirements ADD CONSTRAINT requirements_requirement_id_check CHECK (requirement_id ~ '^(FR-[A-Z0-9]+|ACC-FRS-(PERF|MOB|AVAIL|SUP|LOG|QA|REL|ONB|AI|PART|ROAD))-[0-9]{3}$');
    CREATE TABLE IF NOT EXISTS roadmap_phases (
      id BIGSERIAL PRIMARY KEY, phase_key VARCHAR(40) NOT NULL UNIQUE, name VARCHAR(160) NOT NULL, description TEXT NOT NULL,
      sequence_number INTEGER NOT NULL UNIQUE CHECK (sequence_number > 0), status VARCHAR(20) NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','active','completed','paused')),
      target_start DATE, target_end DATE, owner_id BIGINT REFERENCES users(id) ON DELETE SET NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS roadmap_goals (
      id BIGSERIAL PRIMARY KEY, title VARCHAR(220) NOT NULL, description TEXT NOT NULL, goal_area VARCHAR(100) NOT NULL, metric_name VARCHAR(120), target_value VARCHAR(120), status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','achieved','paused','retired')), owner_id BIGINT REFERENCES users(id) ON DELETE SET NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS roadmap_features (
      id BIGSERIAL PRIMARY KEY, phase_id BIGINT REFERENCES roadmap_phases(id) ON DELETE SET NULL, goal_id BIGINT REFERENCES roadmap_goals(id) ON DELETE SET NULL,
      title VARCHAR(220) NOT NULL, description TEXT NOT NULL, priority VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (priority IN ('critical','high','medium','low')),
      status VARCHAR(30) NOT NULL DEFAULT 'idea' CHECK (status IN ('idea','planned','in_progress','pilot','released','deferred','cancelled')), stakeholder_visibility VARCHAR(20) NOT NULL DEFAULT 'public' CHECK (stakeholder_visibility IN ('public','stakeholder','internal')),
      target_quarter VARCHAR(20), release_plan_id BIGINT REFERENCES release_plans(id) ON DELETE SET NULL, owner_id BIGINT REFERENCES users(id) ON DELETE SET NULL, created_by BIGINT REFERENCES users(id) ON DELETE SET NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS roadmap_innovations (
      id BIGSERIAL PRIMARY KEY, title VARCHAR(220) NOT NULL, description TEXT NOT NULL, category VARCHAR(100) NOT NULL, hypothesis TEXT, expected_value TEXT,
      status VARCHAR(30) NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','researching','pilot','adopted','rejected','deferred')), owner_id BIGINT REFERENCES users(id) ON DELETE SET NULL, created_by BIGINT REFERENCES users(id) ON DELETE SET NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS roadmap_technology_evaluations (
      id BIGSERIAL PRIMARY KEY, technology_name VARCHAR(180) NOT NULL, category VARCHAR(100) NOT NULL, use_case TEXT NOT NULL, evaluation_criteria JSONB NOT NULL DEFAULT '{}'::jsonb,
      recommendation TEXT, status VARCHAR(30) NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','researching','pilot','adopted','rejected','deferred')), evaluated_by BIGINT REFERENCES users(id) ON DELETE SET NULL, evaluated_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS roadmap_feedback (
      id BIGSERIAL PRIMARY KEY, feature_id BIGINT REFERENCES roadmap_features(id) ON DELETE SET NULL, user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
      stakeholder_name VARCHAR(160), stakeholder_email VARCHAR(180), feedback_type VARCHAR(50) NOT NULL DEFAULT 'suggestion', rating INTEGER CHECK (rating IS NULL OR rating BETWEEN 1 AND 5), message TEXT NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'new' CHECK (status IN ('new','reviewed','accepted','declined','converted')), created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, reviewed_at TIMESTAMPTZ, reviewed_by BIGINT REFERENCES users(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS roadmap_scalability_plans (
      id BIGSERIAL PRIMARY KEY, area VARCHAR(120) NOT NULL, current_capacity VARCHAR(180) NOT NULL, target_capacity VARCHAR(180) NOT NULL, strategy TEXT NOT NULL,
      target_date DATE, status VARCHAR(20) NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','in_progress','ready','completed','blocked')), owner_id BIGINT REFERENCES users(id) ON DELETE SET NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS roadmap_audit_logs (
      id BIGSERIAL PRIMARY KEY, actor_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL, entity_type VARCHAR(80) NOT NULL, entity_id BIGINT, event_type VARCHAR(100) NOT NULL,
      previous_value JSONB, next_value JSONB, details JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS roadmap_features_status_idx ON roadmap_features(status, priority);
    CREATE INDEX IF NOT EXISTS roadmap_feedback_status_idx ON roadmap_feedback(status, created_at DESC);
    CREATE INDEX IF NOT EXISTS roadmap_audit_created_idx ON roadmap_audit_logs(created_at DESC);
  `);
  const phases = [
    ["phase-1", "Core platform", "Registration, marketplace, payments, compliance, and analytics.", 1, "completed"],
    ["phase-2", "Expansion & optimization", "Advanced analytics, mobile, discovery, UX, and regional expansion.", 2, "active"],
    ["phase-3", "Intelligence & automation", "AI recommendations, prediction, workflow automation, and fraud controls.", 3, "active"],
    ["phase-4", "Ecosystem integration", "Banks, government, logistics, and partner marketplace capabilities.", 4, "active"],
    ["phase-5", "Continental infrastructure", "Cross-border trade, identity, payments, financing, and credit systems.", 5, "planned"],
  ];
  for (const phase of phases) await pool.query("INSERT INTO roadmap_phases (phase_key,name,description,sequence_number,status) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (phase_key) DO UPDATE SET name=EXCLUDED.name, description=EXCLUDED.description, status=EXCLUDED.status, updated_at=CURRENT_TIMESTAMP", phase);
  await pool.query("INSERT INTO permissions (permission_key,resource,action,description) VALUES ('roadmap.read','roadmap','read','View the public product roadmap and future plans.'),('admin.roadmap.read','admin_roadmap','read','View roadmap planning, innovation, technology, feedback, goals, and audit evidence.'),('admin.roadmap.manage','admin_roadmap','manage','Manage roadmap phases, features, innovation, technology evaluations, feedback, strategy, and scalability plans.') ON CONFLICT (permission_key) DO NOTHING");
  await pool.query("INSERT INTO role_permissions (role_id,permission_id) SELECT r.id,p.id FROM roles r CROSS JOIN permissions p WHERE r.role_key IN ('platform_admin','system_admin','acc_management_admin','super_admin') AND p.permission_key IN ('admin.roadmap.read','admin.roadmap.manage') ON CONFLICT DO NOTHING");
  await pool.query("INSERT INTO role_permissions (role_id,permission_id) SELECT r.id,p.id FROM roles r CROSS JOIN permissions p WHERE r.role_key IN ('registered_user','verified_user','business_member','business_admin') AND p.permission_key='roadmap.read' ON CONFLICT DO NOTHING");
  for (const [requirementId, name, description, priority] of ROADMAP_REQUIREMENTS) await pool.query("INSERT INTO requirements (requirement_id,name,description,actor,preconditions,postconditions,priority,category,dependencies) VALUES ($1,$2,$3,'ACC roadmap administrator','PostgreSQL and governance access are available.','Roadmap decisions, stakeholder feedback, delivery progress, and audit evidence are persisted.',$4,'functional',ARRAY['roadmap_phases','roadmap_features','roadmap_audit_logs']) ON CONFLICT (requirement_id) DO NOTHING", [requirementId, name, description, priority]);
}

async function audit(actorId, entityType, entityId, eventType, previousValue = null, nextValue = null, details = {}) { await pool.query("INSERT INTO roadmap_audit_logs (actor_user_id,entity_type,entity_id,event_type,previous_value,next_value,details) VALUES ($1,$2,$3,$4,$5,$6,$7)", [actorId || null, entityType, entityId || null, eventType, previousValue, nextValue, details]); }

async function getRoadmap(includeInternal = false) {
  const visibility = includeInternal ? "" : "AND f.stakeholder_visibility='public'";
  const [phases, features, goals, innovations, evaluations, feedback] = await Promise.all([
    pool.query("SELECT * FROM roadmap_phases ORDER BY sequence_number"),
    pool.query(`SELECT f.*, p.name AS phase_name, g.title AS goal_title FROM roadmap_features f LEFT JOIN roadmap_phases p ON p.id=f.phase_id LEFT JOIN roadmap_goals g ON g.id=f.goal_id WHERE f.status <> 'cancelled' ${visibility} ORDER BY COALESCE(p.sequence_number,99), CASE f.priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END, f.created_at DESC`),
    pool.query("SELECT * FROM roadmap_goals WHERE status <> 'retired' ORDER BY created_at DESC"),
    pool.query("SELECT * FROM roadmap_innovations ORDER BY created_at DESC LIMIT 30"),
    pool.query("SELECT * FROM roadmap_technology_evaluations ORDER BY created_at DESC LIMIT 30"),
    includeInternal ? pool.query("SELECT f.*, u.name AS user_name FROM roadmap_feedback f LEFT JOIN users u ON u.id=f.user_id ORDER BY f.created_at DESC LIMIT 50") : pool.query("SELECT id,feature_id,feedback_type,rating,message,created_at FROM roadmap_feedback WHERE status IN ('new','accepted','converted') ORDER BY created_at DESC LIMIT 20"),
  ]);
  return { phases: phases.rows, features: features.rows, goals: goals.rows, innovations: innovations.rows, evaluations: evaluations.rows, feedback: feedback.rows };
}

async function getAdminDashboard() { const roadmap = await getRoadmap(true); const [scalability, auditLogs, counts] = await Promise.all([pool.query("SELECT * FROM roadmap_scalability_plans ORDER BY target_date NULLS LAST, created_at DESC"), pool.query("SELECT * FROM roadmap_audit_logs ORDER BY created_at DESC LIMIT 50"), pool.query("SELECT COUNT(*)::integer AS features, COUNT(*) FILTER (WHERE status IN ('planned','in_progress','pilot'))::integer AS active_features, COUNT(*) FILTER (WHERE status='released')::integer AS released_features, (SELECT COUNT(*)::integer FROM roadmap_feedback WHERE status='new') AS new_feedback, (SELECT COUNT(*)::integer FROM roadmap_innovations WHERE status IN ('proposed','researching','pilot')) AS active_innovations, (SELECT COUNT(*)::integer FROM roadmap_technology_evaluations WHERE status IN ('proposed','researching','pilot')) AS open_evaluations FROM roadmap_features")]); return { ...roadmap, scalability: scalability.rows, auditLogs: auditLogs.rows, metrics: counts.rows[0] }; }

async function createFeature(actorId, input = {}) { if (!clean(input.title) || !clean(input.description) || !priorities.includes(input.priority || "medium")) return { success: false, message: "Feature title, description, and a valid priority are required." }; const result = await pool.query("INSERT INTO roadmap_features (phase_id,goal_id,title,description,priority,status,stakeholder_visibility,target_quarter,release_plan_id,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id", [numberOrNull(input.phaseId), numberOrNull(input.goalId), clean(input.title,220), clean(input.description,2000), input.priority || "medium", featureStatuses.includes(input.status) ? input.status : "idea", ["public","stakeholder","internal"].includes(input.visibility) ? input.visibility : "public", clean(input.targetQuarter,20) || null, numberOrNull(input.releasePlanId), actorId]); await audit(actorId,"feature",result.rows[0].id,"feature_created",null,input); return { success: true, message: "Roadmap feature created." }; }
async function updateFeature(actorId, id, input = {}) { if (!featureStatuses.includes(input.status)) throw new Error("Unsupported feature status."); const previous = await pool.query("SELECT status,priority,stakeholder_visibility FROM roadmap_features WHERE id=$1", [Number(id)]); const result = await pool.query("UPDATE roadmap_features SET status=$1,priority=$2,stakeholder_visibility=$3,updated_at=CURRENT_TIMESTAMP WHERE id=$4 RETURNING id", [input.status, priorities.includes(input.priority) ? input.priority : "medium", ["public","stakeholder","internal"].includes(input.visibility) ? input.visibility : "public", Number(id)]); if (!result.rowCount) throw new Error("Roadmap feature was not found."); await audit(actorId,"feature",id,"feature_updated",previous.rows[0],input); return { success: true, message: "Roadmap feature updated." }; }
async function createInnovation(actorId, input = {}) { const result = await pool.query("INSERT INTO roadmap_innovations (title,description,category,hypothesis,expected_value,status,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id", [clean(input.title,220), clean(input.description,2000), clean(input.category,100), clean(input.hypothesis,2000) || null, clean(input.expectedValue,2000) || null, evaluationStatuses.includes(input.status) ? input.status : "proposed", actorId]); await audit(actorId,"innovation",result.rows[0].id,"innovation_created",null,input); return { success: true, message: "Innovation initiative recorded." }; }
async function createEvaluation(actorId, input = {}) { const result = await pool.query("INSERT INTO roadmap_technology_evaluations (technology_name,category,use_case,evaluation_criteria,recommendation,status,evaluated_by,evaluated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,CURRENT_TIMESTAMP) RETURNING id", [clean(input.technologyName,180), clean(input.category,100), clean(input.useCase,2000), input.criteria || {}, clean(input.recommendation,2000) || null, evaluationStatuses.includes(input.status) ? input.status : "proposed", actorId]); await audit(actorId,"technology_evaluation",result.rows[0].id,"technology_evaluated",null,input); return { success: true, message: "Technology evaluation recorded." }; }
async function createGoal(actorId, input = {}) { const result = await pool.query("INSERT INTO roadmap_goals (title,description,goal_area,metric_name,target_value,owner_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id", [clean(input.title,220), clean(input.description,2000), clean(input.goalArea,100), clean(input.metricName,120) || null, clean(input.targetValue,120) || null, actorId]); await audit(actorId,"goal",result.rows[0].id,"strategic_goal_created",null,input); return { success: true, message: "Strategic goal recorded." }; }
async function createScalabilityPlan(actorId, input = {}) { const result = await pool.query("INSERT INTO roadmap_scalability_plans (area,current_capacity,target_capacity,strategy,target_date,owner_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id", [clean(input.area,120), clean(input.currentCapacity,180), clean(input.targetCapacity,180), clean(input.strategy,2000), input.targetDate || null, actorId]); await audit(actorId,"scalability_plan",result.rows[0].id,"scalability_plan_created",null,input); return { success: true, message: "Scalability plan recorded." }; }
async function submitFeedback(userId, input = {}) { const result = await pool.query("INSERT INTO roadmap_feedback (feature_id,user_id,stakeholder_name,stakeholder_email,feedback_type,rating,message) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id", [numberOrNull(input.featureId), userId || null, clean(input.stakeholderName,160) || null, clean(input.stakeholderEmail,180) || null, clean(input.feedbackType,50) || "suggestion", input.rating ? Number(input.rating) : null, clean(input.message,3000)]); await audit(userId,"feedback",result.rows[0].id,"feedback_submitted",null,input); return { success: true, message: "Roadmap feedback submitted." }; }
async function updateFeedback(actorId, id, status) { if (!feedbackStatuses.includes(status)) throw new Error("Unsupported feedback status."); const result = await pool.query("UPDATE roadmap_feedback SET status=$1,reviewed_by=$2,reviewed_at=CURRENT_TIMESTAMP WHERE id=$3 RETURNING id", [status, actorId, Number(id)]); if (!result.rowCount) throw new Error("Feedback was not found."); await audit(actorId,"feedback",id,"feedback_status_updated",null,{ status }); return { success: true, message: "Feedback status updated." }; }

module.exports = { ROADMAP_REQUIREMENTS, phaseStatuses, featureStatuses, priorities, evaluationStatuses, feedbackStatuses, ensureSchema, getRoadmap, getAdminDashboard, createFeature, updateFeature, createInnovation, createEvaluation, createGoal, createScalabilityPlan, submitFeedback, updateFeedback };
