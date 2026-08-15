const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");
const pool = require("../database/connection");

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
    name: "System Admin",
    email: "admin@acc.com",
    phone: "2348000000000",
    passwordHash: adminPasswordHash,
    role: "admin",
    status: "active",
    failedAttempts: 0,
    lastLoginAt: null,
    lockedUntil: null,
  });
}

seedDemoUser();

async function createUser(userData) {
  const email = userData.email ? userData.email.trim().toLowerCase() : "";
  const phone = userData.phone ? userData.phone.trim() : "";

  if (!email || !userData.password) {
    return { success: false, message: "Email and password are required." };
  }

  if (!pool || !dbAvailable) {
    const existingUser = users.find(
      (user) => user.email.toLowerCase() === email || (phone && user.phone === phone)
    );
    if (existingUser) {
      return { success: false, message: "An account with that email or mobile number already exists." };
    }
    const passwordHash = bcrypt.hashSync(userData.password, 10);
    const newUser = {
      id: users.length + 1,
      name: userData.name || "Member",
      email,
      phone,
      passwordHash,
      role: userData.role || "member",
      status: "active",
      failedAttempts: 0,
      lastLoginAt: null,
      lockedUntil: null,
    };
    users.push(newUser);
    await logEvent("account_created", { userId: newUser.id, role: newUser.role });
    return { success: true, user: newUser };
  }

  // Persist to PostgreSQL
  let client;
  try {
    client = await pool.connect();
  } catch (connErr) {
    // If DB connection fails, fall back to in-memory storage without closing the shared pool.
    console.error("Postgres connection failed, falling back to in-memory users:", connErr && connErr.message ? connErr.message : connErr);
    dbAvailable = false;
    return createUser(userData);
  }
  try {
    const checkText = `SELECT id FROM users WHERE lower(email)=lower($1) OR phone=$2 LIMIT 1`;
    const checkRes = await client.query(checkText, [email, phone]);
    if (checkRes.rows.length > 0) {
      return { success: false, message: "An account with that email or mobile number already exists." };
    }

    const passwordHash = bcrypt.hashSync(userData.password, 10);
    const insertText = `INSERT INTO users(name,email,phone,password_hash,role,status) VALUES($1,$2,$3,$4,$5,$6) RETURNING *`;
    const vals = [userData.name || "Member", email, phone || null, passwordHash, userData.role || "member", "active"];
    const insertRes = await client.query(insertText, vals);
    const created = insertRes.rows[0];
    await logEvent("account_created", { userId: created.id, role: created.role });
    return { success: true, user: created };
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

  // DB-backed authentication
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
      user.status = 'active';
      user.failed_attempts = 0;
      user.locked_until = null;
    }

    if (user.status !== 'active') {
      await logEvent('login_failure', { userId: user.id, outcome: user.status });
      return { success: false, message: `Account is currently ${user.status}.` };
    }

    const isValidPassword = bcrypt.compareSync(password, user.password_hash);
    if (!isValidPassword) {
      const failed = (user.failed_attempts || 0) + 1;
      let q = `UPDATE users SET failed_attempts=$1 WHERE id=$2`;
      await client.query(q, [failed, user.id]);
      if (failed >= MAX_FAILED_ATTEMPTS) {
        const lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
        await client.query(`UPDATE users SET status='locked', locked_until=$1 WHERE id=$2`, [lockedUntil, user.id]);
        await logEvent('account_lockout', { userId: user.id, outcome: 'locked' });
        return { success: false, message: 'Account temporarily locked after repeated failed attempts.' };
      }
      await logEvent('login_failure', { userId: user.id, outcome: 'invalid_password', failedAttempts: failed });
      return { success: false, message: 'Invalid credentials.' };
    }

    await client.query(`UPDATE users SET failed_attempts=0, last_login_at=NOW(), locked_until=NULL WHERE id=$1`, [user.id]);
    await logEvent('login_success', { userId: user.id, outcome: 'success' });
    // Normalize returned user object to match previous shape
    const normalizedUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.status,
    };
    return { success: true, user: normalizedUser };
  } catch (err) {
    return { success: false, message: 'Authentication failed.' };
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
