const pool = require("../database/connection");
const notificationModel = require("./notificationModel");

const SUPPORT_REQUIREMENTS = [
  ["ACC-FRS-SUP-001", "Issue reporting system", "Users can report issues with screenshots attached.", "critical"],
  ["ACC-FRS-SUP-002", "Ticket management system", "Support tickets are created and tracked through open, in-progress, and resolved states.", "critical"],
  ["ACC-FRS-SUP-003", "Support dashboard", "Support teams can review ticket overview and priority levels.", "high"],
  ["ACC-FRS-SUP-004", "User notifications for support", "Users receive notifications when support tickets are received or resolved.", "high"],
  ["ACC-FRS-SUP-005", "SLA management", "Response and resolution targets are monitored for support tickets.", "high"],
  ["ACC-FRS-SUP-006", "System maintenance scheduling", "Authorized operators can schedule maintenance windows and notify users.", "high"],
  ["ACC-FRS-SUP-007", "Bug tracking system", "Internal bugs and issues are documented and resolved.", "critical"],
  ["ACC-FRS-SUP-008", "Knowledge base and help center", "Users can find FAQs, tutorials, and guides.", "high"],
  ["ACC-FRS-SUP-009", "Maintenance logging", "Updates, fixes, and system changes are logged.", "medium"],
  ["ACC-FRS-SUP-010", "Continuous improvement tracking", "Platform improvements are documented over time.", "medium"],
];

async function ensureSchema() {
  await pool.query(`
    ALTER TABLE requirements DROP CONSTRAINT IF EXISTS requirements_requirement_id_check;
    ALTER TABLE requirements ADD CONSTRAINT requirements_requirement_id_check CHECK (requirement_id ~ '^(FR-[A-Z0-9]+|ACC-FRS-(PERF|MOB|AVAIL|SUP|LOG|QA|REL|ONB|AI|PART|ROAD))-[0-9]{3}$');
    CREATE TABLE IF NOT EXISTS support_slas (
      id BIGSERIAL PRIMARY KEY,
      name VARCHAR(120) NOT NULL UNIQUE,
      priority VARCHAR(20) NOT NULL CHECK (priority IN ('low','medium','high','critical')),
      response_minutes INTEGER NOT NULL CHECK (response_minutes > 0),
      resolution_minutes INTEGER NOT NULL CHECK (resolution_minutes >= response_minutes),
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS support_tickets (
      id BIGSERIAL PRIMARY KEY,
      ticket_number VARCHAR(30) NOT NULL UNIQUE,
      reporter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      title VARCHAR(220) NOT NULL,
      description TEXT NOT NULL,
      category VARCHAR(30) NOT NULL CHECK (category IN ('bug','question','incident','feature','maintenance','other')),
      maintenance_type VARCHAR(20) CHECK (maintenance_type IN ('corrective','preventive','adaptive','perfective')),
      priority VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','critical')),
      status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','closed')),
      sla_id BIGINT REFERENCES support_slas(id) ON DELETE SET NULL,
      first_responded_at TIMESTAMPTZ,
      resolved_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS support_ticket_comments (
      id BIGSERIAL PRIMARY KEY,
      ticket_id BIGINT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
      author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      body TEXT NOT NULL,
      internal BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS support_ticket_attachments (
      id BIGSERIAL PRIMARY KEY,
      ticket_id BIGINT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
      uploaded_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      original_name VARCHAR(255) NOT NULL,
      storage_path TEXT NOT NULL,
      mime_type VARCHAR(120) NOT NULL,
      file_size INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS maintenance_windows (
      id BIGSERIAL PRIMARY KEY,
      title VARCHAR(220) NOT NULL,
      description TEXT,
      maintenance_type VARCHAR(20) NOT NULL CHECK (maintenance_type IN ('corrective','preventive','adaptive','perfective')),
      starts_at TIMESTAMPTZ NOT NULL,
      ends_at TIMESTAMPTZ NOT NULL CHECK (ends_at > starts_at),
      status VARCHAR(20) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','active','completed','cancelled')),
      notify_users BOOLEAN NOT NULL DEFAULT TRUE,
      created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS maintenance_logs (
      id BIGSERIAL PRIMARY KEY,
      maintenance_window_id BIGINT REFERENCES maintenance_windows(id) ON DELETE SET NULL,
      actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      event_type VARCHAR(40) NOT NULL CHECK (event_type IN ('update','fix','system_change','window_created','window_completed')),
      summary TEXT NOT NULL,
      details JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS knowledge_base_articles (
      id BIGSERIAL PRIMARY KEY,
      slug VARCHAR(180) NOT NULL UNIQUE,
      title VARCHAR(220) NOT NULL,
      article_type VARCHAR(20) NOT NULL CHECK (article_type IN ('faq','tutorial','guide')),
      summary TEXT NOT NULL,
      body TEXT NOT NULL,
      published BOOLEAN NOT NULL DEFAULT TRUE,
      author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS support_improvements (
      id BIGSERIAL PRIMARY KEY,
      title VARCHAR(220) NOT NULL,
      description TEXT NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','in_progress','completed','cancelled')),
      source_ticket_id BIGINT REFERENCES support_tickets(id) ON DELETE SET NULL,
      owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      completed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS support_tickets_status_idx ON support_tickets(status, priority, created_at DESC);
    CREATE INDEX IF NOT EXISTS support_comments_ticket_idx ON support_ticket_comments(ticket_id, created_at);
    CREATE INDEX IF NOT EXISTS maintenance_windows_dates_idx ON maintenance_windows(starts_at, ends_at);
    CREATE INDEX IF NOT EXISTS maintenance_logs_created_idx ON maintenance_logs(created_at DESC);
  `);
  await pool.query(`INSERT INTO support_slas (name, priority, response_minutes, resolution_minutes) VALUES ('Critical support', 'critical', 30, 240), ('High support', 'high', 120, 1440), ('Standard support', 'medium', 480, 4320), ('Low support', 'low', 1440, 10080) ON CONFLICT (name) DO NOTHING`);
  await pool.query(`INSERT INTO permissions (permission_key, resource, action, description) VALUES ('admin.support.read','admin_support','read','View support tickets, SLAs, maintenance windows, help content, and analytics.'), ('admin.support.manage','admin_support','manage','Manage tickets, maintenance windows, knowledge content, logs, and improvements.') ON CONFLICT (permission_key) DO NOTHING`);
  await pool.query(`INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r CROSS JOIN permissions p WHERE r.role_key IN ('platform_admin','system_admin','acc_management_admin','super_admin') AND p.permission_key IN ('admin.support.read','admin.support.manage') ON CONFLICT DO NOTHING`);
  for (const [requirementId, name, description, priority] of SUPPORT_REQUIREMENTS) {
    await pool.query(`INSERT INTO requirements (requirement_id, name, description, actor, preconditions, postconditions, priority, category, dependencies) VALUES ($1,$2,$3,'ACC support operator','PostgreSQL is available and the user is authenticated.','Support evidence is persisted and visible to authorized operators.',$4,'functional',ARRAY['support_tickets','maintenance_windows','knowledge_base_articles']) ON CONFLICT (requirement_id) DO NOTHING`, [requirementId, name, description, priority]);
    await pool.query(`INSERT INTO requirement_traceability (requirement_id, user_story, ui_reference, api_reference, database_objects, test_case, sprint, release, coverage_status, notes) SELECT id, $2, 'views/support/help-center.ejs and views/admin/support.ejs', 'POST /support/tickets and GET /admin/support', ARRAY['support_tickets','support_slas','maintenance_windows','maintenance_logs','knowledge_base_articles','support_improvements'], 'tests/chapter38-support.test.js', 'Maintenance and Support', '1.0', 'complete', 'Chapter 38 support controls are PostgreSQL-backed.' FROM requirements WHERE requirement_id = $1 ON CONFLICT (requirement_id) DO NOTHING`, [requirementId, `As an ACC user, I want ${name.toLowerCase()} so platform support is dependable.`]);
  }
}

async function notifyUser(userId, title, message, eventKey) {
  try { await notificationModel.generateNotification({ userId, type: "system", priority: "high", title, message, link: "/support/tickets", eventKey, dedupeKey: `${eventKey}:${userId}` }); } catch (error) { await pool.query("INSERT INTO maintenance_logs (event_type, summary, details) VALUES ('system_change', $1, $2)", ["Support notification delivery failed.", { userId, error: error.message }]); }
}

async function createTicket(reporterId, input, attachment = null) {
  const title = String(input.title || "").trim();
  const description = String(input.description || "").trim();
  const category = ["bug", "question", "incident", "feature", "maintenance", "other"].includes(input.category) ? input.category : "other";
  const priority = ["low", "medium", "high", "critical"].includes(input.priority) ? input.priority : "medium";
  if (!title || !description) return { success: false, message: "Title and description are required." };
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const sla = await client.query("SELECT id FROM support_slas WHERE priority = $1 AND active = TRUE ORDER BY id LIMIT 1", [priority]);
    const number = `ACC-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`;
    const ticket = await client.query(`INSERT INTO support_tickets (ticket_number, reporter_id, title, description, category, maintenance_type, priority, sla_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id, ticket_number AS "ticketNumber"`, [number, Number(reporterId), title, description, category, input.maintenanceType || null, priority, sla.rows[0] ? sla.rows[0].id : null]);
    if (attachment) await client.query("INSERT INTO support_ticket_attachments (ticket_id, uploaded_by, original_name, storage_path, mime_type, file_size) VALUES ($1,$2,$3,$4,$5,$6)", [ticket.rows[0].id, reporterId, attachment.originalname, attachment.path, attachment.mimetype, attachment.size]);
    await client.query("INSERT INTO maintenance_logs (event_type, summary, details, actor_id) VALUES ('system_change',$1,$2,$3)", ["Support ticket created.", { ticketId: ticket.rows[0].id, ticketNumber: number }, reporterId]);
    await client.query("COMMIT");
    await notifyUser(reporterId, `Support ticket ${number} received`, "Your issue has been submitted to ACC support.", `support_ticket:${ticket.rows[0].id}:received`);
    return { success: true, ticket: ticket.rows[0] };
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}

async function listUserTickets(userId) {
  const result = await pool.query(`SELECT id, ticket_number AS "ticketNumber", title, category, priority, status, created_at AS "createdAt", updated_at AS "updatedAt" FROM support_tickets WHERE reporter_id = $1 ORDER BY created_at DESC`, [Number(userId)]);
  return result.rows;
}

async function getDashboard() {
  const [tickets, metrics, windows, articles, improvements, logs] = await Promise.all([
    pool.query(`SELECT t.id, t.ticket_number AS "ticketNumber", t.title, t.description, t.category, t.maintenance_type AS "maintenanceType", t.priority, t.status, t.reporter_id AS "reporterId", t.assignee_id AS "assigneeId", t.created_at AS "createdAt", t.updated_at AS "updatedAt", u.name AS "reporterName", COALESCE(a.name, 'Unassigned') AS "assigneeName" FROM support_tickets t JOIN users u ON u.id=t.reporter_id LEFT JOIN users a ON a.id=t.assignee_id ORDER BY CASE t.status WHEN 'open' THEN 1 WHEN 'in_progress' THEN 2 ELSE 3 END, t.created_at DESC LIMIT 50`),
    pool.query(`SELECT COUNT(*)::integer AS total, COUNT(*) FILTER (WHERE status='open')::integer AS open, COUNT(*) FILTER (WHERE status='in_progress')::integer AS in_progress, COUNT(*) FILTER (WHERE priority='critical' AND status NOT IN ('resolved','closed'))::integer AS critical, COUNT(*) FILTER (WHERE status NOT IN ('resolved','closed') AND first_responded_at IS NULL AND sla_id IS NOT NULL AND created_at + (SELECT response_minutes * INTERVAL '1 minute' FROM support_slas s WHERE s.id=support_tickets.sla_id) < CURRENT_TIMESTAMP)::integer AS overdue_response, COUNT(*) FILTER (WHERE status NOT IN ('resolved','closed') AND sla_id IS NOT NULL AND created_at + (SELECT resolution_minutes * INTERVAL '1 minute' FROM support_slas s WHERE s.id=support_tickets.sla_id) < CURRENT_TIMESTAMP)::integer AS overdue_resolution FROM support_tickets`),
    pool.query(`SELECT id, title, description, maintenance_type AS "maintenanceType", starts_at AS "startsAt", ends_at AS "endsAt", status, notify_users AS "notifyUsers" FROM maintenance_windows ORDER BY starts_at DESC LIMIT 20`),
    pool.query(`SELECT id, slug, title, article_type AS "articleType", summary, published, updated_at AS "updatedAt" FROM knowledge_base_articles WHERE published=TRUE ORDER BY updated_at DESC`),
    pool.query(`SELECT id, title, description, status, created_at AS "createdAt", completed_at AS "completedAt" FROM support_improvements ORDER BY created_at DESC LIMIT 20`),
    pool.query(`SELECT id, event_type AS "eventType", summary, details, created_at AS "createdAt" FROM maintenance_logs ORDER BY created_at DESC LIMIT 20`),
  ]);
  return { tickets: tickets.rows, metrics: metrics.rows[0], windows: windows.rows, articles: articles.rows, improvements: improvements.rows, logs: logs.rows };
}

async function updateTicket(actorId, ticketId, input) {
  const allowed = ["open", "in_progress", "resolved", "closed"];
  const status = allowed.includes(input.status) ? input.status : null;
  if (!status) return { success: false, message: "Select a valid ticket status." };
  const result = await pool.query(`UPDATE support_tickets SET status=$1, assignee_id=COALESCE($2, assignee_id), first_responded_at=CASE WHEN $1='in_progress' AND first_responded_at IS NULL THEN CURRENT_TIMESTAMP ELSE first_responded_at END, resolved_at=CASE WHEN $1 IN ('resolved','closed') THEN CURRENT_TIMESTAMP ELSE resolved_at END, updated_at=CURRENT_TIMESTAMP WHERE id=$3 RETURNING reporter_id, ticket_number`, [status, actorId, Number(ticketId)]);
  if (!result.rowCount) return { success: false, message: "Support ticket was not found." };
  await pool.query("INSERT INTO maintenance_logs (event_type, summary, details, actor_id) VALUES ('system_change',$1,$2,$3)", ["Support ticket status updated.", { ticketId: Number(ticketId), status }, actorId]);
  await notifyUser(result.rows[0].reporter_id, `Support ticket ${result.rows[0].ticket_number}`, `Your ticket is now ${status.replace("_", " ")}.`, `support_ticket:${ticketId}:${status}`);
  return { success: true, message: "Support ticket updated." };
}

async function createMaintenanceWindow(actorId, input) {
  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(input.endsAt);
  if (!input.title || Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) return { success: false, message: "Provide a title and a valid maintenance interval." };
  const result = await pool.query(`INSERT INTO maintenance_windows (title, description, maintenance_type, starts_at, ends_at, notify_users, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`, [String(input.title).trim(), String(input.description || "").trim(), input.maintenanceType || "preventive", startsAt, endsAt, input.notifyUsers === "on", actorId]);
  await pool.query("INSERT INTO maintenance_logs (maintenance_window_id, actor_id, event_type, summary) VALUES ($1,$2,'window_created',$3)", [result.rows[0].id, actorId, `Maintenance window created: ${input.title}`]);
  if (input.notifyUsers === "on") {
    const users = await pool.query("SELECT id FROM users WHERE status = 'active'");
    await Promise.all(users.rows.map((user) => notifyUser(user.id, "Scheduled ACC maintenance", `${input.title} is scheduled from ${startsAt.toLocaleString()} to ${endsAt.toLocaleString()}.`, `maintenance_window:${result.rows[0].id}`)));
  }
  return { success: true, message: "Maintenance window scheduled." };
}

module.exports = { SUPPORT_REQUIREMENTS, ensureSchema, createTicket, listUserTickets, getDashboard, updateTicket, createMaintenanceWindow };
