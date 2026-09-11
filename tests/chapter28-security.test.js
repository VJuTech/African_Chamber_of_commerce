const assert = require("node:assert/strict");
const securityModel = require("../models/securityModel");
const pool = require("../database/connection");
const { createTestUser, removeTestUsers } = require("./test-fixtures");

(async () => {
  const userIds = [];
  try {
    for (const operation of [
      "hashValue",
      "recordAudit",
      "recordLoginAttempt",
      "getPolicy",
      "listMfaMethods",
      "getEnabledMfaMethod",
      "createMfaChallenge",
      "verifyMfaChallenge",
      "listAlerts",
      "createAlert",
      "getAdminOverview",
      "enrollMfaMethod",
      "confirmMfaEnrollment",
      "disableMfa",
    ]) {
      assert.equal(typeof securityModel[operation], "function", `${operation} should be exported`);
    }

    const userId = await createTestUser("Chapter28Security");
    userIds.push(userId);
    const context = { ipAddress: "198.51.100.28", userAgent: "chapter28-test" };

    const policy = await securityModel.getPolicy("login_lockout");
    assert.equal(policy.maxAttempts, 5, "login lockout policy should be database-backed");

    const identifierHash = securityModel.hashValue("security@example.test");
    assert.equal(identifierHash.length, 64, "security identifiers should be hashed");
    assert.notEqual(identifierHash, "security@example.test");

    await securityModel.recordLoginAttempt("security@example.test", "invalid_password", false, context, userId, { failedAttempts: 1 });
    await securityModel.recordLoginAttempt("security@example.test", "authenticated", true, context, userId);
    await securityModel.recordAudit("access_denied", "denied", { userId, resource: "admin/security" }, context);

    const attempts = await pool.query("SELECT outcome, success, identifier_hash FROM security_login_attempts WHERE user_id = $1 ORDER BY created_at", [userId]);
    assert.equal(attempts.rows.length, 2);
    assert.equal(attempts.rows[0].success, false);
    assert.equal(attempts.rows[1].success, true);
    assert.equal(attempts.rows[0].identifier_hash, identifierHash);

    const alert = await securityModel.createAlert(userId, {
      type: "new_device",
      severity: "medium",
      title: "New device detected",
      message: "A new device signed in to this account.",
      details: { source: "chapter28-test" },
    }, context);
    assert.ok(alert.id, "security alert should be persisted");
    assert.equal((await securityModel.listAlerts(userId, 10)).some((item) => item.id === alert.id), true);

    const overview = await securityModel.getAdminOverview({ search: "access_denied" });
    assert.ok(overview.auditLogs.some((entry) => entry.eventType === "access_denied"), "admin security search should find audit events");
    assert.ok(Array.isArray(overview.alerts));
    assert.ok(Array.isArray(overview.attempts));

    const disabled = await securityModel.disableMfa(userId, context);
    assert.equal(disabled.success, true);
    const user = await pool.query("SELECT mfa_enabled FROM users WHERE id = $1", [userId]);
    assert.equal(user.rows[0].mfa_enabled, false);

    console.log("Chapter 28 security tests passed");
  } finally {
    await removeTestUsers(userIds);
    await pool.end();
  }
})().catch((error) => {
  console.error("Chapter 28 security tests failed");
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
