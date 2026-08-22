/* ******************************************
 * eventsController.js - Controller logic for browsing, creating, registering, and managing ACC events.
 *******************************************/
const eventsModel = require("../models/eventsModel");

async function eventsPage(req, res, next) {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 9);
    const keyword = String(req.query.keyword || "").trim();
    const eventType = String(req.query.eventType || "all").trim();
    const visibility = String(req.query.visibility || "all").trim();

    const result = await eventsModel.getEvents({
      page,
      limit,
      keyword,
      eventType,
      visibility,
    });

    return res.render("events/index", {
      title: "Events & Business Engagements",
      user: req.session && req.session.user ? req.session.user : null,
      events: result.events || [],
      total: result.total || 0,
      page: result.page || 1,
      totalPages: result.totalPages || 1,
      keyword,
      eventType,
      visibility,
      message: req.query.message || "",
      error: "",
    });
  } catch (error) {
    return next(error);
  }
}

async function createEventPage(req, res, next) {
  try {
    return res.render("events/create", {
      title: "Create Event",
      user: req.session && req.session.user ? req.session.user : null,
      message: "",
      error: "",
      formData: {},
    });
  } catch (error) {
    return next(error);
  }
}

async function submitCreateEvent(req, res, next) {
  try {
    const payload = {
      title: req.body.title,
      description: req.body.description,
      organizer: req.body.organizer || "African Chamber of Commerce",
      eventType: req.body.eventType,
      eventFormat: req.body.eventFormat || req.body.eventType,
      startDate: req.body.startDate,
      endDate: req.body.endDate || req.body.startDate,
      location: req.body.location,
      visibility: req.body.visibility || "public",
      capacity: req.body.capacity,
      ticketType: req.body.ticketType || "free",
      price: req.body.price || 0,
      createdBy: req.session && req.session.user ? req.session.user.id : null,
    };

    const result = await eventsModel.createEvent(payload);

    if (!result.success) {
      return res.status(400).render("events/create", {
        title: "Create Event",
        user: req.session && req.session.user ? req.session.user : null,
        message: "",
        error: result.message,
        formData: payload,
      });
    }

    const eventId = result && (result.event && result.event.id ? result.event.id : result.id ? result.id : null);
    const published = eventId ? await eventsModel.publishEvent(eventId, payload.createdBy) : null;

    const redirectMessage = published && published.success ? "Event published successfully." : "Event created successfully.";
    return res.redirect(`/events/${eventId}?message=${encodeURIComponent(redirectMessage)}`);
  } catch (error) {
    return next(error);
  }
}

async function eventDetailPage(req, res, next) {
  try {
    const event = await eventsModel.getEventById(req.params.id);

    if (!event) {
      return res.status(404).render("error/404", {
        title: "Event not found",
        user: req.session && req.session.user ? req.session.user : null,
      });
    }

    const attendees = await eventsModel.getAttendees(event.id);
    const feedback = await eventsModel.getEventFeedback(event.id);
    const currentUserId = req.session && req.session.user ? req.session.user.id : null;
    const isRegistered = currentUserId
      ? attendees.some((entry) => Number(entry.userId) === Number(currentUserId))
      : false;

    return res.render("events/detail", {
      title: event.title,
      user: req.session && req.session.user ? req.session.user : null,
      event,
      attendees,
      feedback,
      isRegistered,
      message: req.query.message || "",
      error: "",
    });
  } catch (error) {
    return next(error);
  }
}

async function registerEvent(req, res, next) {
  try {
    const userId = req.session && req.session.user ? req.session.user.id : null;
    if (!userId) {
      return res.redirect("/login?message=" + encodeURIComponent("Please sign in to register for this event."));
    }

    const eventId = req.params.id || req.body.eventId;
    const payload = {
      name: req.body.name || `${req.session.user.firstName || ""} ${req.session.user.lastName || ""}`.trim() || "Guest",
      email: req.body.email || req.session.user.email || `${userId}@acc.local`,
      ticketType: req.body.ticketType || "standard",
    };

    const result = await eventsModel.registerForEvent(userId, eventId, payload);
    return res.redirect(`/events/${eventId}?message=${encodeURIComponent(result.message)}`);
  } catch (error) {
    return next(error);
  }
}

async function submitFeedback(req, res, next) {
  try {
    const userId = req.session && req.session.user ? req.session.user.id : null;
    if (!userId) {
      return res.redirect("/login?message=" + encodeURIComponent("Please sign in to submit feedback."));
    }

    const eventId = req.params.id || req.body.eventId;
    const result = await eventsModel.submitEventFeedback(userId, eventId, {
      rating: req.body.rating,
      comments: req.body.comments,
    });

    return res.redirect(`/events/${eventId}?message=${encodeURIComponent(result.message)}`);
  } catch (error) {
    return next(error);
  }
}

async function manageAttendeesPage(req, res, next) {
  try {
    const eventId = req.params.id;
    const event = await eventsModel.getEventById(eventId);

    if (!event) {
      return res.status(404).render("error/404", {
        title: "Event not found",
        user: req.session && req.session.user ? req.session.user : null,
      });
    }

    const attendees = await eventsModel.getAttendees(eventId);
    const currentUserId = req.session && req.session.user ? req.session.user.id : null;

    if (!currentUserId || Number(event.createdBy) !== Number(currentUserId)) {
      return res.redirect(`/events/${eventId}?message=${encodeURIComponent("Only the event organizer can manage attendees.")}`);
    }

    return res.render("events/manage", {
      title: `Manage attendees: ${event.title}`,
      user: req.session && req.session.user ? req.session.user : null,
      event,
      attendees,
      message: req.query.message || "",
      error: "",
    });
  } catch (error) {
    return next(error);
  }
}

async function exportAttendeeCsv(req, res, next) {
  try {
    const userId = req.session && req.session.user ? req.session.user.id : null;
    const eventId = req.params.id;
    const event = await eventsModel.getEventById(eventId);

    if (!event) {
      return res.status(404).render("error/404", {
        title: "Event not found",
        user: req.session && req.session.user ? req.session.user : null,
      });
    }

    if (!userId || Number(event.createdBy) !== Number(userId)) {
      return res.redirect(`/events/${eventId}?message=${encodeURIComponent("You do not have permission to export attendees.")}`);
    }

    const csv = eventsModel.exportAttendeeCsv(eventId);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${event.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-attendees.csv"`);
    return res.send(csv);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  eventsPage,
  createEventPage,
  submitCreateEvent,
  eventDetailPage,
  registerEvent,
  submitFeedback,
  manageAttendeesPage,
  exportAttendeeCsv,
};
