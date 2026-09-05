const assert = require("node:assert/strict");

(async () => {
  try {
    // Load the Chapter 21 state manager and verify its public operations.
    const logisticsModel = require("../models/logisticsModel");
    assert.equal(typeof logisticsModel.selectDeliveryMethod, "function");
    assert.equal(typeof logisticsModel.createShipment, "function");
    assert.equal(typeof logisticsModel.updateDeliveryStatus, "function");
    assert.equal(typeof logisticsModel.confirmDelivery, "function");

    // Create an order through the existing Chapter 18 workflow.
    const orderModel = require("../models/orderModel");
    const createdOrder = await orderModel.createOrder(10, { sellerId: 2, listingId: 21, listingTitle: "Export goods", quantity: 1, unitPrice: 75, shippingAddress: "Accra, Ghana", deliveryMethod: "standard" });
    assert.ok(createdOrder.success);
    const orderId = createdOrder.order.id;

    // Verify that buyer delivery selection is persisted on the order.
    const selected = await logisticsModel.selectDeliveryMethod(10, orderId, "express");
    assert.ok(selected.success);
    assert.equal((await orderModel.getOrderById(orderId)).deliveryMethod, "express");

    // Verify shipment creation, unique identifiers, and provider assignment.
    const shipmentResult = await logisticsModel.createShipment(2, orderId, { deliveryMethod: "express", carrier: "DHL", estimatedDeliveryDate: "2026-09-10" });
    assert.ok(shipmentResult.success);
    assert.match(shipmentResult.shipment.id, /^SHP-/);
    assert.match(shipmentResult.shipment.trackingNumber, /^TRK-/);
    assert.equal(shipmentResult.shipment.carrier, "DHL");

    // Verify the operational status flow through delivery confirmation.
    const shipmentId = shipmentResult.shipment.id;
    assert.ok((await logisticsModel.updateDeliveryStatus(2, shipmentId, "dispatched", "Collected by carrier")).success);
    assert.ok((await logisticsModel.updateDeliveryStatus(2, shipmentId, "in_transit", "Cross-border transit")).success);
    assert.ok((await logisticsModel.updateDeliveryStatus(2, shipmentId, "out_for_delivery", "Courier route started")).success);
    assert.ok((await logisticsModel.updateDeliveryStatus(2, shipmentId, "delivered", "Received at destination")).success);
    assert.ok((await logisticsModel.confirmDelivery(10, shipmentId)).success);

    // Verify the required notification and audit trails were recorded.
    const audit = await logisticsModel.getAuditLog();
    const notifications = await logisticsModel.getNotificationLog();
    assert.ok(audit.some((entry) => entry.eventType === "shipment_created"));
    assert.ok(audit.some((entry) => entry.eventType === "delivery_completed"));
    assert.ok(notifications.some((entry) => entry.type === "delivered"));
    assert.ok(notifications.some((entry) => entry.type === "delivery_confirmed"));

    console.log("Chapter 21 logistics management test: PASS");
  } catch (error) {
    console.error("Chapter 21 logistics management test: FAIL");
    console.error(error && error.stack ? error.stack : error);
    process.exit(1);
  }
})();
