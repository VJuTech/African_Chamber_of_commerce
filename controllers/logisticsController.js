/* ******************************************
 * logisticsController.js - ACC Chapter 21 request handlers for shipment operations.
 *******************************************/
const logisticsModel = require("../models/logisticsModel");
const orderModel = require("../models/orderModel");

// Resolve the authenticated account id used by all logistics actions.
function currentUserId(req) {
  return req.session && req.session.user ? req.session.user.id : null;
}

// Render the buyer and seller shipment dashboard.
async function logisticsDashboardPage(req, res, next) {
  try {
    const userId = currentUserId(req);
    const shipments = await logisticsModel.getShipmentsForUser(userId);
    const orders = await orderModel.getOrderHistory(userId);
    return res.render("logistics/dashboard", { title: "Logistics & Delivery", user: req.session.user, shipments, orders, deliveryMethods: logisticsModel.deliveryMethods, providers: logisticsModel.logisticsProviders, message: req.query.message || "", error: "" });
  } catch (error) { return next(error); }
}

// Render the shipment detail and tracking page for an order participant.
async function shipmentDetailPage(req, res, next) {
  try {
    const userId = currentUserId(req);
    const order = await orderModel.getOrderById(req.params.orderId);
    if (!order || (Number(order.buyerId) !== Number(userId) && Number(order.sellerId) !== Number(userId))) return res.status(404).render("error/404", { title: "Shipment not found", user: req.session.user });
    const shipment = await logisticsModel.getShipmentByOrderId(order.id);
    return res.render("logistics/detail", { title: `Shipment for Order #${order.id}`, user: req.session.user, order, shipment, deliveryStatuses: logisticsModel.deliveryStatuses, providers: logisticsModel.logisticsProviders, message: req.query.message || "", error: "" });
  } catch (error) { return next(error); }
}

// Save the buyer's delivery selection against the existing order workflow.
async function selectDeliveryMethod(req, res, next) {
  try { const result = await logisticsModel.selectDeliveryMethod(currentUserId(req), req.params.orderId, req.body.deliveryMethod); return res.redirect(`/logistics/orders/${req.params.orderId}?message=${encodeURIComponent(result.message)}`); } catch (error) { return next(error); }
}

// Create a seller shipment with a generated shipment and tracking identifier.
async function createShipment(req, res, next) {
  try { const result = await logisticsModel.createShipment(currentUserId(req), req.params.orderId, req.body); return res.redirect(`/logistics/orders/${req.params.orderId}?message=${encodeURIComponent(result.message)}`); } catch (error) { return next(error); }
}

// Update a delivery status and retain any carrier-provided tracking note.
async function updateDeliveryStatus(req, res, next) {
  try { const result = await logisticsModel.updateDeliveryStatus(currentUserId(req), req.params.shipmentId, req.body.status, req.body.details); return res.redirect(`/logistics/orders/${req.params.orderId}?message=${encodeURIComponent(result.message)}`); } catch (error) { return next(error); }
}

// Record optional buyer confirmation after delivery completion.
async function confirmDelivery(req, res, next) {
  try { const result = await logisticsModel.confirmDelivery(currentUserId(req), req.params.shipmentId); return res.redirect(`/logistics/orders/${req.params.orderId}?message=${encodeURIComponent(result.message)}`); } catch (error) { return next(error); }
}

module.exports = { logisticsDashboardPage, shipmentDetailPage, selectDeliveryMethod, createShipment, updateDeliveryStatus, confirmDelivery };
