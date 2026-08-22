/* ******************************************
 * orderRoute.js - ACC Chapter 18 order-management routes for checkout, tracking, fulfillment, and dispute management.
 *******************************************/
const express = require("express");
const { ensureAuthenticated } = require("../controllers/accountController");
const {
  orderDashboardPage,
  orderHistoryPage,
  checkoutPage,
  placeOrder,
  orderDetailPage,
  orderTrackingPage,
  confirmOrder,
  updateOrderStatus,
  cancelOrder,
  processRefund,
  raiseDispute,
} = require("../controllers/orderController");

const router = express.Router();

// Buyer-facing order dashboard and history.
router.get("/orders", ensureAuthenticated, orderDashboardPage);
router.get("/orders/history", ensureAuthenticated, orderHistoryPage);
router.get("/orders/checkout/:listingId", ensureAuthenticated, checkoutPage);
router.post("/orders/create", ensureAuthenticated, placeOrder);

// Order detail and tracking views.
router.get("/orders/:id/track", ensureAuthenticated, orderTrackingPage);
router.get("/orders/:id", ensureAuthenticated, orderDetailPage);

// Seller and admin actions.
router.post("/orders/:id/confirm", ensureAuthenticated, confirmOrder);
router.post("/orders/:id/status", ensureAuthenticated, updateOrderStatus);
router.post("/orders/:id/cancel", ensureAuthenticated, cancelOrder);
router.post("/orders/:id/refund", ensureAuthenticated, processRefund);
router.post("/orders/:id/dispute", ensureAuthenticated, raiseDispute);

module.exports = router;
