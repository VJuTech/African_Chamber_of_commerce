/* ******************************************
 * paymentRoute.js - ACC Chapter 19 payment processing routes.
 *******************************************/
const express = require("express");
const { ensureAuthenticated } = require("../controllers/accountController");
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

router.post("/payments/initiate", ensureAuthenticated, initiatePayment);
router.post("/payments/gateway", ensureAuthenticated, processPaymentGateway);
router.post("/payments/:id/status", ensureAuthenticated, updatePaymentStatus);
router.post("/payments/:id/refund", ensureAuthenticated, refundPayment);

module.exports = router;
