const crypto = require("crypto");
const pool = require("../database/connection");

const PARTNERSHIP_REQUIREMENTS = [
  ["ACC-FRS-PART-001", "Third-party integration support", "External systems can connect through governed API, webhook, data-sharing, or embedded integrations.", "critical"],
  ["ACC-FRS-PART-002", "Partner onboarding", "Third-party partners are registered, issued credentials, and granted approved access.", "high"],
  ["ACC-FRS-PART-003", "API access for partners", "Approved partners can access secure, scoped partner APIs.", "critical"],
  ["ACC-FRS-PART-004", "Secure data exchange", "Partner communication records authentication, encryption posture, and exchange outcomes.", "critical"],
  ["ACC-FRS-PART-005", "Payment provider integration", "Financial partners can be configured for payment service integration.", "critical"],
  ["ACC-FRS-PART-006", "Logistics integration", "Logistics partners can exchange shipment tracking and delivery updates.", "high"],
  ["ACC-FRS-PART-007", "Government integration", "Government and regulatory integrations can verify business and trade data.", "high"],
  ["ACC-FRS-PART-008", "Partner monitoring", "Partner activity and performance metrics are persisted and reviewable.", "medium"],
  ["ACC-FRS-PART-009", "Partner access control", "Partner permissions are scoped and can be revoked.", "critical"],
  ["ACC-FRS-PART-010", "Partnership logging", "API calls, data exchanges, integration events, and decisions are logged.", "high"],
];

const partnerTypes = ["financial", "logistics", "government", "technology", "business_network"];
const integrationTypes = ["api", "webhook", "data_sharing", "embedded"];
const serviceAreas = ["payments", "logistics", "government", "analytics", "trade", "identity"];
const partnerStatuses = ["applicant", "onboarding", "active", "suspended", "rejected"];
const integrationStatuses = ["planned", "configured", "healthy", "degraded", "unavailable", "revoked"];
const accessScopes = ["partner.profile.read", "businesses.read", "listings.read", "orders.read", "payments.read", "logistics.read", "verification.write", "events.write"];

function createSecret() { return `acc_partner_${crypto.randomBytes(30).toString("base64url")}`; }
function hashSecret(value) { return crypto.createHash("sha256").update(String(value)).digest("hex"); }
function text(value, max = 240) { return String(value || "").trim().slice(0, max); }

async function ensureSchema() {
  await pool.query(`
    ALTER TABLE requirements DROP CONSTRAINT IF EXISTS requirements_requirement_id_check;
    ALTER TABLE requirements ADD CONSTRAINT requirements_requirement_id_check CHECK (requirement_id ~ '^(FR-[A-Z0-9]+|ACC-FRS-(PERF|MOB|AVAIL|SUP|LOG|QA|REL|ONB|AI|PART|ROAD))-[0-9]{3}$');
    CREATE TABLE IF NOT EXISTS partnership_partners (
      id BIGSERIAL PRIMARY KEY, legal_name VARCHAR(180) NOT NULL, display_name VARCHAR(160) NOT NULL,
      partner_type VARCHAR(40) NOT NULL CHECK (partner_type IN ('financial','logistics','government','technology','business_network')),
      country_code VARCHAR(3), contact_email VARCHAR(180) NOT NULL, status VARCHAR(30) NOT NULL DEFAULT 'applicant' CHECK (status IN ('applicant','onboarding','active','suspended','rejected')),
      api_client_id BIGINT REFERENCES api_clients(id) ON DELETE SET NULL, notes TEXT, created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
      approved_by BIGINT REFERENCES users(id) ON DELETE SET NULL, approved_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS partnership_integrations (
      id BIGSERIAL PRIMARY KEY, partner_id BIGINT NOT NULL REFERENCES partnership_partners(id) ON DELETE CASCADE, name VARCHAR(160) NOT NULL,
      integration_type VARCHAR(30) NOT NULL CHECK (integration_type IN ('api','webhook','data_sharing','embedded')), service_area VARCHAR(40) NOT NULL,
      provider VARCHAR(160) NOT NULL, endpoint_url TEXT, auth_method VARCHAR(60) NOT NULL DEFAULT 'api_key', status VARCHAR(30) NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','configured','healthy','degraded','unavailable','revoked')),
      configuration JSONB NOT NULL DEFAULT '{}'::jsonb, last_checked_at TIMESTAMPTZ, created_by BIGINT REFERENCES users(id) ON DELETE SET NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS partnership_credentials (
      id BIGSERIAL PRIMARY KEY, partner_id BIGINT NOT NULL REFERENCES partnership_partners(id) ON DELETE CASCADE, key_prefix VARCHAR(32) NOT NULL,
      secret_hash VARCHAR(128) NOT NULL UNIQUE, scopes JSONB NOT NULL DEFAULT '[]'::jsonb, status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked','expired')),
      issued_by BIGINT REFERENCES users(id) ON DELETE SET NULL, expires_at TIMESTAMPTZ, last_used_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, revoked_at TIMESTAMPTZ
    );
    CREATE TABLE IF NOT EXISTS partnership_access_grants (
      id BIGSERIAL PRIMARY KEY, partner_id BIGINT NOT NULL REFERENCES partnership_partners(id) ON DELETE CASCADE, scope VARCHAR(80) NOT NULL,
      granted_by BIGINT REFERENCES users(id) ON DELETE SET NULL, active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, revoked_at TIMESTAMPTZ,
      UNIQUE (partner_id, scope)
    );
    CREATE TABLE IF NOT EXISTS partnership_verifications (
      id BIGSERIAL PRIMARY KEY, partner_id BIGINT NOT NULL REFERENCES partnership_partners(id) ON DELETE CASCADE, verification_type VARCHAR(50) NOT NULL,
      reference_number VARCHAR(160), source_name VARCHAR(180) NOT NULL, status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','failed','expired')),
      evidence JSONB NOT NULL DEFAULT '{}'::jsonb, verified_by BIGINT REFERENCES users(id) ON DELETE SET NULL, verified_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS partnership_exchanges (
      id BIGSERIAL PRIMARY KEY, partner_id BIGINT REFERENCES partnership_partners(id) ON DELETE SET NULL, integration_id BIGINT REFERENCES partnership_integrations(id) ON DELETE SET NULL,
      direction VARCHAR(20) NOT NULL CHECK (direction IN ('inbound','outbound')), event_type VARCHAR(120) NOT NULL, external_reference VARCHAR(180),
      payload_hash VARCHAR(128), encrypted BOOLEAN NOT NULL DEFAULT TRUE, authenticated BOOLEAN NOT NULL DEFAULT TRUE, status VARCHAR(30) NOT NULL DEFAULT 'received',
      response_code INTEGER, latency_ms INTEGER, metadata JSONB NOT NULL DEFAULT '{}'::jsonb, occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS partnership_monitoring (
      id BIGSERIAL PRIMARY KEY, partner_id BIGINT NOT NULL REFERENCES partnership_partners(id) ON DELETE CASCADE, window_start TIMESTAMPTZ NOT NULL,
      request_count INTEGER NOT NULL DEFAULT 0, success_count INTEGER NOT NULL DEFAULT 0, failure_count INTEGER NOT NULL DEFAULT 0, average_latency_ms INTEGER NOT NULL DEFAULT 0,
      uptime_percent NUMERIC(6,2) NOT NULL DEFAULT 100, last_event_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE (partner_id, window_start)
    );
    CREATE TABLE IF NOT EXISTS partnership_audit_logs (
      id BIGSERIAL PRIMARY KEY, actor_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL, partner_id BIGINT REFERENCES partnership_partners(id) ON DELETE SET NULL,
      event_type VARCHAR(120) NOT NULL, outcome VARCHAR(30) NOT NULL DEFAULT 'success', details JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS partnership_exchange_created_idx ON partnership_exchanges(occurred_at DESC);
    CREATE INDEX IF NOT EXISTS partnership_audit_created_idx ON partnership_audit_logs(created_at DESC);
    CREATE INDEX IF NOT EXISTS partnership_credentials_hash_idx ON partnership_credentials(secret_hash);
  `);
  await pool.query(`INSERT INTO permissions (permission_key, resource, action, description) VALUES
    ('admin.partnerships.read','admin_partnerships','read','View partners, integrations, credentials, exchanges, metrics, and partnership audit evidence.'),
    ('admin.partnerships.manage','admin_partnerships','manage','Onboard partners, issue credentials, configure integrations, grant access, and manage partnership status.'),
    ('partner.profile.read','partner_profile','read','Read the authenticated partner profile and approved integration scope.'),
    ('partner.exchanges.write','partner_exchanges','create','Submit authenticated partner exchange events.')
    ON CONFLICT (permission_key) DO NOTHING`);
  await pool.query(`INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r CROSS JOIN permissions p WHERE r.role_key IN ('platform_admin','system_admin','acc_management_admin','super_admin') AND p.permission_key IN ('admin.partnerships.read','admin.partnerships.manage') ON CONFLICT DO NOTHING`);
  for (const [requirementId, name, description, priority] of PARTNERSHIP_REQUIREMENTS) {
    await pool.query(`INSERT INTO requirements (requirement_id,name,description,actor,preconditions,postconditions,priority,category,dependencies) VALUES ($1,$2,$3,'ACC partnership administrator','PostgreSQL, RBAC, and approved partner credentials are available.','Partner configuration, access, exchange evidence, metrics, and audit records are persisted.',$4,'functional',ARRAY['partnership_partners','partnership_integrations','partnership_exchanges','partnership_audit_logs']) ON CONFLICT (requirement_id) DO NOTHING`, [requirementId, name, description, priority]);
  }
}

async function audit(actorUserId, partnerId, eventType, details = {}, outcome = "success") {
  const result = await pool.query("INSERT INTO partnership_audit_logs (actor_user_id,partner_id,event_type,outcome,details) VALUES ($1,$2,$3,$4,$5) RETURNING id", [actorUserId || null, partnerId || null, eventType, outcome, details]);
  return result.rows[0];
}

async function getDashboard() {
  const [partners, integrations, exchanges, monitoring, audits, counts] = await Promise.all([
    pool.query(`SELECT p.*, COUNT(DISTINCT i.id)::integer AS integration_count, COUNT(DISTINCT c.id)::integer AS credential_count FROM partnership_partners p LEFT JOIN partnership_integrations i ON i.partner_id=p.id LEFT JOIN partnership_credentials c ON c.partner_id=p.id GROUP BY p.id ORDER BY p.created_at DESC`),
    pool.query(`SELECT i.*, p.display_name AS partner_name FROM partnership_integrations i JOIN partnership_partners p ON p.id=i.partner_id ORDER BY i.updated_at DESC`),
    pool.query(`SELECT e.*, p.display_name AS partner_name FROM partnership_exchanges e LEFT JOIN partnership_partners p ON p.id=e.partner_id ORDER BY e.occurred_at DESC LIMIT 50`),
    pool.query(`SELECT m.*, p.display_name AS partner_name FROM partnership_monitoring m JOIN partnership_partners p ON p.id=m.partner_id ORDER BY m.window_start DESC LIMIT 50`),
    pool.query(`SELECT a.*, p.display_name AS partner_name FROM partnership_audit_logs a LEFT JOIN partnership_partners p ON p.id=a.partner_id ORDER BY a.created_at DESC LIMIT 50`),
    pool.query(`SELECT COUNT(*)::integer AS total, COUNT(*) FILTER (WHERE status='active')::integer AS active, COUNT(*) FILTER (WHERE status IN ('applicant','onboarding'))::integer AS onboarding, (SELECT COUNT(*)::integer FROM partnership_integrations WHERE status IN ('healthy','configured')) AS healthy_integrations, (SELECT COUNT(*)::integer FROM partnership_exchanges WHERE occurred_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours') AS exchanges_24h, (SELECT COUNT(*)::integer FROM partnership_exchanges WHERE occurred_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours' AND status IN ('failed','rejected')) AS failed_24h FROM partnership_partners`),
  ]);
  return { partners: partners.rows, integrations: integrations.rows, exchanges: exchanges.rows, monitoring: monitoring.rows, audits: audits.rows, metrics: counts.rows[0] };
}

async function createPartner(actorUserId, input = {}) {
  const legalName = text(input.legalName, 180); const displayName = text(input.displayName || legalName, 160); const contactEmail = text(input.contactEmail, 180);
  if (!legalName || !displayName || !contactEmail || !partnerTypes.includes(input.partnerType)) return { success: false, message: "Legal name, display name, contact email, and a valid partner type are required." };
  const result = await pool.query(`INSERT INTO partnership_partners (legal_name,display_name,partner_type,country_code,contact_email,status,notes,created_by) VALUES ($1,$2,$3,$4,$5,'onboarding',$6,$7) RETURNING id`, [legalName, displayName, input.partnerType, text(input.countryCode, 3).toUpperCase() || null, contactEmail, text(input.notes, 2000) || null, actorUserId]);
  await audit(actorUserId, result.rows[0].id, "partner_registered", { displayName, partnerType: input.partnerType });
  return { success: true, partnerId: result.rows[0].id, message: "Partner registered and placed in onboarding." };
}

async function updatePartnerStatus(actorUserId, partnerId, status) {
  if (!partnerStatuses.includes(status)) throw new Error("Unsupported partner status.");
  const result = await pool.query(`UPDATE partnership_partners SET status=$1, approved_by=CASE WHEN $1='active' THEN $2 ELSE approved_by END, approved_at=CASE WHEN $1='active' THEN CURRENT_TIMESTAMP ELSE approved_at END, updated_at=CURRENT_TIMESTAMP WHERE id=$3 RETURNING id`, [status, actorUserId, Number(partnerId)]);
  if (!result.rowCount) throw new Error("Partner was not found.");
  await audit(actorUserId, partnerId, "partner_status_updated", { status }); return { success: true };
}

async function createIntegration(actorUserId, input = {}) {
  if (!Number(input.partnerId) || !integrationTypes.includes(input.integrationType) || !serviceAreas.includes(input.serviceArea)) return { success: false, message: "Partner, integration type, and service area are required." };
  const result = await pool.query(`INSERT INTO partnership_integrations (partner_id,name,integration_type,service_area,provider,endpoint_url,auth_method,status,configuration,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,'configured',$8,$9) RETURNING id`, [Number(input.partnerId), text(input.name, 160), input.integrationType, input.serviceArea, text(input.provider, 160), text(input.endpointUrl, 500) || null, text(input.authMethod, 60) || "api_key", input.configuration || {}, actorUserId]);
  await audit(actorUserId, input.partnerId, "integration_configured", { integrationId: result.rows[0].id, integrationType: input.integrationType, serviceArea: input.serviceArea }); return { success: true, message: "Integration configured." };
}

async function issueCredential(actorUserId, partnerId, scopes = []) {
  const selected = (Array.isArray(scopes) ? scopes : String(scopes || "").split(",")).filter((scope) => accessScopes.includes(scope));
  if (!selected.length) throw new Error("Select at least one approved partner scope.");
  const secret = createSecret(); const result = await pool.query("INSERT INTO partnership_credentials (partner_id,key_prefix,secret_hash,scopes,issued_by) VALUES ($1,$2,$3,$4,$5) RETURNING id, key_prefix AS \"keyPrefix\", scopes", [Number(partnerId), secret.slice(0, 20), hashSecret(secret), JSON.stringify(selected), actorUserId]);
  for (const scope of selected) await pool.query("INSERT INTO partnership_access_grants (partner_id,scope,granted_by) VALUES ($1,$2,$3) ON CONFLICT (partner_id,scope) DO UPDATE SET active=TRUE, revoked_at=NULL", [Number(partnerId), scope, actorUserId]);
  await audit(actorUserId, partnerId, "partner_credentials_issued", { credentialId: result.rows[0].id, scopes: selected }); return { success: true, secret, credential: result.rows[0] };
}

async function grantAccess(actorUserId, partnerId, scope) {
  if (!accessScopes.includes(scope)) throw new Error("Unsupported partner access scope.");
  await pool.query("INSERT INTO partnership_access_grants (partner_id,scope,granted_by) VALUES ($1,$2,$3) ON CONFLICT (partner_id,scope) DO UPDATE SET active=TRUE, revoked_at=NULL, granted_by=$3", [Number(partnerId), scope, actorUserId]);
  await audit(actorUserId, partnerId, "partner_access_granted", { scope }); return { success: true };
}

async function authenticatePartnerKey(secret) {
  if (!secret) return null;
  const result = await pool.query(`SELECT c.id,c.partner_id,c.scopes,p.display_name,p.status AS partner_status FROM partnership_credentials c JOIN partnership_partners p ON p.id=c.partner_id WHERE c.secret_hash=$1 AND c.status='active' AND p.status='active' AND (c.expires_at IS NULL OR c.expires_at>CURRENT_TIMESTAMP)`, [hashSecret(secret)]);
  if (!result.rows[0]) return null; const row = result.rows[0];
  await pool.query("UPDATE partnership_credentials SET last_used_at=CURRENT_TIMESTAMP WHERE id=$1", [row.id]);
  return { credentialId: Number(row.id), partnerId: Number(row.partner_id), partnerName: row.display_name, scopes: Array.isArray(row.scopes) ? row.scopes : [] };
}

async function recordExchange(input = {}) {
  const result = await pool.query(`INSERT INTO partnership_exchanges (partner_id,integration_id,direction,event_type,external_reference,payload_hash,encrypted,authenticated,status,response_code,latency_ms,metadata) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id,occurred_at AS \"occurredAt\"`, [input.partnerId, input.integrationId || null, input.direction || "inbound", text(input.eventType, 120), text(input.externalReference, 180) || null, hashSecret(JSON.stringify(input.payload || {})), input.encrypted !== false, input.authenticated !== false, input.status || "received", Number(input.responseCode || 200), Number(input.latencyMs || 0), input.metadata || {}]);
  await audit(input.actorUserId || null, input.partnerId, "data_exchange_recorded", { exchangeId: result.rows[0].id, eventType: input.eventType, direction: input.direction || "inbound" });
  return result.rows[0];
}

async function getPartnerProfile(partnerId) {
  const [partner, integrations, grants] = await Promise.all([pool.query("SELECT id,display_name,partner_type,country_code,status,contact_email FROM partnership_partners WHERE id=$1", [partnerId]), pool.query("SELECT id,name,integration_type,service_area,provider,status FROM partnership_integrations WHERE partner_id=$1", [partnerId]), pool.query("SELECT scope FROM partnership_access_grants WHERE partner_id=$1 AND active=TRUE", [partnerId])]);
  return { partner: partner.rows[0] || null, integrations: integrations.rows, scopes: grants.rows.map((row) => row.scope) };
}

module.exports = { PARTNERSHIP_REQUIREMENTS, partnerTypes, integrationTypes, serviceAreas, accessScopes, ensureSchema, getDashboard, createPartner, updatePartnerStatus, createIntegration, issueCredential, grantAccess, authenticatePartnerKey, recordExchange, getPartnerProfile };
