const assert = require('node:assert/strict');

(async () => {
  try {
    const paymentModel = require('../models/paymentModel');

    assert.ok(paymentModel, 'paymentModel should be exported');
    assert.strictEqual(typeof paymentModel.initiatePayment, 'function');
    assert.strictEqual(typeof paymentModel.processGatewayPayment, 'function');
    assert.strictEqual(typeof paymentModel.updatePaymentStatus, 'function');
    assert.strictEqual(typeof paymentModel.linkPaymentToOrder, 'function');
    assert.strictEqual(typeof paymentModel.refundPayment, 'function');
    assert.strictEqual(typeof paymentModel.getUserPayments, 'function');
    assert.strictEqual(typeof paymentModel.getPaymentById, 'function');
    assert.strictEqual(typeof paymentModel.getPaymentAuditLog, 'function');

    const created = await paymentModel.initiatePayment(10, {
      orderId: 1,
      amount: 24.5,
      currency: 'USD',
      paymentMethod: 'card',
      provider: 'paystack',
      paymentReference: 'ACC-REF-001',
      orderNumber: 'ORD-1001',
    });

    assert.ok(created && created.success, 'payment should be initiated successfully');
    assert.ok(created.payment && created.payment.id, 'payment should include an id');
    assert.strictEqual(created.payment.status, 'initiated');

    const processed = await paymentModel.processGatewayPayment('paystack', created.payment.id, { status: 'success', gatewayReference: 'PS-90001' });
    assert.ok(processed && processed.success, 'payment should be processed by gateway');
    assert.strictEqual(processed.payment.status, 'successful');

    const linked = await paymentModel.linkPaymentToOrder(created.payment.id, 1);
    assert.ok(linked && linked.success, 'payment should attach to order');

    const failed = await paymentModel.updatePaymentStatus(created.payment.id, 'failed', { reason: 'Insufficient funds' });
    assert.ok(failed && failed.success, 'payment failure status should update');
    assert.strictEqual(failed.payment.status, 'failed');

    const refund = await paymentModel.refundPayment(10, created.payment.id, 'Order cancelled by buyer');
    assert.ok(refund && refund.success, 'refund should be processed successfully');
    assert.strictEqual(refund.payment.refundStatus, 'refunded');

    const history = await paymentModel.getUserPayments(10);
    assert.ok(Array.isArray(history), 'payment history should be an array');

    const audit = await paymentModel.getPaymentAuditLog();
    assert.ok(Array.isArray(audit), 'payment audit log should be available');

    console.log('Chapter 19 payment processing test: PASS');
    process.exit(0);
  } catch (error) {
    console.error('Chapter 19 payment processing test: FAIL');
    console.error(error && error.stack ? error.stack : error);
    process.exit(1);
  }
})();
