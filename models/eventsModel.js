/* ******************************************
 * eventsModel.js - Event lifecycle, registration, feedback, and audit support for ACC Chapter 15.
 * Stores event data in a lightweight in-memory fallback model while preserving audit logging.
 *******************************************/
const fs = require("fs");
const path = require("path");

const auditLogPath = path.join(__dirname, "..", "logs", "events-audit.log");
const notificationLogPath = path.join(__dirname, "..", "logs", "events-notifications.log");
fs.mkdirSync(path.dirname(auditLogPath), { recursive: true });
fs.mkdirSync(path.dirname(notificationLogPath), { recursive: true });

const fallbackEvents = [
  {
    id: 1,
    title: "Pan-African Business Summit",
    description: "A flagship gathering of leaders, buyers, and innovators sharing investment opportunities across the continent.",
    organizer: "African Chamber of Commerce",
    eventType: "physical",
    eventFormat: "physical",
    startDate: "2026-09-05T09:00:00.000Z",
    endDate: "2026-09-06T17:00:00.000Z",
    location: "Johannesburg Convention Centre, South Africa",
    visibility: "public",
    status: "published",
    capacity: 180,
    ticketType: "paid",
    price: 120,
    createdBy: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    publishedAt: new Date().toISOString(),
  },
  {
    id: 2,
    title: "Export Readiness Clinic",
    description: "A practical webinar for SMEs preparing to sell across regional and international markets.",
    organizer: "Growth Advisory Desk",
    eventType: "virtual",
    eventFormat: "virtual",
    startDate: "2026-08-28T14:00:00.000Z",
    endDate: "2026-08-28T16:00:00.000Z",
    location: "https://zoom.us/acc-export-clinic",
    visibility: "public",
    status: "published",
    capacity: 80,
    ticketType: "free",
    price: 0,
    createdBy: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    publishedAt: new Date().toISOString(),
  },
];

const fallbackRegistrations = [
  {
    id: 1,
    eventId: 1,
    userId: 2,
    name: "Nia Mensah",
    email: "nia@example.com",
    ticketType: "standard",
    paymentStatus: "paid",
    registeredAt: new Date().toISOString(),
  },
];

const fallbackFeedback = [
  {
    id: 1,
    eventId: 1,
    userId: 2,
    rating: 5,
    comments: "Very productive and well organized.",
    createdAt: new Date().toISOString(),
  },
];

function logEventAudit(eventType, details = {}) {
  const entry = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    eventType,
    timestamp: new Date().toISOString(),
    details,
  };

  fs.appendFileSync(auditLogPath, `${JSON.stringify(entry)}\n`);
  return entry;
}

function logEventNotification(type, payload = {}) {
  const entry = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type,
    timestamp: new Date().toISOString(),
    payload,
  };

  fs.appendFileSync(notificationLogPath, `${JSON.stringify(entry)}\n`);
  return entry;
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
    createdBy: record.createdBy || null,
    createdAt: record.createdAt || new Date().toISOString(),
    updatedAt: record.updatedAt || record.createdAt || new Date().toISOString(),
    publishedAt: record.publishedAt || null,
    registrationCount: Number(record.registrationCount || 0),
  };
}

function getEventRegistrationCount(eventId) {
  return fallbackRegistrations.filter((entry) => Number(entry.eventId) === Number(eventId)).length;
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

  if (!title || !description || !startDate) {
    return { success: false, message: "Event title, description, and start date are required." };
  }

  const record = {
    id: fallbackEvents.length + 1,
    title,
    description,
    organizer,
    eventType,
    eventFormat,
    startDate,
    endDate,
    location: location || "TBD",
    visibility,
    status: "draft",
    capacity,
    ticketType,
    price,
    createdBy: payload.createdBy || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    publishedAt: null,
    registrationCount: 0,
  };

  fallbackEvents.push(record);
  logEventAudit("event_created", {
    eventId: record.id,
    createdBy: payload.createdBy || null,
    eventType: record.eventType,
    outcome: "success",
  });

  const createdEvent = normalizeEvent(record);
  return {
    success: true,
    event: createdEvent,
    ...createdEvent,
    message: "Event created successfully.",
  };
}

async function publishEvent(eventId, userId = null) {
  const event = fallbackEvents.find((item) => Number(item.id) === Number(eventId));

  if (!event) {
    return { success: false, message: "Event not found." };
  }

  if (event.status === "published") {
    return { success: true, event: normalizeEvent(event), message: "Event is already published." };
  }

  event.status = "published";
  event.publishedAt = new Date().toISOString();
  event.updatedAt = new Date().toISOString();

  logEventAudit("event_published", { eventId: event.id, userId, outcome: "success" });
  logEventNotification("event_published", { eventId: event.id, title: event.title, organizer: event.organizer });

  return { success: true, event: normalizeEvent(event), message: "Event published successfully." };
}

async function getEvents(filters = {}) {
  const page = Number(filters.page || 1);
  const limit = Number(filters.limit || 10);
  const keyword = String(filters.keyword || "").trim().toLowerCase();
  const eventType = String(filters.eventType || filters.type || "all").trim().toLowerCase();
  const visibility = String(filters.visibility || "all").trim().toLowerCase();

  let records = fallbackEvents.filter((entry) => entry.status === "published");

  if (visibility && visibility !== "all") {
    records = records.filter((entry) => (entry.visibility || "public").toLowerCase() === visibility);
  }

  if (eventType && eventType !== "all") {
    records = records.filter((entry) => (entry.eventType || "physical").toLowerCase() === eventType);
  }

  if (keyword) {
    records = records.filter((entry) => {
      const haystack = `${entry.title} ${entry.description} ${entry.organizer} ${entry.location}`.toLowerCase();
      return haystack.includes(keyword);
    });
  }

  records = records.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

  const total = records.length;
  const totalPages = Math.max(1, Math.ceil(total / Math.max(limit, 1)));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const startIndex = (safePage - 1) * limit;
  const paginated = records.slice(startIndex, startIndex + limit).map((record) => {
    const normalized = normalizeEvent(record);
    normalized.registrationCount = getEventRegistrationCount(record.id);
    return normalized;
  });

  return {
    events: paginated,
    total,
    page: safePage,
    limit,
    totalPages,
  };
}

async function getEventById(eventId) {
  const event = fallbackEvents.find((item) => Number(item.id) === Number(eventId));
  if (!event) return null;

  const normalized = normalizeEvent(event);
  normalized.registrationCount = getEventRegistrationCount(event.id);
  return normalized;
}

async function registerForEvent(userId, eventId, payload = {}) {
  if (!userId || !eventId) {
    return { success: false, message: "User and event are required for registration." };
  }

  const event = fallbackEvents.find((item) => Number(item.id) === Number(eventId));
  if (!event) {
    return { success: false, message: "The event you selected could not be found." };
  }

  if (event.status !== "published") {
    return { success: false, message: "This event is not open for registration yet." };
  }

  const duplicate = fallbackRegistrations.find(
    (item) => Number(item.eventId) === Number(eventId) && Number(item.userId) === Number(userId)
  );

  if (duplicate) {
    return { success: false, message: "You are already registered for this event." };
  }

  const attendeeCount = fallbackRegistrations.filter((item) => Number(item.eventId) === Number(eventId)).length;
  const capacity = Number(event.capacity || 0);

  if (capacity > 0 && attendeeCount >= capacity) {
    return { success: false, message: "This event is full and registration is closed." };
  }

  const registration = {
    id: fallbackRegistrations.length + 1,
    eventId: Number(eventId),
    userId: Number(userId),
    name: String(payload.name || "").trim() || `User ${userId}`,
    email: String(payload.email || "").trim() || `${userId}@acc.local`,
    ticketType: String(payload.ticketType || event.ticketType || "standard").trim().toLowerCase(),
    paymentStatus: event.ticketType === "paid" || Number(event.price) > 0 ? "payment_required" : "not_required",
    registeredAt: new Date().toISOString(),
  };

  fallbackRegistrations.push(registration);
  logEventAudit("event_registration", {
    eventId: registration.eventId,
    userId: registration.userId,
    ticketType: registration.ticketType,
    outcome: "success",
  });
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
  return fallbackRegistrations
    .filter((entry) => Number(entry.eventId) === Number(eventId))
    .map((entry) => ({
      id: entry.id,
      userId: entry.userId,
      name: entry.name,
      email: entry.email,
      ticketType: entry.ticketType,
      paymentStatus: entry.paymentStatus,
      registeredAt: entry.registeredAt,
    }));
}

async function submitEventFeedback(userId, eventId, payload = {}) {
  const event = fallbackEvents.find((item) => Number(item.id) === Number(eventId));

  if (!event) {
    return { success: false, message: "Event not found." };
  }

  const hasRegistration = fallbackRegistrations.some(
    (entry) => Number(entry.eventId) === Number(eventId) && Number(entry.userId) === Number(userId)
  );

  if (!hasRegistration) {
    return { success: false, message: "You must register for the event before submitting feedback." };
  }

  const rating = Number(payload.rating || 0);
  const comments = String(payload.comments || "").trim();

  if (!rating || rating < 1 || rating > 5) {
    return { success: false, message: "A rating between 1 and 5 is required." };
  }

  const record = {
    id: fallbackFeedback.length + 1,
    eventId: Number(eventId),
    userId: Number(userId),
    rating,
    comments,
    createdAt: new Date().toISOString(),
  };

  fallbackFeedback.push(record);
  logEventAudit("event_feedback_submitted", { eventId: record.eventId, userId: record.userId, rating, outcome: "success" });

  return { success: true, feedback: record, message: "Feedback submitted successfully." };
}

async function getEventFeedback(eventId) {
  return fallbackFeedback
    .filter((entry) => Number(entry.eventId) === Number(eventId))
    .map((entry) => ({
      id: entry.id,
      userId: entry.userId,
      rating: entry.rating,
      comments: entry.comments,
      createdAt: entry.createdAt,
    }));
}

async function getEventAuditLog(eventId, limit = 20) {
  const lines = fs.existsSync(auditLogPath)
    ? fs.readFileSync(auditLogPath, "utf8").trim().split(/\n+/).filter(Boolean)
    : [];

  const entries = lines
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        return null;
      }
    })
    .filter(Boolean)
    .filter((entry) => {
      const eventDetails = entry.details || {};
      return Number(eventDetails.eventId || 0) === Number(eventId);
    })
    .slice(-limit);

  return entries;
}

function escapeCsv(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function exportAttendeeCsv(eventId) {
  const attendees = getAttendees(eventId);
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
  return fallbackEvents
    .filter((entry) => Number(entry.createdBy) === Number(createdBy))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map((record) => {
      const normalized = normalizeEvent(record);
      normalized.registrationCount = getEventRegistrationCount(record.id);
      return normalized;
    });
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
