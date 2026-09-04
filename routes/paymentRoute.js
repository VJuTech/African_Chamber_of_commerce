/* ******************************************
 * paymentRoute.js - ACC Chapter 19 payment processing routes.
 *******************************************/
const express = require("express");
const { ensureAuthenticated, ensureVerifiedAccount } = require("../controllers/accountController");
const {
  paymentDashboardPage,
  paymentHistoryPage,
  initiatePayment,
  processPaymentGateway,
  updatePaymentStatus,
  refundPayment,
  paymentDetailPage,
} = require("../controllers/paymentController");

const router = express.Router();

router.get("/payments", ensureAuthenticated, paymentDashboardPage);
router.get("/payments/history", ensureAuthenticated, paymentHistoryPage);
router.get("/payments/:id", ensureAuthenticated, paymentDetailPage);

router.post("/payments/initiate", ensureAuthenticated, ensureVerifiedAccount, initiatePayment);
router.post("/payments/gateway", ensureAuthenticated, ensureVerifiedAccount, processPaymentGateway);
router.post("/payments/:id/status", ensureAuthenticated, ensureVerifiedAccount, updatePaymentStatus);
router.post("/payments/:id/refund", ensureAuthenticated, ensureVerifiedAccount, refundPayment);

module.exports = router;
