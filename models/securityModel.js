const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const pool = require("../database/connection");
const { generateVerificationCode, sendAccountVerificationEmail, sendAccountVerificationSms } = require("../utility/emailService");

const DEFAULT_POLICY = Object.freeze({
  loginLockout: { maxAttempts: 5, durationMinutes: 10 },
  mfaChallenge: { expiryMinutes: 10, maxAttempts: 5 },
  session: { timeoutMinutes: 30, rememberDays: 7 },
});

function hashValue(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex");
}

function requestDetails(context = {}) {
  return {
    ipAddress: context.ipAddress || null,
    userAgent: context.userAgent || null,
  };
}

async function recordAudit(eventType, outcome, details = {}, context = {}) {
  const meta = requestDetails(context);
  const result = await pool.query(
    `INSERT INTO security_audit_logs (user_id, actor_id, event_type, outcome, ip_address, user_agent, details)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [details.userId || null, details.actorId || details.userId || null, eventType, outcome, meta.ipAddress, meta.userAgent, details]
  );
  return result.rows[0];
}

async function recordLoginAttempt(identifier, outcome, success, context = {}, userId = null, details = {}) {
  const meta = requestDetails(context);
  const result = await pool.query(
    `INSERT INTO security_login_attempts (user_id, identifier_hash, ip_address, user_agent, success, outcome, details)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, outcome, success, created_at`,
    [userId, hashValue(identifier), meta.ipAddress, meta.userAgent, Boolean(success), outcome, details]
  );
  await recordAudit(success ? "login_success" : "login_failure", success ? "success" : outcome, { userId, identifierHash: hashValue(identifier), ...details }, context);
  return result.rows[0];
}

async function getPolicy(policyKey) {
  const result = await pool.query("SELECT policy_value FROM security_policies WHERE policy_key = $1", [policyKey]);
  const fallbackKey = policyKey === "login_lockout" ? "loginLockout" : policyKey === "mfa_challenge" ? "mfaChallenge" : "session";
  return result.rows[0] ? result.rows[0].policy_value : DEFAULT_POLICY[fallbackKey];
}

async function listMfaMethods(userId) {
  const result = await pool.query(
    `SELECT id, method_type AS "methodType", destination, enabled, verified_at AS "verifiedAt", created_at AS "createdAt"
     FROM security_mfa_methods WHERE user_id = $1 ORDER BY created_at`,
    [userId]
  );
  return result.rows;
}

async function getEnabledMfaMethod(userId) {
  const result = await pool.query(
    `SELECT * FROM security_mfa_methods WHERE user_id = $1 AND enabled = TRUE ORDER BY verified_at DESC NULLS LAST LIMIT 1`,
    [userId]
  );
  return result.rows[0] || null;
}

async function createMfaChallenge(userId, method, purpose = "login", context = {}) {
  const policy = await getPolicy("mfa_challenge");
  const code = generateVerificationCode();
  const challengeToken = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + Number(policy.expiryMinutes || 10) * 60 * 1000);
  const result = await pool.query(
    `INSERT INTO security_mfa_challenges (user_id, method_id, challenge_hash, code_hash, purpose, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, expires_at AS "expiresAt"`,
    [userId, method.id, hashValue(challengeToken), hashValue(code), purpose, expiresAt]
  );

  const userResult = await pool.query("SELECT first_name, email, phone FROM users WHERE id = $1", [userId]);
  const user = userResult.rows[0];
  const delivery = method.method_type === "sms"
    ? await sendAccountVerificationSms({ to: method.destination || user.phone, firstName: user.first_name, verificationCode: code })
    : await sendAccountVerificationEmail({ to: method.destination || user.email, firstName: user.first_name, verificationCode: code });

  await recordAudit("mfa_challenge_created", delivery.success ? "delivered" : "delivery_failed", { userId, purpose, method: method.method_type, challengeId: result.rows[0].id }, context);
  return { token: challengeToken, expiresAt: result.rows[0].expiresAt, method: method.method_type, delivery };
}

async function verifyMfaChallenge(userId, token, code, context = {}) {
  const policy = await getPolicy("mfa_challenge");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `SELECT * FROM security_mfa_challenges
       WHERE user_id = $1 AND challenge_hash = $2 AND consumed_at IS NULL
       ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
      [userId, hashValue(token)]
    );
    const challenge = result.rows[0];
    if (!challenge || new Date(challenge.expires_at).getTime() <= Date.now()) {
      await client.query("ROLLBACK");
      await recordAudit("mfa_verification", "expired_or_missing", { userId }, context);
      return { success: false, message: "This verification code has expired. Request a new code." };
    }
    if (challenge.attempts >= Number(policy.maxAttempts || 5)) {
      await client.query("ROLLBACK");
      await recordAudit("mfa_verification", "attempt_limit", { userId }, context);
      return { success: false, message: "Too many verification attempts. Request a new code." };
    }
    const valid = hashValue(code) === challenge.code_hash;
    await client.query("UPDATE security_mfa_challenges SET attempts = attempts + 1, consumed_at = CASE WHEN $1 THEN NOW() ELSE consumed_at END WHERE id = $2", [valid, challenge.id]);
    await client.query("COMMIT");
    await recordAudit("mfa_verification", valid ? "success" : "invalid_code", { userId, challengeId: challenge.id }, context);
    return valid ? { success: true } : { success: false, message: "The verification code is incorrect." };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function listAlerts(userId, limit = 30) {
  const result = await pool.query(
    `SELECT id, alert_type AS "alertType", severity, title, message, status, ip_address AS "ipAddress", created_at AS "createdAt"
     FROM security_alerts WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [userId, Number(limit)]
  );
  return result.rows;
}

async function createAlert(userId, alert, context = {}) {
  const meta = requestDetails(context);
  const result = await pool.query(
    `INSERT INTO security_alerts (user_id, alert_type, severity, title, message, ip_address, user_agent, details)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [userId, alert.type, alert.severity || "medium", alert.title, alert.message, meta.ipAddress, meta.userAgent, alert.details || {}]
  );
  await recordAudit("security_alert_created", "success", { userId, alertId: result.rows[0].id, alertType: alert.type }, context);
  return result.rows[0];
}

async function getAdminOverview(filters = {}) {
  const search = String(filters.search || "").trim();
  const result = await pool.query(
    `SELECT sal.id, sal.event_type AS "eventType", sal.outcome, sal.ip_address AS "ipAddress", sal.created_at AS "createdAt",
            sal.details, u.email, u.name
     FROM security_audit_logs sal LEFT JOIN users u ON u.id = sal.user_id
     WHERE ($1 = '' OR sal.event_type ILIKE '%' || $1 || '%' OR sal.outcome ILIKE '%' || $1 || '%' OR u.email ILIKE '%' || $1 || '%')
     ORDER BY sal.created_at DESC LIMIT 100`,
    [search]
  );
  const [alerts, attempts] = await Promise.all([
    pool.query(`SELECT sa.*, u.email FROM security_alerts sa LEFT JOIN users u ON u.id = sa.user_id ORDER BY sa.created_at DESC LIMIT 50`),
    pool.query(`SELECT outcome, COUNT(*)::integer AS count FROM security_login_attempts WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours' GROUP BY outcome ORDER BY count DESC`),
  ]);
  return { auditLogs: result.rows, alerts: alerts.rows, attempts: attempts.rows };
}

async function enrollMfaMethod(userId, methodType, destination, context = {}) {
  const allowed = new Set(["email", "sms"]);
  if (!allowed.has(methodType)) return { success: false, message: "Select a supported MFA method." };
  const result = await pool.query(
    `INSERT INTO security_mfa_methods (user_id, method_type, destination, enabled)
     VALUES ($1, $2, $3, FALSE)
     ON CONFLICT (user_id, method_type) DO UPDATE SET destination = EXCLUDED.destination, updated_at = NOW()
     RETURNING id, method_type AS "methodType", destination`,
    [userId, methodType, destination || null]
  );
  const challenge = await createMfaChallenge(userId, result.rows[0], "enrollment", context);
  return { success: true, method: result.rows[0], challenge };
}

async function confirmMfaEnrollment(userId, token, code, context = {}) {
  const verification = await verifyMfaChallenge(userId, token, code, context);
  if (!verification.success) return verification;
  const result = await pool.query(
    `UPDATE security_mfa_methods SET enabled = TRUE, verified_at = NOW(), updated_at = NOW()
     WHERE id = (SELECT method_id FROM security_mfa_challenges WHERE user_id = $1 AND challenge_hash = $2 LIMIT 1)
     RETURNING id`,
    [userId, hashValue(token)]
  );
  await pool.query("UPDATE users SET mfa_enabled = TRUE, updated_at = NOW() WHERE id = $1", [userId]);
  await recordAudit("mfa_enabled", "success", { userId, methodId: result.rows[0] && result.rows[0].id }, context);
  return { success: true };
}

async function disableMfa(userId, context = {}) {
  await pool.query("UPDATE security_mfa_methods SET enabled = FALSE, updated_at = NOW() WHERE user_id = $1", [userId]);
  await pool.query("UPDATE users SET mfa_enabled = FALSE, updated_at = NOW() WHERE id = $1", [userId]);
  await recordAudit("mfa_disabled", "success", { userId }, context);
  return { success: true };
}

module.exports = {
  hashValue,
  recordAudit,
  recordLoginAttempt,
  getPolicy,
  listMfaMethods,
  getEnabledMfaMethod,
  createMfaChallenge,
  verifyMfaChallenge,
  listAlerts,
  createAlert,
  getAdminOverview,
  enrollMfaMethod,
  confirmMfaEnrollment,
  disableMfa,
  bcrypt,
};
