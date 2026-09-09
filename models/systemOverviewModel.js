const pool = require("../database/connection");

const architectureLayers = [
  { key: "frontend", label: "Frontend", detail: "Responsive web workspace for browsers and mobile devices." },
  { key: "api", label: "API layer", detail: "Express routes, validation, sessions, and access control." },
  { key: "services", label: "Services", detail: "Authentication, business, commerce, trade, payments, and notifications." },
  { key: "database", label: "PostgreSQL", detail: "Organization-aware business records, workflow state, and audit history." },
  { key: "external", label: "External services", detail: "Payment, notification, cloud hosting, and integration providers." },
];

async function getOverview() {
  const [integrations, counts] = await Promise.all([
    pool.query(`SELECT id, integration_key AS "integrationKey", display_name AS "displayName", integration_type AS "integrationType", provider, environment, status, endpoint_reference AS "endpointReference", last_checked_at AS "lastCheckedAt", notes FROM platform_integrations ORDER BY integration_type, display_name`),
    pool.query(`SELECT
      (SELECT COUNT(*)::integer FROM users) AS users,
      (SELECT COUNT(*)::integer FROM business_accounts) AS businesses,
      (SELECT COUNT(*)::integer FROM marketplace_listings WHERE status = 'active') AS listings,
      (SELECT COUNT(*)::integer FROM orders) AS orders,
      (SELECT COUNT(*)::integer FROM payments) AS payments,
      (SELECT COUNT(*)::integer FROM audit_logs) AS auditEvents`),
  ]);
  return { architectureLayers, integrations: integrations.rows, counts: counts.rows[0] };
}

async function updateIntegrationStatus(actorId, integrationId, input = {}) {
  const allowedStatuses = ["configured", "healthy", "degraded", "unavailable", "not_configured"];
  if (!allowedStatuses.includes(input.status)) return { success: false, message: "Select a valid integration status." };
  const notes = String(input.notes || "").trim().slice(0, 2000);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const updated = await client.query(`UPDATE platform_integrations SET status = $1, notes = $2, last_checked_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING id, integration_key AS "integrationKey"`, [input.status, notes, Number(integrationId)]);
    if (!updated.rows[0]) { await client.query("ROLLBACK"); return { success: false, message: "Integration was not found." }; }
    await client.query("INSERT INTO platform_integration_events (integration_id, event_type, status, details, created_by) VALUES ($1, 'status_updated', $2, $3::jsonb, $4)", [Number(integrationId), input.status, JSON.stringify({ notes }), actorId]);
    await client.query("INSERT INTO audit_logs (event_type, user_id, outcome, details) VALUES ('platform_integration_updated', $1, 'success', $2::jsonb)", [actorId, JSON.stringify({ integrationId: Number(integrationId), status: input.status })]);
    await client.query("COMMIT");
    return { success: true, message: "Integration status updated." };
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}

module.exports = { getOverview, updateIntegrationStatus, architectureLayers };
