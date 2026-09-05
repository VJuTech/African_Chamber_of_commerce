/* ******************************************
 * logisticsRoute.js - ACC Chapter 21 authenticated logistics routes.
 *******************************************/
const express = require("express");
const { ensureAuthenticated, ensureVerifiedAccount } = require("../controllers/accountController");
const { logisticsDashboardPage, shipmentDetailPage, selectDeliveryMethod, createShipment, updateDeliveryStatus, confirmDelivery } = require("../controllers/logisticsController");

// Create the route collection for buyer tracking and seller fulfillment actions.
const router = express.Router();

// Show shipments and eligible orders to the authenticated participant.
router.get("/logistics", ensureAuthenticated, logisticsDashboardPage);
router.get("/logistics/orders/:orderId", ensureAuthenticated, shipmentDetailPage);

// Save a buyer's delivery method during the order fulfillment stage.
router.post("/logistics/orders/:orderId/delivery-method", ensureAuthenticated, ensureVerifiedAccount, selectDeliveryMethod);

// Let the assigned seller create and manage a shipment.
router.post("/logistics/orders/:orderId/shipments", ensureAuthenticated, ensureVerifiedAccount, createShipment);
router.post("/logistics/orders/:orderId/shipments/:shipmentId/status", ensureAuthenticated, ensureVerifiedAccount, updateDeliveryStatus);

// Let the buyer confirm receipt once delivery has completed.
router.post("/logistics/orders/:orderId/shipments/:shipmentId/confirm", ensureAuthenticated, ensureVerifiedAccount, confirmDelivery);

module.exports = router;
