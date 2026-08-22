const assert = require('node:assert/strict');

(async () => {
  try {
    const orderModel = require('../models/orderModel');

    assert.ok(orderModel, 'orderModel should be exported');
    assert.strictEqual(typeof orderModel.createOrder, 'function');
    assert.strictEqual(typeof orderModel.confirmOrder, 'function');
    assert.strictEqual(typeof orderModel.updateOrderStatus, 'function');
    assert.strictEqual(typeof orderModel.cancelOrder, 'function');
    assert.strictEqual(typeof orderModel.processRefund, 'function');
    assert.strictEqual(typeof orderModel.getOrderHistory, 'function');
    assert.strictEqual(typeof orderModel.raiseDispute, 'function');
    assert.strictEqual(typeof orderModel.getOrderAuditLog, 'function');

    const created = await orderModel.createOrder(10, {
      sellerId: 2,
      listingId: 3,
      listingTitle: 'Export Readiness Clinic',
      quantity: 2,
      unitPrice: 120,
      currency: 'USD',
      shippingAddress: '12 Brook Road, Nairobi',
      deliveryMethod: 'Courier',
      paymentMethod: 'Card',
      notes: 'Need priority handling',
    });

    assert.ok(created && created.success, 'order should be created successfully');
    assert.ok(created.order && created.order.id, 'order should include an id');
    assert.strictEqual(created.order.status, 'pending');

    const confirmed = await orderModel.confirmOrder(2, created.order.id);
    assert.ok(confirmed && confirmed.success, 'seller should be able to confirm order');
    assert.strictEqual(confirmed.order.status, 'confirmed');

    const updated = await orderModel.updateOrderStatus(2, created.order.id, 'shipped', 'Express cargo route');
    assert.ok(updated && updated.success, 'seller or system should be able to update status');
    assert.strictEqual(updated.order.status, 'shipped');

    const cancelled = await orderModel.cancelOrder(10, created.order.id, 'Changed plans');
    assert.ok(cancelled && cancelled.success, 'order can be cancelled when valid');

    const failedCancel = await orderModel.cancelOrder(10, created.order.id, 'Again');
    assert.ok(!failedCancel.success, 'cancelled order should reject a second cancellation');

    const refunded = await orderModel.processRefund(1, created.order.id, 'Order cancelled by buyer');
    assert.ok(refunded && refunded.success, 'refund should be processed for cancelled order');

    const history = await orderModel.getOrderHistory(10);
    assert.ok(Array.isArray(history), 'order history should be an array');

    const dispute = await orderModel.raiseDispute(10, created.order.id, 'Package arrived damaged');
    assert.ok(dispute && dispute.success, 'dispute should be raised successfully');

    const audit = await orderModel.getOrderAuditLog();
    assert.ok(Array.isArray(audit), 'audit log should be available');

    console.log('Chapter 18 order management test: PASS');
    process.exit(0);
  } catch (error) {
    console.error('Chapter 18 order management test: FAIL');
    console.error(error && error.stack ? error.stack : error);
    process.exit(1);
  }
})();
