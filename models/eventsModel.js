/* ******************************************
 * eventsModel.js - Event lifecycle, registration, feedback, and audit support for ACC Chapter 15.
 * Stores event data in PostgreSQL while preserving the controller-facing event API.
 *******************************************/
const notificationModel = require("./notificationModel");
const pool = require("../database/connection");

async function logEventAudit(eventType, details = {}) {
  const result = await pool.query(`INSERT INTO event_audit_logs (event_id, user_id, event_type, outcome, details) VALUES ($1, $2, $3, $4, $5) RETURNING *`, [details.eventId || null, details.userId || details.createdBy || null, eventType, details.outcome || "success", details]);
  return result.rows[0];
}

function logEventNotification(type, payload = {}) {
  return notificationModel.generateFromEvent(type, payload);
}

function normalizeEvent(record = {}) {
  return {
    id: Number(record.id),
    title: record.title || "Untitled event",
    description: record.description || "",
    organizer: record.organizer || "ACC",
    eventType: (record.eventType || record.event_type || "physical").toLowerCase(),
    eventFormat: (record.eventFormat || record.event_format || record.eventType || "physical").toLowerCase(),
    startDate: record.startDate || record.start_date || new Date().toISOString(),
    endDate: record.endDate || record.end_date || record.startDate || record.start_date || new Date().toISOString(),
    location: record.location || "TBD",
    visibility: (record.visibility || "public").toLowerCase(),
    status: (record.status || "draft").toLowerCase(),
    capacity: Number(record.capacity || 0),
    ticketType: (record.ticketType || "free").toLowerCase(),
    price: Number(record.price || 0),
    flyerPath: record.flyerPath || record.flyer_path || "",
    createdBy: record.createdBy || record.created_by || null,
    createdAt: record.createdAt || record.created_at || new Date().toISOString(),
    updatedAt: record.updatedAt || record.updated_at || record.created_at || new Date().toISOString(),
    publishedAt: record.publishedAt || record.published_at || null,
    registrationCount: Number(record.registrationCount || 0),
  };
}

function normalizeRegistration(record = {}) {
  return {
    id: Number(record.id),
    eventId: Number(record.event_id || record.eventId),
    userId: Number(record.user_id || record.userId),
    name: record.registration_name || record.name || "",
    email: record.email || "",
    ticketType: record.ticket_type || record.ticketType || "standard",
    paymentStatus: record.payment_status || record.paymentStatus || "pending",
    registeredAt: record.registered_at || record.registeredAt || null,
  };
}

async function createEvent(payload = {}) {
  const title = String(payload.title || "").trim();
  const description = String(payload.description || "").trim();
  const organizer = String(payload.organizer || "").trim() || "African Chamber of Commerce";
  const eventType = String(payload.eventType || "physical").trim().toLowerCase();
  const eventFormat = String(payload.eventFormat || payload.format || eventType).trim().toLowerCase();
  const startDate = payload.startDate || payload.start_date;
  const endDate = payload.endDate || payload.end_date || startDate;
  const location = String(payload.location || "").trim();
  const visibility = String(payload.visibility || "public").trim().toLowerCase();
  const capacity = Number(payload.capacity || 0);
  const ticketType = String(payload.ticketType || "free").trim().toLowerCase();
  const price = Number(payload.price || 0);
  const flyerPath = String(payload.flyerPath || payload.flyer_path || "").trim() || null;

  if (!title || !description || !startDate) {
    return { success: false, message: "Event title, description, and start date are required." };
  }

  const result = await pool.query(
      `INSERT INTO event_records (
        title, description, organizer, event_type, event_format, start_date, end_date,
        location, visibility, status, capacity, ticket_type, price, flyer_path, created_by,
        created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'draft',$10,$11,$12,$13,$14,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
      RETURNING *`,
      [title, description, organizer, eventType, eventFormat, startDate, endDate, location || "TBD",
        visibility, capacity, ticketType, price, flyerPath, payload.createdBy || null]
    );
  const createdEvent = normalizeEvent(result.rows[0]);
  await logEventAudit("event_created", { eventId: createdEvent.id, createdBy: payload.createdBy || null, eventType, outcome: "success" });
  return { success: true, event: createdEvent, ...createdEvent, message: "Event created successfully." };
}

async function publishEvent(eventId, userId = null) {
  const result = await pool.query(
      `UPDATE event_records SET status = 'published', published_at = CURRENT_TIMESTAMP,
       updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND ($2::integer IS NULL OR created_by = $2)
       RETURNING *`,
      [eventId, userId]
    );
  if (!result.rows.length) return { success: false, message: "Event not found." };
  const event = normalizeEvent(result.rows[0]);
  await logEventAudit("event_published", { eventId: event.id, userId, outcome: "success" });
  logEventNotification("event_published", { eventId: event.id, title: event.title, organizer: event.organizer });
  return { success: true, event, message: "Event published successfully." };
}

async function getEvents(filters = {}) {
  const page = Number(filters.page || 1);
  const limit = Number(filters.limit || 10);
  const keyword = String(filters.keyword || "").trim().toLowerCase();
  const eventType = String(filters.eventType || filters.type || "all").trim().toLowerCase();
  const visibility = String(filters.visibility || "all").trim().toLowerCase();

  try {
    const values = [];
    const conditions = ["status = 'published'"];
    if (visibility !== "all") {
      values.push(visibility);
      conditions.push(`visibility = $${values.length}`);
    }
    if (eventType !== "all") {
      values.push(eventType);
      conditions.push(`event_type = $${values.length}`);
    }
    if (keyword) {
      values.push(`%${keyword}%`);
      conditions.push(`(title ILIKE $${values.length} OR description ILIKE $${values.length} OR organizer ILIKE $${values.length} OR location ILIKE $${values.length})`);
    }
    const countResult = await pool.query(`SELECT COUNT(*)::int AS total FROM event_records WHERE ${conditions.join(" AND ")}`, values);
    const total = countResult.rows[0].total;
    const totalPages = Math.max(1, Math.ceil(total / Math.max(limit, 1)));
    const safePage = Math.min(Math.max(page, 1), totalPages);
    values.push(limit, (safePage - 1) * limit);
    const result = await pool.query(
      `SELECT e.*, COUNT(r.id)::int AS registration_count FROM event_records e
       LEFT JOIN event_registrations r ON r.event_id = e.id
       WHERE ${conditions.map((condition) => `e.${condition}`).join(" AND ")}
       GROUP BY e.id ORDER BY e.start_date ASC LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values
    );
    return { events: result.rows.map(normalizeEvent), total, page: safePage, limit, totalPages };
  } catch (error) {
    throw error;
  }
}

async function getEventById(eventId) {
  const result = await pool.query(
      `SELECT e.*, COUNT(r.id)::int AS registration_count FROM event_records e
       LEFT JOIN event_registrations r ON r.event_id = e.id
       WHERE e.id = $1 GROUP BY e.id LIMIT 1`,
      [eventId]
    );
  return result.rows.length ? normalizeEvent(result.rows[0]) : null;
}

async function registerForEvent(userId, eventId, payload = {}) {
  if (!userId || !eventId) {
    return { success: false, message: "User and event are required for registration." };
  }
  const eventResult = await pool.query(`SELECT * FROM event_records WHERE id = $1 LIMIT 1`, [eventId]);
  if (!eventResult.rows.length) return { success: false, message: "The event you selected could not be found." };
  const event = normalizeEvent(eventResult.rows[0]);
  if (event.status !== "published") return { success: false, message: "This event is not open for registration yet." };
  const attendeeCountResult = await pool.query(`SELECT COUNT(*)::int AS total FROM event_registrations WHERE event_id = $1`, [eventId]);
  if (event.capacity > 0 && attendeeCountResult.rows[0].total >= event.capacity) return { success: false, message: "This event is full and registration is closed." };
  const registrationResult = await pool.query(
    `INSERT INTO event_registrations (event_id, user_id, registration_name, email, ticket_type, payment_status)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [eventId, userId, String(payload.name || "").trim() || `User ${userId}`, String(payload.email || "").trim() || `${userId}@acc.local`, String(payload.ticketType || event.ticketType || "standard").trim().toLowerCase(), event.ticketType === "paid" || Number(event.price) > 0 ? "payment_required" : "not_required"]
  );
  const registration = normalizeRegistration(registrationResult.rows[0]);
  await logEventAudit("event_registration", { eventId: registration.eventId, userId: registration.userId, ticketType: registration.ticketType, outcome: "success" });
  logEventNotification("event_registration", {
    eventId: registration.eventId,
    userId: registration.userId,
    ticketType: registration.ticketType,
    title: event.title,
  });

  return {
    success: true,
    registration,
    message:
      event.ticketType === "paid" || Number(event.price) > 0
        ? "Registration recorded. Payment is required for this ticket type."
        : "Registration successful.",
  };
}

async function getAttendees(eventId) {
  const result = await pool.query(`SELECT id, user_id, registration_name, email, ticket_type, payment_status, registered_at FROM event_registrations WHERE event_id = $1 ORDER BY registered_at ASC`, [eventId]);
  return result.rows.map(normalizeRegistration);
}

async function submitEventFeedback(userId, eventId, payload = {}) {
  const eventResult = await pool.query(`SELECT id FROM event_records WHERE id = $1`, [eventId]);
  if (!eventResult.rows.length) return { success: false, message: "Event not found." };
  const registration = await pool.query(`SELECT 1 FROM event_registrations WHERE event_id = $1 AND user_id = $2`, [eventId, userId]);
  if (!registration.rows.length) return { success: false, message: "You must register for the event before submitting feedback." };
  const rating = Number(payload.rating || 0);
  const comments = String(payload.comments || "").trim();
  if (!rating || rating < 1 || rating > 5) return { success: false, message: "A rating between 1 and 5 is required." };
  const result = await pool.query(`INSERT INTO event_feedback (event_id, user_id, rating, comments) VALUES ($1, $2, $3, $4) RETURNING *`, [eventId, userId, rating, comments]);
  const record = { id: result.rows[0].id, eventId: Number(result.rows[0].event_id), userId: Number(result.rows[0].user_id), rating: result.rows[0].rating, comments: result.rows[0].comments || "", createdAt: result.rows[0].created_at };
  await logEventAudit("event_feedback_submitted", { eventId: record.eventId, userId: record.userId, rating, outcome: "success" });
  return { success: true, feedback: record, message: "Feedback submitted successfully." };
}

async function getEventFeedback(eventId) {
  const result = await pool.query(`SELECT id, user_id, rating, comments, created_at FROM event_feedback WHERE event_id = $1 ORDER BY created_at DESC`, [eventId]);
  return result.rows.map((row) => ({ id: row.id, userId: Number(row.user_id), rating: row.rating, comments: row.comments || "", createdAt: row.created_at }));
}

async function getEventAuditLog(eventId, limit = 20) {
  const result = await pool.query(`SELECT * FROM event_audit_logs WHERE event_id = $1 ORDER BY created_at DESC LIMIT $2`, [eventId, limit]);
  return result.rows;
}

function escapeCsv(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

async function exportAttendeeCsv(eventId) {
  const attendees = await getAttendees(eventId);
  const rows = [
    ["userId", "name", "email", "ticketType", "paymentStatus", "registeredAt"],
    ...attendees.map((entry) => [
      entry.userId,
      entry.name,
      entry.email,
      entry.ticketType,
      entry.paymentStatus,
      entry.registeredAt,
    ]),
  ];

  const csv = rows
    .map((row) => row.map((cell) => escapeCsv(cell)).join(","))
    .join("\n");

  return csv;
}

async function getOrganizerEvents(createdBy) {
  const result = await pool.query(`SELECT e.*, COUNT(r.id)::int AS registration_count FROM event_records e LEFT JOIN event_registrations r ON r.event_id = e.id WHERE e.created_by = $1 GROUP BY e.id ORDER BY e.created_at DESC`, [createdBy]);
  return result.rows.map(normalizeEvent);
}

module.exports = {
  createEvent,
  publishEvent,
  getEvents,
  getEventById,
  registerForEvent,
  getAttendees,
  submitEventFeedback,
  getEventFeedback,
  getEventAuditLog,
  exportAttendeeCsv,
  getOrganizerEvents,
  logEventAudit,
  logEventNotification,
};
