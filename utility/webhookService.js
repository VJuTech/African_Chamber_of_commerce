const crypto = require("crypto");
const pool = require("../database/connection");

function signature(secret, payload) {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

async function enqueueEvent(eventType, eventId, payload = {}) {
  const subscriptions = await pool.query(
    `SELECT id, target_url, secret_hash
     FROM webhook_subscriptions
     WHERE status = 'active' AND event_types @> $1::jsonb`,
    [JSON.stringify([eventType])]
  );
  for (const subscription of subscriptions.rows) {
    await pool.query(
      `INSERT INTO webhook_deliveries (subscription_id, event_type, event_id, payload)
       VALUES ($1, $2, $3, $4::jsonb)`,
      [subscription.id, eventType, String(eventId), JSON.stringify(payload)]
    );
  }
  return { queued: subscriptions.rowCount };
}

async function deliverPending(limit = 20) {
  const client = await pool.connect();
  const delivered = [];
  try {
    await client.query("BEGIN");
    const queued = await client.query(
      `SELECT d.*, w.target_url, w.secret_hash
       FROM webhook_deliveries d JOIN webhook_subscriptions w ON w.id = d.subscription_id
       WHERE d.status IN ('pending', 'retrying') AND d.next_attempt_at <= CURRENT_TIMESTAMP AND w.status = 'active'
       ORDER BY d.created_at ASC LIMIT $1 FOR UPDATE SKIP LOCKED`,
      [Math.max(1, Math.min(100, Number(limit) || 20))]
    );
    for (const delivery of queued.rows) {
      const body = JSON.stringify({ id: delivery.event_id, type: delivery.event_type, data: delivery.payload, createdAt: delivery.created_at });
      try {
        const response = await fetch(delivery.target_url, {
          method: "POST",
          headers: { "content-type": "application/json", "x-acc-event": delivery.event_type, "x-acc-signature": signature(delivery.secret_hash, body) },
          body,
          signal: AbortSignal.timeout(10000),
        });
        const responseBody = await response.text();
        if (!response.ok) throw new Error(`Webhook returned HTTP ${response.status}: ${responseBody.slice(0, 500)}`);
        await client.query(
          `UPDATE webhook_deliveries SET status = 'delivered', attempts = attempts + 1, response_code = $2, response_body = $3, delivered_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [delivery.id, response.status, responseBody.slice(0, 2000)]
        );
        await client.query("UPDATE webhook_subscriptions SET failure_count = 0, last_delivered_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1", [delivery.subscription_id]);
        delivered.push({ id: delivery.id, status: "delivered" });
      } catch (error) {
        const nextAttempt = new Date(Date.now() + Math.min(60, 2 ** Math.min(5, Number(delivery.attempts || 0))) * 60000);
        await client.query(
          `UPDATE webhook_deliveries SET status = CASE WHEN attempts + 1 >= 8 THEN 'failed' ELSE 'retrying' END, attempts = attempts + 1, response_body = $2, next_attempt_at = $3 WHERE id = $1`,
          [delivery.id, error.message.slice(0, 2000), nextAttempt]
        );
        await client.query("UPDATE webhook_subscriptions SET failure_count = failure_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1", [delivery.subscription_id]);
        delivered.push({ id: delivery.id, status: "retrying" });
      }
    }
    await client.query("COMMIT");
    return delivered;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { enqueueEvent, deliverPending };
