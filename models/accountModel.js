const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");

const users = [];
const auditEntries = [];
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 10 * 60 * 1000;
const auditLogPath = path.join(__dirname, "..", "logs", "auth-audit.log");

fs.mkdirSync(path.dirname(auditLogPath), { recursive: true });

function logEvent(eventType, details = {}) {
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

function seedDemoUser() {
  if (users.some((user) => user.email === "admin@acc.com")) {
    return;
  }

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

function createUser(userData) {
  const email = userData.email ? userData.email.trim().toLowerCase() : "";
  const phone = userData.phone ? userData.phone.trim() : "";

  if (!email || !userData.password) {
    return { success: false, message: "Email and password are required." };
  }

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
  logEvent("account_created", { userId: newUser.id, role: newUser.role });
  return { success: true, user: newUser };
}

function authenticateUser(identifier, password) {
  const normalizedIdentifier = String(identifier).trim().toLowerCase();
  const user = users.find(
    (candidate) =>
      candidate.email.toLowerCase() === normalizedIdentifier ||
      candidate.phone === normalizedIdentifier
  );

  if (!user) {
    logEvent("login_failure", { identifier: normalizedIdentifier, outcome: "invalid_user" });
    return { success: false, message: "Invalid credentials." };
  }

  if (user.status === "locked" && user.lockedUntil && Date.now() < user.lockedUntil) {
    logEvent("login_failure", { userId: user.id, outcome: "account_locked" });
    return { success: false, message: "Account temporarily locked due to repeated failed attempts." };
  }

  if (user.status === "locked" && user.lockedUntil && Date.now() >= user.lockedUntil) {
    user.status = "active";
    user.lockedUntil = null;
    user.failedAttempts = 0;
  }

  if (user.status !== "active") {
    logEvent("login_failure", { userId: user.id, outcome: user.status });
    return { success: false, message: `Account is currently ${user.status}.` };
  }

  const isValidPassword = bcrypt.compareSync(password, user.passwordHash);

  if (!isValidPassword) {
    user.failedAttempts = (user.failedAttempts || 0) + 1;

    if (user.failedAttempts >= MAX_FAILED_ATTEMPTS) {
      user.status = "locked";
      user.lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
      logEvent("account_lockout", { userId: user.id, outcome: "locked" });
      return { success: false, message: "Account temporarily locked after repeated failed attempts." };
    }

    logEvent("login_failure", { userId: user.id, outcome: "invalid_password", failedAttempts: user.failedAttempts });
    return { success: false, message: "Invalid credentials." };
  }

  user.failedAttempts = 0;
  user.lastLoginAt = new Date().toISOString();
  user.lockedUntil = null;
  logEvent("login_success", { userId: user.id, outcome: "success" });
  return { success: true, user };
}

function getAuditEntries() {
  return auditEntries;
}

seedDemoUser();

module.exports = {
  createUser,
  authenticateUser,
  logEvent,
  getAuditEntries,
  MAX_FAILED_ATTEMPTS,
  LOCKOUT_DURATION_MS,
};
