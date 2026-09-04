/* ******************************************
 * eventsRoute.js - Routes for ACC events and business engagements.
 *******************************************/
const express = require("express");
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

// Public browsing and detail pages for discoverability.
router.get("/events", eventsPage);
router.get("/events/create", ensureAuthenticated, ensureVerifiedAccount, createEventPage);
router.post("/events/create", ensureAuthenticated, ensureVerifiedAccount, submitCreateEvent);
router.get("/events/manage/:id", ensureAuthenticated, manageAttendeesPage);
router.get("/events/:id/export", ensureAuthenticated, exportAttendeeCsv);
router.get("/events/:id", eventDetailPage);
router.post("/events/:id/register", ensureAuthenticated, ensureVerifiedAccount, registerEvent);
router.post("/events/:id/feedback", ensureAuthenticated, ensureVerifiedAccount, submitFeedback);

module.exports = router;
