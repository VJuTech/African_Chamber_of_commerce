/* ******************************************
 * trustRoute.js - Review and trust system routes for ACC Chapter 16.
 *******************************************/
const express = require("express");
const { ensureAuthenticated, ensureVerifiedAccount } = require("../controllers/accountController");
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
router.post("/trust/review", ensureAuthenticated, ensureVerifiedAccount, submitReview);
router.post("/trust/rate", ensureAuthenticated, ensureVerifiedAccount, submitRating);
router.post("/trust/review/:id/edit", ensureAuthenticated, ensureVerifiedAccount, editReview);
router.post("/trust/review/:id/delete", ensureAuthenticated, ensureVerifiedAccount, deleteReview);
router.post("/trust/review/:id/respond", ensureAuthenticated, ensureVerifiedAccount, respondToReview);
router.post("/trust/review/report", ensureAuthenticated, ensureVerifiedAccount, reportReview);
router.post("/trust/review/moderate", ensureAuthenticated, ensureVerifiedAccount, moderateReview);

module.exports = router;
