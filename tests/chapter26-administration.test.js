const assert = require("node:assert/strict");
const adminModel = require("../models/adminModel");
const pool = require("../database/connection");
const { createTestUser, removeTestUsers } = require("./test-fixtures");

(async () => {
  const userIds = [];
  try {
    for (const operation of ["getDashboard", "listUsers", "listBusinesses", "listModeration", "getSettings", "listLogs", "updateUserStatus", "getReport"]) {
      assert.equal(typeof adminModel[operation], "function", `${operation} should be exported`);
    }

    const userId = await createTestUser("Chapter26Admin");
    userIds.push(userId);

    const users = await adminModel.listUsers("Chapter26Admin");
    assert.ok(users.some((user) => user.id === userId), "admin user search should read PostgreSQL users");

    const updated = await adminModel.updateUserStatus(1, userId, "suspended", {
      ip: "127.0.0.1",
      userAgent: "chapter26-test",
    });
    assert.equal(updated.id, userId);
    assert.equal(updated.status, "suspended");

    const persisted = await pool.query("SELECT status, account_status FROM users WHERE id = $1", [userId]);
    assert.equal(persisted.rows[0].status, "suspended");
    assert.equal(persisted.rows[0].account_status, "suspended");

    const audit = await pool.query(
      "SELECT action, resource_id FROM admin_audit_logs WHERE resource_type = 'user' AND resource_id = $1 ORDER BY created_at DESC LIMIT 1",
      [String(userId)]
    );
    assert.equal(audit.rows[0].action, "user_suspended");

    const dashboard = await adminModel.getDashboard();
    assert.ok(dashboard.counts, "admin dashboard should return live counts");
    assert.ok(Array.isArray(dashboard.activity), "admin dashboard should return activity");

    console.log("Chapter 26 administration tests passed");
  } finally {
    await removeTestUsers(userIds);
    await pool.end();
  }
})().catch((error) => {
  console.error("Chapter 26 administration tests failed");
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
