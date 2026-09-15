const pool = require("../database/connection");

const POLICY_DEFINITIONS = [
  { key: "terms", name: "Terms of Service", description: "The terms governing use of the ACC platform." },
  { key: "privacy", name: "Privacy Policy", description: "How ACC collects, uses, stores, and protects personal data." },
  { key: "aml", name: "AML and Sanctions Policy", description: "Anti-money laundering, counter-terrorist financing, and sanctions controls." },
];

async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS compliance_policies (
      id BIGSERIAL PRIMARY KEY,
      policy_key VARCHAR(80) NOT NULL,
      name VARCHAR(180) NOT NULL,
      description TEXT,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (policy_key)
    );
    CREATE TABLE IF NOT EXISTS compliance_policy_versions (
      id BIGSERIAL PRIMARY KEY,
      policy_id BIGINT NOT NULL REFERENCES compliance_policies(id) ON DELETE CASCADE,
      version VARCHAR(40) NOT NULL,
      content TEXT NOT NULL,
      effective_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      published_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (policy_id, version)
    );
    CREATE TABLE IF NOT EXISTS user_consent_records (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      policy_id BIGINT NOT NULL REFERENCES compliance_policies(id) ON DELETE RESTRICT,
      policy_version_id BIGINT NOT NULL REFERENCES compliance_policy_versions(id) ON DELETE RESTRICT,
      consented BOOLEAN NOT NULL,
      ip_address INET,
      user_agent TEXT,
      consented_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS compliance_kyc_cases (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status VARCHAR(30) NOT NULL DEFAULT 'not_started',
      risk_level VARCHAR(20) NOT NULL DEFAULT 'unknown',
      reviewer_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
      decision_notes TEXT,
      submitted_at TIMESTAMPTZ,
      reviewed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (user_id)
    );
    CREATE TABLE IF NOT EXISTS compliance_kyc_documents (
      id BIGSERIAL PRIMARY KEY,
      case_id BIGINT NOT NULL REFERENCES compliance_kyc_cases(id) ON DELETE CASCADE,
      document_type VARCHAR(60) NOT NULL,
      storage_path TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime_type VARCHAR(120) NOT NULL,
      file_size INTEGER NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'pending',
      reviewed_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
      review_notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      reviewed_at TIMESTAMPTZ
    );
    CREATE TABLE IF NOT EXISTS compliance_business_cases (
      id BIGSERIAL PRIMARY KEY,
      business_id BIGINT NOT NULL REFERENCES business_accounts(id) ON DELETE CASCADE,
      status VARCHAR(30) NOT NULL DEFAULT 'submitted',
      risk_level VARCHAR(20) NOT NULL DEFAULT 'unknown',
      reviewer_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
      decision_notes TEXT,
      submitted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      reviewed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (business_id)
    );
    CREATE TABLE IF NOT EXISTS compliance_transaction_flags (
      id BIGSERIAL PRIMARY KEY,
      payment_id BIGINT REFERENCES payments(id) ON DELETE SET NULL,
      order_id BIGINT REFERENCES orders(id) ON DELETE SET NULL,
      user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
      rule_key VARCHAR(100) NOT NULL,
      severity VARCHAR(20) NOT NULL DEFAULT 'medium',
      reason TEXT NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'open',
      reviewed_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
      resolution_notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      resolved_at TIMESTAMPTZ
    );
    CREATE TABLE IF NOT EXISTS compliance_aml_restrictions (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
      business_id BIGINT REFERENCES business_accounts(id) ON DELETE CASCADE,
      reason TEXT NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'active',
      created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      lifted_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
      lifted_at TIMESTAMPTZ,
      CHECK (user_id IS NOT NULL OR business_id IS NOT NULL)
    );
    CREATE TABLE IF NOT EXISTS compliance_cross_border_rules (
      id BIGSERIAL PRIMARY KEY,
      origin_country VARCHAR(3) NOT NULL,
      destination_country VARCHAR(3) NOT NULL,
      action VARCHAR(30) NOT NULL DEFAULT 'review',
      reason TEXT NOT NULL,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (origin_country, destination_country)
    );
    CREATE TABLE IF NOT EXISTS compliance_regulatory_reports (
      id BIGSERIAL PRIMARY KEY,
      report_type VARCHAR(80) NOT NULL,
      filters JSONB NOT NULL DEFAULT '{}'::jsonb,
      row_count INTEGER NOT NULL DEFAULT 0,
      generated_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS compliance_audit_logs (
      id BIGSERIAL PRIMARY KEY,
      actor_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
      subject_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
      event_type VARCHAR(120) NOT NULL,
      entity_type VARCHAR(80),
      entity_id BIGINT,
      outcome VARCHAR(30) NOT NULL DEFAULT 'success',
      details JSONB NOT NULL DEFAULT '{}'::jsonb,
      ip_address INET,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS compliance_flags_status_idx ON compliance_transaction_flags(status, severity);
    CREATE INDEX IF NOT EXISTS compliance_audit_created_idx ON compliance_audit_logs(created_at DESC);
  `);

  for (const policy of POLICY_DEFINITIONS) {
    const policyResult = await pool.query(
      `INSERT INTO compliance_policies (policy_key, name, description)
       VALUES ($1, $2, $3)
       ON CONFLICT (policy_key) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description
       RETURNING id`,
      [policy.key, policy.name, policy.description]
    );
    await pool.query(
      `INSERT INTO compliance_policy_versions (policy_id, version, content)
       VALUES ($1, '1.0', $2) ON CONFLICT (policy_id, version) DO NOTHING`,
      [policyResult.rows[0].id, `${policy.name}\n\n${policy.description}`]
    );
  }
}

async function recordAudit(eventType, details = {}, client = pool) {
  const result = await client.query(
    `INSERT INTO compliance_audit_logs
      (actor_user_id, subject_user_id, event_type, entity_type, entity_id, outcome, details, ip_address)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING id, event_type AS "eventType", outcome, created_at AS "createdAt"`,
    [details.actorUserId || null, details.subjectUserId || null, eventType,
      details.entityType || null, details.entityId || null, details.outcome || "success",
      details.details || {}, details.ipAddress || null]
  );
  return result.rows[0];
}

async function getDashboardSummary() {
  const result = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM compliance_kyc_cases WHERE status IN ('submitted','under_review')) AS pending_kyc,
      (SELECT COUNT(*) FROM compliance_business_cases WHERE status IN ('submitted','under_review')) AS pending_business,
      (SELECT COUNT(*) FROM compliance_transaction_flags WHERE status = 'open') AS open_flags,
      (SELECT COUNT(*) FROM compliance_aml_restrictions WHERE status = 'active') AS active_restrictions,
      (SELECT COUNT(*) FROM compliance_regulatory_reports WHERE created_at >= CURRENT_DATE) AS reports_today
  `);
  const row = result.rows[0];
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, Number(value)]));
}

async function getActivePolicies() {
  const result = await pool.query(`
    SELECT p.policy_key AS "policyKey", p.name, p.description,
      v.id AS "versionId", v.version, v.content, v.effective_at AS "effectiveAt"
    FROM compliance_policies p
    LEFT JOIN compliance_policy_versions v ON v.policy_id = p.id AND v.active = TRUE
    WHERE p.active = TRUE ORDER BY p.name, v.effective_at DESC
  `);
  return result.rows;
}

async function recordConsent(userId, policyKey, ipAddress, userAgent) {
  const result = await pool.query(`
    INSERT INTO user_consent_records (user_id, policy_id, policy_version_id, consented, ip_address, user_agent)
    SELECT $1, p.id, v.id, TRUE, $3, $4
    FROM compliance_policies p
    JOIN compliance_policy_versions v ON v.policy_id = p.id AND v.active = TRUE
    WHERE p.policy_key = $2
    ORDER BY v.effective_at DESC LIMIT 1
    RETURNING id, consented_at AS "consentedAt"`, [userId, policyKey, ipAddress || null, userAgent || null]);
  if (!result.rows[0]) throw new Error(`No active policy version exists for ${policyKey}.`);
  await recordAudit("consent_recorded", { subjectUserId: userId, entityType: "policy", entityId: result.rows[0].id, details: { policyKey } });
  return result.rows[0];
}

async function hasActiveRestriction(userId, businessId = null) {
  const result = await pool.query(
    `SELECT id, reason FROM compliance_aml_restrictions
     WHERE status = 'active' AND (user_id = $1 OR ($2::bigint IS NOT NULL AND business_id = $2)) LIMIT 1`,
    [userId || null, businessId || null]
  );
  return result.rows[0] || null;
}

async function createTransactionFlag(payload = {}) {
  const result = await pool.query(`
    INSERT INTO compliance_transaction_flags
      (payment_id, order_id, user_id, rule_key, severity, reason)
    VALUES ($1,$2,$3,$4,$5,$6)
    RETURNING id, status, severity, reason, created_at AS "createdAt"`,
    [payload.paymentId || null, payload.orderId || null, payload.userId || null,
      payload.ruleKey, payload.severity || "medium", payload.reason]
  );
  await recordAudit("transaction_flag_created", { subjectUserId: payload.userId, entityType: "transaction_flag", entityId: result.rows[0].id, details: payload });
  return result.rows[0];
}

async function getUserCompliance(userId) {
  const [kyc, consents, businesses] = await Promise.all([
    pool.query(`SELECT id, status, risk_level AS "riskLevel", decision_notes AS "decisionNotes", submitted_at AS "submittedAt", reviewed_at AS "reviewedAt" FROM compliance_kyc_cases WHERE user_id = $1`, [userId]),
    pool.query(`SELECT p.policy_key AS "policyKey", p.name, v.version, c.consented_at AS "consentedAt" FROM user_consent_records c JOIN compliance_policies p ON p.id = c.policy_id JOIN compliance_policy_versions v ON v.id = c.policy_version_id WHERE c.user_id = $1 ORDER BY c.consented_at DESC`, [userId]),
    pool.query(`SELECT b.id, b.business_name AS "businessName", b.verification_status AS "verificationStatus", c.status AS "complianceStatus", c.risk_level AS "riskLevel" FROM business_accounts b LEFT JOIN compliance_business_cases c ON c.business_id = b.id WHERE b.owner_id = $1 ORDER BY b.created_at DESC`, [userId]),
  ]);
  return { kyc: kyc.rows[0] || null, consents: consents.rows, businesses: businesses.rows };
}

async function submitKyc(userId, documents = []) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const caseResult = await client.query(`INSERT INTO compliance_kyc_cases (user_id, status, submitted_at, updated_at) VALUES ($1,'submitted',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) ON CONFLICT (user_id) DO UPDATE SET status='submitted', submitted_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP RETURNING id`, [userId]);
    for (const document of documents) {
      await client.query(`INSERT INTO compliance_kyc_documents (case_id, document_type, storage_path, original_name, mime_type, file_size) VALUES ($1,$2,$3,$4,$5,$6)`, [caseResult.rows[0].id, document.documentType, document.storagePath, document.originalName, document.mimeType, document.fileSize]);
    }
    await recordAudit("kyc_submitted", { subjectUserId: userId, entityType: "kyc_case", entityId: caseResult.rows[0].id, details: { documentCount: documents.length } }, client);
    await client.query("COMMIT");
    return { success: true, caseId: caseResult.rows[0].id };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

async function createBusinessCase(businessId, actorUserId) {
  const result = await pool.query(`
    INSERT INTO compliance_business_cases (business_id, status, submitted_at, updated_at)
    VALUES ($1, 'submitted', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT (business_id) DO UPDATE SET status = 'submitted', submitted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    RETURNING id`, [businessId]);
  await recordAudit("business_verification_submitted", { actorUserId, entityType: "business_case", entityId: result.rows[0].id, details: { businessId } });
  return result.rows[0];
}

async function getComplianceAdminData() {
  const [kyc, businesses, flags, restrictions, audit] = await Promise.all([
    pool.query(`SELECT c.id, c.user_id AS "userId", u.email, c.status, c.risk_level AS "riskLevel", c.submitted_at AS "submittedAt" FROM compliance_kyc_cases c JOIN users u ON u.id = c.user_id WHERE c.status IN ('submitted','under_review') ORDER BY c.submitted_at`),
    pool.query(`SELECT c.id, c.business_id AS "businessId", b.business_name AS "businessName", c.status, c.risk_level AS "riskLevel", c.submitted_at AS "submittedAt" FROM compliance_business_cases c JOIN business_accounts b ON b.id = c.business_id WHERE c.status IN ('submitted','under_review') ORDER BY c.submitted_at`),
    pool.query(`SELECT id, payment_id AS "paymentId", order_id AS "orderId", user_id AS "userId", rule_key AS "ruleKey", severity, reason, status, created_at AS "createdAt" FROM compliance_transaction_flags WHERE status = 'open' ORDER BY created_at DESC`),
    pool.query(`SELECT id, user_id AS "userId", business_id AS "businessId", reason, status, created_at AS "createdAt" FROM compliance_aml_restrictions WHERE status = 'active' ORDER BY created_at DESC`),
    pool.query(`SELECT id, actor_user_id AS "actorUserId", subject_user_id AS "subjectUserId", event_type AS "eventType", entity_type AS "entityType", outcome, created_at AS "createdAt" FROM compliance_audit_logs ORDER BY created_at DESC LIMIT 50`),
  ]);
  return { kyc: kyc.rows, businesses: businesses.rows, flags: flags.rows, restrictions: restrictions.rows, audit: audit.rows };
}

async function reviewKyc(reviewerId, caseId, status, notes = {}) {
  const allowed = ["under_review", "approved", "rejected", "needs_information"];
  if (!allowed.includes(status)) throw new Error("Unsupported KYC status.");
  const result = await pool.query(`UPDATE compliance_kyc_cases SET status=$1, decision_notes=$2, reviewer_id=$3, reviewed_at=CASE WHEN $1 IN ('approved','rejected') THEN CURRENT_TIMESTAMP ELSE reviewed_at END, updated_at=CURRENT_TIMESTAMP WHERE id=$4 RETURNING user_id AS "userId"`, [status, notes.notes || null, reviewerId, caseId]);
  if (!result.rows[0]) throw new Error("KYC case not found.");
  await recordAudit("kyc_reviewed", { actorUserId: reviewerId, subjectUserId: result.rows[0].userId, entityType: "kyc_case", entityId: caseId, details: { status } });
  return result.rows[0];
}

module.exports = {
  ensureSchema,
  recordAudit,
  getDashboardSummary,
  getActivePolicies,
  recordConsent,
  hasActiveRestriction,
  createTransactionFlag,
  getUserCompliance,
  submitKyc,
  createBusinessCase,
  getComplianceAdminData,
  reviewKyc,
};