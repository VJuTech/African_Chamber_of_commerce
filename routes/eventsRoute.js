/* ******************************************
 * eventsRoute.js - Routes for ACC events and business engagements.
 *******************************************/
const express = require("express");
const { eventFlyerUpload } = require("../utility/eventUpload");
const { ensureAuthenticated, ensureVerifiedAccount } = require("../controllers/accountController");
const {
  eventsPage,
  createEventPage,
  submitCreateEvent,
  eventDetailPage,
  registerEvent,
  submitFeedback,
  manageAttendeesPage,
  exportAttendeeCsv,
} = require("../controllers/eventsController");

const router = express.Router();

function handleEventFlyerUpload(req, res, next) {
  eventFlyerUpload.single("eventFlyer")(req, res, (error) => {
    if (!error) return next();

    const message = error.code === "LIMIT_FILE_SIZE"
      ? "The event flyer must be 5MB or smaller."
      : error.message || "The event flyer could not be uploaded.";

    return res.status(400).render("events/create", {
      title: "Create Event",
      user: req.session && req.session.user ? req.session.user : null,
      message: "",
      error: message,
      formData: req.body || {},
    });
  });
}

// Public browsing and detail pages for discoverability.
router.get("/events", eventsPage);
router.get("/events/create", ensureAuthenticated, ensureVerifiedAccount, createEventPage);
router.post("/events/create", ensureAuthenticated, ensureVerifiedAccount, handleEventFlyerUpload, submitCreateEvent);
router.get("/events/manage/:id", ensureAuthenticated, manageAttendeesPage);
router.get("/events/:id/export", ensureAuthenticated, exportAttendeeCsv);
router.get("/events/:id", eventDetailPage);
router.post("/events/:id/register", ensureAuthenticated, ensureVerifiedAccount, registerEvent);
router.post("/events/:id/feedback", ensureAuthenticated, ensureVerifiedAccount, submitFeedback);

module.exports = router;
