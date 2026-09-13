const pool = require("../database/connection");
const notificationModel = require("./notificationModel");

async function createRequest({ userId = null, name = null, email = null, question, assistantResponse }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `INSERT INTO assistant_support_requests (user_id, visitor_name, visitor_email, question, assistant_response)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [userId ? Number(userId) : null, name || null, email || null, String(question).trim(), String(assistantResponse).trim()]
    );
    const request = result.rows[0];
    await client.query(
      `INSERT INTO assistant_support_messages (request_id, author_id, author_type, message)
       VALUES ($1, $2, 'assistant', $3)`,
      [request.id, userId ? Number(userId) : null, String(assistantResponse).trim()]
    );
    await client.query("COMMIT");

    const staff = await pool.query(
      `SELECT DISTINCT u.id FROM users u
       JOIN user_roles ur ON ur.user_id = u.id
       JOIN roles r ON r.id = ur.role_id
       WHERE r.role_key IN ('support_staff', 'platform_admin', 'system_admin', 'acc_management_admin', 'super_admin')
         AND u.status = 'active'`
    );
    await Promise.all(staff.rows.map((row) => notificationModel.generateNotification({
      userId: row.id,
      type: "system",
      priority: "high",
      title: "New ACC Assistant handoff",
      message: "A visitor has requested customer-care assistance.",
      link: "/admin/customer-care",
      eventKey: `assistant_support:${request.id}`,
      dedupeKey: `assistant_support:${request.id}:${row.id}`,
    })));
    return request;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function listRequests(status = "open") {
  const params = status === "all" ? [] : [status];
  const result = await pool.query(
    `SELECT r.*, u.name AS account_name, a.name AS assigned_name
     FROM assistant_support_requests r
     LEFT JOIN users u ON u.id = r.user_id
     LEFT JOIN users a ON a.id = r.assigned_to
     ${status === "all" ? "" : "WHERE r.status = $1"}
     ORDER BY CASE r.priority WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END, r.created_at ASC
     LIMIT 200`,
    params
  );
  return result.rows;
}

async function getRequest(id) {
  const result = await pool.query(
    `SELECT r.*, u.name AS account_name, a.name AS assigned_name
     FROM assistant_support_requests r LEFT JOIN users u ON u.id = r.user_id LEFT JOIN users a ON a.id = r.assigned_to
     WHERE r.id = $1`,
    [Number(id)]
  );
  if (!result.rowCount) throw new Error("Support request was not found.");
  const messages = await pool.query("SELECT * FROM assistant_support_messages WHERE request_id = $1 ORDER BY created_at", [Number(id)]);
  return { request: result.rows[0], messages: messages.rows };
}

async function updateRequest(agentId, id, action, message = "") {
  const transitions = { claim: ["claimed", "claimed_at = CURRENT_TIMESTAMP"], waiting: ["waiting", ""], resolve: ["resolved", "resolved_at = CURRENT_TIMESTAMP"] };
  if (!transitions[action]) throw new Error("Invalid customer-care action.");
  const [status, timestamp] = transitions[action];
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `UPDATE assistant_support_requests SET status = $1, assigned_to = COALESCE(assigned_to, $2), updated_at = CURRENT_TIMESTAMP${timestamp ? `, ${timestamp}` : ""} WHERE id = $3 RETURNING *`,
      [status, Number(agentId), Number(id)]
    );
    if (!result.rowCount) throw new Error("Support request was not found.");
    if (message.trim()) {
      await client.query(
        `INSERT INTO assistant_support_messages (request_id, author_id, author_type, message) VALUES ($1, $2, 'agent', $3)`,
        [Number(id), Number(agentId), message.trim()]
      );
    }
    await client.query("COMMIT");
    const request = result.rows[0];
    if (message.trim() && request.user_id) {
      await notificationModel.generateNotification({
        userId: request.user_id,
        type: "system",
        title: "ACC customer care replied",
        message: message.trim(),
        link: "/notifications",
        eventKey: `assistant_support_reply:${request.id}`,
        dedupeKey: `assistant_support_reply:${request.id}:${Date.now()}`,
      });
    }
    return request;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { createRequest, listRequests, getRequest, updateRequest };
