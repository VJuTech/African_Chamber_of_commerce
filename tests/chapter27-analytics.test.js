const assert = require("node:assert/strict");
const analyticsModel = require("../models/analyticsModel");
const pool = require("../database/connection");
const { createTestUser, removeTestUsers } = require("./test-fixtures");

(async () => {
  const userIds = [];
  try {
    for (const operation of ["rangeBounds", "ownedBusinessIds", "recordEvent", "getDashboard", "getReport", "auditReport", "getBusinessOptions"]) {
      assert.equal(typeof analyticsModel[operation], "function", `${operation} should be exported`);
    }

    const userId = await createTestUser("Chapter27Analytics");
    userIds.push(userId);
    const bounds = analyticsModel.rangeBounds("2026-01-01", "2026-01-31");
    assert.equal(bounds.start.toISOString(), "2026-01-01T00:00:00.000Z");
    assert.equal(bounds.end.toISOString(), "2026-01-31T23:59:59.999Z");

    const event = await analyticsModel.recordEvent({
      userId,
      eventName: "chapter27_test_activity",
      resourceType: "test",
      resourceId: "chapter27",
      metadata: { source: "acceptance-test" },
    });
    assert.ok(event.id, "analytics event should be persisted");

    const persistedEvent = await pool.query("SELECT event_name, user_id FROM analytics_events WHERE id = $1", [event.id]);
    assert.equal(persistedEvent.rows[0].event_name, "chapter27_test_activity");
    assert.equal(persistedEvent.rows[0].user_id, userId);

    const dashboard = await analyticsModel.getDashboard({ userId, global: false });
    assert.ok(dashboard.kpis, "business dashboard should return KPI data");
    assert.deepEqual(dashboard.businessIds, [], "unowned users should receive an empty business scope");

    const report = await analyticsModel.getReport({ userId, global: false, type: "users" });
    assert.equal(report.type, "users");
    assert.ok(Array.isArray(report.rows), "analytics report should return rows");

    await analyticsModel.auditReport({ userId, type: "users", format: "json", filters: { scope: "business" }, rowCount: report.rows.length });
    const audit = await pool.query("SELECT report_type, user_id FROM analytics_report_audits WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1", [userId]);
    assert.equal(audit.rows[0].report_type, "users");

    console.log("Chapter 27 analytics tests passed");
  } finally {
    await removeTestUsers(userIds);
    await pool.end();
  }
})().catch((error) => {
  console.error("Chapter 27 analytics tests failed");
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
