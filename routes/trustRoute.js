/* ******************************************
 * trustRoute.js - Review and trust system routes for ACC Chapter 16.
 *******************************************/
const express = require("express");
const { ensureAuthenticated } = require("../controllers/accountController");
const {
  trustDashboardPage,
  businessTrustPage,
  submitReview,
  submitRating,
  editReview,
  deleteReview,
  respondToReview,
  reportReview,
  moderateReview,
} = require("../controllers/trustController");

const router = express.Router();

router.get("/trust", trustDashboardPage);
router.get("/trust/business/:id", businessTrustPage);
router.post("/trust/review", ensureAuthenticated, submitReview);
router.post("/trust/rate", ensureAuthenticated, submitRating);
router.post("/trust/review/:id/edit", ensureAuthenticated, editReview);
router.post("/trust/review/:id/delete", ensureAuthenticated, deleteReview);
router.post("/trust/review/:id/respond", ensureAuthenticated, respondToReview);
router.post("/trust/review/report", ensureAuthenticated, reportReview);
router.post("/trust/review/moderate", ensureAuthenticated, moderateReview);

module.exports = router;
