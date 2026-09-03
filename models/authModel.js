const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const pool = require("../database/connection");
const { validatePassword } = require("../utility/account-validation");
const {
  sendPasswordResetEmail,
  sendAccountVerificationEmail,
  sendAccountVerificationSms,
  generateVerificationCode,
} = require("../utility/emailService");

const auditEntries = [];
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 10 * 60 * 1000;
const auditLogPath = path.join(__dirname, "..", "logs", "auth-audit.log");

fs.mkdirSync(path.dirname(auditLogPath), { recursive: true });

function fileLogEvent(eventType, details = {}) {
  const entry = {
    id: `${Date.now()}-${auditEntries.length + 1}`,
    eventType,
    timestamp: new Date().toISOString(),
    details,
  };

  auditEntries.push(entry);
  fs.appendFileSync(auditLogPath, `${JSON.stringify(entry)}\n`);
  return entry;
}

async function logEvent(eventType, details = {}) {
  if (!pool) {
    console.error("Database not available for logging event:", eventType);
    return fileLogEvent(eventType, details);
  }

  const { userId, outcome } = details || {};
  const text = `INSERT INTO audit_logs(event_type, user_id, outcome, details) VALUES($1,$2,$3,$4) RETURNING *`;
  const vals = [eventType, userId || null, outcome || null, details];

  try {
    const res = await pool.query(text, vals);
    return res.rows[0];
  } catch (err) {
    console.error("Failed to log audit event:", err && err.message ? err.message : err);
    return fileLogEvent(eventType, details);
  }
}

function normalizePhone(value) {
  return String(value || "").replace(/\s+/g, "").trim();
}

function buildResetToken() {
  return crypto.randomBytes(24).toString("hex");
}

function buildFullName(firstName, lastName, middleName) {
  const parts = [firstName, middleName, lastName].filter(Boolean).map((part) => String(part).trim());
  return parts.join(" ") || "Member";
}

async function createUser(userData) {
  const firstName = String(userData.firstName || userData.first_name || userData.name || "").trim();
  const lastName = String(userData.lastName || userData.last_name || "").trim();
  const middleName = String(userData.middleName || userData.middle_name || "").trim();
  const email = userData.email ? userData.email.trim().toLowerCase() : "";
  const phone = normalizePhone(userData.phone || userData.mobile);
  const country = String(userData.country || "").trim();
  const password = String(userData.password || "");
  const password2 = String(userData.password2 || userData.confirmPassword || "");
  const acceptedTerms = userData.acceptTerms ?? userData.acceptedTerms ?? userData.terms ?? userData.termsAccepted;
  const acceptedPrivacy = userData.acceptPrivacy ?? userData.acceptedPrivacy ?? userData.privacy ?? userData.privacyAccepted;
  const preferredLanguage = String(userData.preferredLanguage || "").trim();
  const referralCode = String(userData.referralCode || "").trim();
  const organizationName = String(userData.organizationName || "").trim();

  if (!firstName || !lastName || !email || !phone || !country || !password || !password2) {
    return { success: false, message: "First name, last name, email, mobile, country, password, and confirm password are required." };
  }

  const passwordErrors = validatePassword(password, password2);
  if (passwordErrors.length > 0) {
    return { success: false, message: passwordErrors.join(" ") };
  }

  if (!acceptedTerms || acceptedTerms === "false") {
    return { success: false, message: "You must accept the Terms of Service." };
  }

  if (!acceptedPrivacy || acceptedPrivacy === "false") {
    return { success: false, message: "You must accept the Privacy Policy." };
  }

  if (!pool) {
    return { success: false, message: "Database connection is not available. Please ensure PostgreSQL is configured." };
  }

  let client;
  try {
    client = await pool.connect();
  } catch (connErr) {
    console.error("Database connection failed:", connErr && connErr.message ? connErr.message : connErr);
    return { success: false, message: "Database connection failed. Please try again later." };
  }

  try {
    const checkText = `SELECT id FROM users WHERE lower(email)=lower($1) OR phone=$2 LIMIT 1`;
    const checkRes = await client.query(checkText, [email, phone]);
    if (checkRes.rows.length > 0) {
      await logEvent("duplicate_registration_attempt", { email, phone, outcome: "duplicate_identity" });
      return { success: false, message: "A user with that email or mobile number already exists." };
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const fullName = buildFullName(firstName, lastName, middleName);
    const insertText = `INSERT INTO users(
      first_name,
      last_name,
      middle_name,
      name,
      email,
      phone,
      country,
      preferred_language,
      referral_code,
      organization_name,
      password_hash,
      role,
      status,
      registration_state,
      email_verified,
      phone_verified,
      consent_terms,
      consent_privacy,
      terms_version,
      privacy_version
    ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20) RETURNING *`;
    const vals = [
      firstName,
      lastName,
      middleName || null,
      fullName,
      email,
      phone || null,
      country,
      preferredLanguage || null,
      referralCode || null,
      organizationName || null,
      passwordHash,
      userData.role || "member",
      "pending_verification",
      "pending_verification",
      false,
      false,
      true,
      true,
      userData.termsVersion || "v1",
      userData.privacyVersion || "v1",
    ];
    const insertRes = await client.query(insertText, vals);
    const created = insertRes.rows[0];
    const verificationCode = generateVerificationCode();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30);

    await client.query(
      `INSERT INTO account_verification_codes(user_id, code, expires_at) VALUES($1, $2, $3)`,
      [created.id, verificationCode, expiresAt]
    );

    const verificationDelivery = await Promise.all([
      sendAccountVerificationEmail({
        to: created.email,
        firstName: created.first_name || firstName,
        verificationCode,
        phone: created.phone || phone,
      }),
      sendAccountVerificationSms({
        to: created.phone || phone,
        firstName: created.first_name || firstName,
        verificationCode,
      }),
    ]);
    await logEvent("registration_started", { userId: created.id, outcome: "submitted" });
    await logEvent("registration_completed", { userId: created.id, outcome: "pending_verification" });
    await logEvent("consent_recorded", { userId: created.id, outcome: "success" });
    await logEvent("verification_email_sent", {
      userId: created.id,
      outcome: verificationDelivery[0].success ? "email_sent" : "email_failed",
      details: {
        email: created.email,
        phone: created.phone || phone,
        verificationCode,
        emailDelivery: verificationDelivery[0],
        smsDelivery: verificationDelivery[1],
      },
    });
    return {
      success: true,
      user: created,
      verification: verificationDelivery,
    };
  } catch (err) {
    return { success: false, message: "Failed to create user." };
  } finally {
    if (client) try { client.release(); } catch (e) {}
  }
}

async function authenticateUser(identifier, password) {
  const normalizedIdentifier = String(identifier).trim().toLowerCase();
  if (!pool) {
    return { success: false, message: "Database connection is not available. Please ensure PostgreSQL is configured." };
  }

  let client;
  try {
    client = await pool.connect();
  } catch (connErr) {
    console.error("Database connection failed:", connErr && connErr.message ? connErr.message : connErr);
    return { success: false, message: "Database connection failed. Please try again later." };
  }
  try {
    const text = `SELECT * FROM users WHERE lower(email)=lower($1) OR phone=$2 LIMIT 1`;
    const res = await client.query(text, [normalizedIdentifier, normalizedIdentifier]);
    const user = res.rows[0];
    if (!user) {
      await logEvent("login_failure", { identifier: normalizedIdentifier, outcome: "invalid_user" });
      return { success: false, message: "Invalid credentials." };
    }

    const now = Date.now();
    if (user.status === "locked" && user.locked_until && new Date(user.locked_until).getTime() > now) {
      await logEvent("login_failure", { userId: user.id, outcome: "account_locked" });
      return { success: false, message: "Account temporarily locked due to repeated failed attempts." };
    }

    if (user.status === "locked" && user.locked_until && new Date(user.locked_until).getTime() <= now) {
      await client.query(`UPDATE users SET status='active', failed_attempts=0, locked_until=NULL WHERE id=$1`, [user.id]);
      user.status = "active";
      user.failed_attempts = 0;
      user.locked_until = null;
    }

    if (user.status === "pending_verification") {
      await logEvent("login_failure", { userId: user.id, outcome: "pending_verification" });
      return { success: false, message: "Account is pending verification. Please verify your email or mobile number to activate it." };
    }

    if (user.status !== "active") {
      await logEvent("login_failure", { userId: user.id, outcome: user.status });
      return { success: false, message: `Account is currently ${user.status}.` };
    }

    const isValidPassword = bcrypt.compareSync(password, user.password_hash);
    if (!isValidPassword) {
      const failed = (user.failed_attempts || 0) + 1;
      await client.query(`UPDATE users SET failed_attempts=$1 WHERE id=$2`, [failed, user.id]);
      if (failed >= MAX_FAILED_ATTEMPTS) {
        const lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
        await client.query(`UPDATE users SET status='locked', locked_until=$1 WHERE id=$2`, [lockedUntil, user.id]);
        await logEvent("account_lockout", { userId: user.id, outcome: "locked" });
        return { success: false, message: "Account temporarily locked after repeated failed attempts." };
      }
      await logEvent("login_failure", { userId: user.id, outcome: "invalid_password", failedAttempts: failed });
      return { success: false, message: "Invalid credentials." };
    }

    await client.query(`UPDATE users SET failed_attempts=0, last_login_at=NOW(), locked_until=NULL WHERE id=$1`, [user.id]);
    await logEvent("login_success", { userId: user.id, outcome: "success" });
    const normalizedUser = {
      id: user.id,
      name: user.name || `${user.first_name || ""} ${user.last_name || ""}`.trim(),
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.status,
    };
    return { success: true, user: normalizedUser };
  } catch (err) {
    return { success: false, message: "Authentication failed." };
  } finally {
    if (client) try { client.release(); } catch (e) {}
  }
}

async function requestPasswordReset(email, origin = "") {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) {
    return { success: false, message: "Please enter the email address tied to your account." };
  }

  if (!pool) {
    return { success: false, message: "Database connection is not available. Please ensure PostgreSQL is configured." };
  }

  let client;
  try {
    client = await pool.connect();
    const userRes = await client.query("SELECT id, email FROM users WHERE lower(email)=lower($1) LIMIT 1", [normalizedEmail]);
    const user = userRes.rows[0];
    if (!user) {
      await logEvent("password_reset_requested", { email: normalizedEmail, outcome: "user_not_found" });
      return { success: false, message: "We could not find an account with that email address." };
    }

    const resetToken = buildResetToken();
    const resetExpiresAt = new Date(Date.now() + 1000 * 60 * 30);
    await client.query(
      "UPDATE users SET password_reset_token=$1, password_reset_expires_at=$2 WHERE id=$3",
      [resetToken, resetExpiresAt, user.id]
    );
    const resetUrl = `${origin}/reset-password/${resetToken}`.replace(/\s+/g, "");
    await sendPasswordResetEmail({ to: normalizedEmail, resetUrl });
    await logEvent("password_reset_requested", { userId: user.id, email: normalizedEmail, outcome: "token_created" });
    return { success: true, message: "If the account exists, we have sent instructions to reset your password.", resetUrl };
  } catch (err) {
    return { success: false, message: "We could not process the password reset request right now." };
  } finally {
    if (client) try { client.release(); } catch (e) {}
  }
}

async function verifyPasswordResetToken(token) {
  const normalizedToken = String(token || "").trim();
  if (!normalizedToken) {
    return { success: false, message: "Reset token is missing." };
  }

  if (!pool) {
    return { success: false, message: "Database connection is not available. Please ensure PostgreSQL is configured." };
  }

  let client;
  try {
    client = await pool.connect();
    const userRes = await client.query(
      "SELECT email, password_reset_token, password_reset_expires_at FROM users WHERE password_reset_token=$1 LIMIT 1",
      [normalizedToken]
    );
    const user = userRes.rows[0];
    if (!user) {
      return { success: false, message: "This reset link is invalid or has already expired." };
    }

    if (!user.password_reset_expires_at || new Date(user.password_reset_expires_at).getTime() < Date.now()) {
      return { success: false, message: "This reset link has expired. Please request a new one." };
    }

    return { success: true, email: user.email };
  } catch (err) {
    return { success: false, message: "We could not verify the reset link." };
  } finally {
    if (client) try { client.release(); } catch (e) {}
  }
}

async function completePasswordReset(token, newPassword, confirmPassword) {
  const normalizedToken = String(token || "").trim();
  if (!normalizedToken) {
    return { success: false, message: "Reset token is missing." };
  }

  const passwordErrors = validatePassword(newPassword, confirmPassword);
  if (passwordErrors.length > 0) {
    return { success: false, message: passwordErrors.join(" ") };
  }

  if (!pool) {
    return { success: false, message: "Database connection is not available. Please ensure PostgreSQL is configured." };
  }

  let client;
  try {
    client = await pool.connect();
    const userRes = await client.query(
      "SELECT id, password_reset_token, password_reset_expires_at FROM users WHERE password_reset_token=$1 LIMIT 1",
      [normalizedToken]
    );
    const user = userRes.rows[0];
    if (!user) {
      return { success: false, message: "This reset link is invalid or has already expired." };
    }

    if (!user.password_reset_expires_at || new Date(user.password_reset_expires_at).getTime() < Date.now()) {
      return { success: false, message: "This reset link has expired. Please request a new one." };
    }

    const passwordHash = bcrypt.hashSync(newPassword, 10);
    await client.query(
      "UPDATE users SET password_hash=$1, password_reset_token=NULL, password_reset_expires_at=NULL WHERE id=$2",
      [passwordHash, user.id]
    );
    await logEvent("password_reset_completed", { userId: user.id, outcome: "success" });
    return { success: true, message: "Your password has been updated successfully. You can now sign in." };
  } catch (err) {
    return { success: false, message: "We could not update your password right now." };
  } finally {
    if (client) try { client.release(); } catch (e) {}
  }
}

async function resendVerificationCode(userId) {
  if (!userId) {
    return { success: false, message: "User ID is required." };
  }

  if (!pool) {
    return { success: false, message: "Database connection is not available. Please ensure PostgreSQL is configured." };
  }

  let client;
  try {
    client = await pool.connect();

    // Get user and check status
    const userRes = await client.query("SELECT * FROM users WHERE id = $1", [userId]);
    if (userRes.rows.length === 0) {
      await logEvent("verification_resend_attempt", { userId, outcome: "user_not_found" });
      return { success: false, message: "User not found." };
    }

    const user = userRes.rows[0];
    if (user.status !== "pending_verification") {
      return { success: false, message: "Account is already verified or not eligible for verification." };
    }

    // Rate limiting: Check resend count in last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentResends = await client.query(
      `SELECT COUNT(*) FROM account_verification_codes
       WHERE user_id = $1 AND status IN ('pending', 'superseded') AND created_at > $2`,
      [userId, oneHourAgo]
    );

    if (Number(recentResends.rows[0].count) >= 5) {
      await logEvent("verification_resend_attempt", { userId, outcome: "rate_limited" });
      return { success: false, message: "Too many resend attempts. Please try again in 1 hour." };
    }

    // Mark old codes as superseded
    await client.query(
      `UPDATE account_verification_codes SET status = 'superseded' WHERE user_id = $1 AND status = 'pending'`,
      [userId]
    );

    // Generate and store new code
    const newCode = generateVerificationCode();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    await client.query(
      `INSERT INTO account_verification_codes (user_id, code, status, expires_at, created_at)
       VALUES ($1, $2, 'pending', $3, NOW())`,
      [userId, newCode, expiresAt]
    );

    // Send emails
    const verificationDelivery = await Promise.all([
      sendAccountVerificationEmail({
        to: user.email,
        firstName: user.first_name || "Member",
        verificationCode: newCode,
        phone: user.phone,
      }),
      sendAccountVerificationSms({
        to: user.phone,
        firstName: user.first_name || "Member",
        verificationCode: newCode,
      }),
    ]);

    await logEvent("verification_code_resent", { userId, outcome: "success" });
    return {
      success: true,
      message: "Verification code has been resent to your email.",
      verificationCode: newCode,
      delivery: verificationDelivery,
    };
  } catch (err) {
    console.error("Verification code resend error:", err && err.message ? err.message : err);
    return { success: false, message: "Failed to resend verification code." };
  } finally {
    if (client) try { client.release(); } catch (e) {}
  }
}

async function verifyAccountCode(userId, code) {
  const normalizedCode = String(code || "").trim().toUpperCase();
  if (!normalizedCode) {
    return { success: false, message: "Verification code is required." };
  }

  if (!pool) {
    return { success: false, message: "Database connection is not available. Please ensure PostgreSQL is configured." };
  }

  let client;
  try {
    client = await pool.connect();
    const codeRes = await client.query(
      `SELECT * FROM account_verification_codes
       WHERE user_id = $1 AND status = 'pending'
       ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );

    if (codeRes.rows.length === 0) {
      await logEvent("account_verification_attempt", { userId, outcome: "code_not_found" });
      return { success: false, message: "No pending verification code found." };
    }

    const codeRecord = codeRes.rows[0];
    if (new Date(codeRecord.expires_at).getTime() < Date.now()) {
      await client.query(
        `UPDATE account_verification_codes SET status = 'expired' WHERE id = $1`,
        [codeRecord.id]
      );
      await logEvent("account_verification_attempt", { userId, outcome: "code_expired" });
      return { success: false, message: "Verification code has expired. Please request a new one." };
    }

    if (codeRecord.code !== normalizedCode) {
      await logEvent("account_verification_attempt", { userId, outcome: "invalid_code" });
      return { success: false, message: "Verification code is incorrect." };
    }

    await client.query(
      `UPDATE account_verification_codes SET status = 'verified', verified_at = NOW() WHERE id = $1`,
      [codeRecord.id]
    );

    await client.query(
      `UPDATE users SET status = 'active', email_verified = TRUE, registration_state = 'active', updated_at = NOW() WHERE id = $1`,
      [userId]
    );

    await logEvent("account_verified", { userId, outcome: "success" });
    return { success: true, message: "Account verified successfully. You can now sign in." };
  } catch (err) {
    console.error("Account verification error:", err && err.message ? err.message : err);
    return { success: false, message: "Failed to verify account." };
  } finally {
    if (client) try { client.release(); } catch (e) {}
  }
}

function getAuditEntries() {
  return auditEntries;
}

module.exports = {
  createUser,
  authenticateUser,
  requestPasswordReset,
  verifyPasswordResetToken,
  completePasswordReset,
  verifyAccountCode,
  resendVerificationCode,
  logEvent,
  getAuditEntries,
  MAX_FAILED_ATTEMPTS,
  LOCKOUT_DURATION_MS,
};
