const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");
const pool = require("../database/connection");
const { validatePassword } = require("../utility/account-validation");
const {
  sendAccountVerificationEmail,
  sendAccountVerificationSms,
  generateVerificationCode,
} = require("../utility/emailService");

const auditEntries = [];
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 10 * 60 * 1000;
const auditLogPath = path.join(__dirname, "..", "logs", "auth-audit.log");

fs.mkdirSync(path.dirname(auditLogPath), { recursive: true });

// Use the shared PostgreSQL pool from database/connection.js.
let dbAvailable = Boolean(process.env.DATABASE_URL || process.env.PGHOST);

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

async function dbLogEvent(eventType, details = {}) {
  if (!pool || !dbAvailable) return fileLogEvent(eventType, details);
  const { userId, outcome } = details || {};
  const text = `INSERT INTO audit_logs(event_type, user_id, outcome, details) VALUES($1,$2,$3,$4) RETURNING *`;
  const vals = [eventType, userId || null, outcome || null, details];
  try {
    const res = await pool.query(text, vals);
    return res.rows[0];
  } catch (err) {
    return fileLogEvent(eventType, details);
  }
}

async function logEvent(eventType, details = {}) {
  return pool && dbAvailable ? dbLogEvent(eventType, details) : fileLogEvent(eventType, details);
}

// In-memory fallback storage for environments without a DB configured.
const users = [];
function seedDemoUser() {
  if (users.some((user) => user.email === "admin@acc.com")) return;
  const adminPasswordHash = bcrypt.hashSync("Admin123!", 10);
  users.push({
    id: 1,
    firstName: "System",
    lastName: "Admin",
    name: "System Admin",
    email: "admin@acc.com",
    phone: "2348000000000",
    country: "Nigeria",
    passwordHash: adminPasswordHash,
    role: "admin",
    status: "active",
    failedAttempts: 0,
    lastLoginAt: null,
    lockedUntil: null,
    emailVerified: true,
    phoneVerified: true,
    registrationState: "active",
  });
}

seedDemoUser();

function normalizePhone(value) {
  return String(value || "").replace(/\s+/g, "").trim();
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

  if (!pool || !dbAvailable) {
    const existingUser = users.find(
      (user) => user.email.toLowerCase() === email || (phone && user.phone === phone)
    );
    if (existingUser) {
      await logEvent("duplicate_registration_attempt", {
        email,
        phone,
        outcome: "duplicate_identity",
      });
      return { success: false, message: "A user with that email or mobile number already exists." };
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const name = buildFullName(firstName, lastName, middleName);
    const newUser = {
      id: users.length + 1,
      firstName,
      lastName,
      middleName: middleName || null,
      name,
      email,
      phone,
      country,
      preferredLanguage: preferredLanguage || null,
      referralCode: referralCode || null,
      organizationName: organizationName || null,
      passwordHash,
      role: userData.role || "member",
      status: "pending_verification",
      registrationState: "pending_verification",
      emailVerified: false,
      phoneVerified: false,
      consentTerms: true,
      consentPrivacy: true,
      termsVersion: userData.termsVersion || "v1",
      privacyVersion: userData.privacyVersion || "v1",
      failedAttempts: 0,
      lastLoginAt: null,
      lockedUntil: null,
    };
    const verificationCode = generateVerificationCode();
    const verificationDelivery = await Promise.all([
      sendAccountVerificationEmail({
        to: email,
        firstName,
        verificationCode,
        phone,
      }),
      sendAccountVerificationSms({
        to: phone,
        firstName,
        verificationCode,
      }),
    ]);
    users.push({ ...newUser, verificationCode, verificationDelivery });
    await logEvent("registration_started", { userId: newUser.id, outcome: "submitted" });
    await logEvent("registration_completed", { userId: newUser.id, outcome: "pending_verification" });
    await logEvent("consent_recorded", { userId: newUser.id, outcome: "success" });
    return {
      success: true,
      user: { ...newUser, passwordHash: undefined },
      verification: verificationDelivery,
    };
  }

  let client;
  try {
    client = await pool.connect();
  } catch (connErr) {
    console.error("Postgres connection failed, falling back to in-memory users:", connErr && connErr.message ? connErr.message : connErr);
    dbAvailable = false;
    return createUser(userData);
  }

  try {
    const checkText = `SELECT id FROM users WHERE lower(email)=lower($1) OR phone=$2 LIMIT 1`;
    const checkRes = await client.query(checkText, [email, phone]);
    if (checkRes.rows.length > 0) {
      await logEvent("duplicate_registration_attempt", {
        email,
        phone,
        outcome: "duplicate_identity",
      });
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
  if (!pool || !dbAvailable) {
    const user = users.find(
      (candidate) => candidate.email.toLowerCase() === normalizedIdentifier || candidate.phone === normalizedIdentifier
    );
    if (!user) {
      await logEvent("login_failure", { identifier: normalizedIdentifier, outcome: "invalid_user" });
      return { success: false, message: "Invalid credentials." };
    }

    if (user.status === "locked" && user.lockedUntil && Date.now() < user.lockedUntil) {
      await logEvent("login_failure", { userId: user.id, outcome: "account_locked" });
      return { success: false, message: "Account temporarily locked due to repeated failed attempts." };
    }

    if (user.status === "locked" && user.lockedUntil && Date.now() >= user.lockedUntil) {
      user.status = "active";
      user.lockedUntil = null;
      user.failedAttempts = 0;
    }

    if (user.status === "pending_verification") {
      await logEvent("login_failure", { userId: user.id, outcome: "pending_verification" });
      return { success: false, message: "Account is pending verification. Please verify your email or mobile number to activate it." };
    }

    if (user.status !== "active") {
      await logEvent("login_failure", { userId: user.id, outcome: user.status });
      return { success: false, message: `Account is currently ${user.status}.` };
    }

    const isValidPassword = bcrypt.compareSync(password, user.passwordHash);
    if (!isValidPassword) {
      user.failedAttempts = (user.failedAttempts || 0) + 1;
      if (user.failedAttempts >= MAX_FAILED_ATTEMPTS) {
        user.status = "locked";
        user.lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
        await logEvent("account_lockout", { userId: user.id, outcome: "locked" });
        return { success: false, message: "Account temporarily locked after repeated failed attempts." };
      }
      await logEvent("login_failure", { userId: user.id, outcome: "invalid_password", failedAttempts: user.failedAttempts });
      return { success: false, message: "Invalid credentials." };
    }

    user.failedAttempts = 0;
    user.lastLoginAt = new Date().toISOString();
    user.lockedUntil = null;
    await logEvent("login_success", { userId: user.id, outcome: "success" });
    return { success: true, user };
  }

  let client;
  try {
    client = await pool.connect();
  } catch (connErr) {
    console.error("Postgres connection failed during auth, falling back to in-memory:", connErr && connErr.message ? connErr.message : connErr);
    dbAvailable = false;
    return authenticateUser(identifier, password);
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

function getAuditEntries() {
  return auditEntries;
}

module.exports = {
  createUser,
  authenticateUser,
  logEvent,
  getAuditEntries,
  MAX_FAILED_ATTEMPTS,
  LOCKOUT_DURATION_MS,
};
