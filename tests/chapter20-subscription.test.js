const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  try {
    // Verify that the Chapter 20 data model exposes every required subscription operation.
    const subscriptionModel = require('../models/subscriptionModel');
    const modelOperations = [
      'getPlans',
      'getDashboard',
      'subscribe',
      'changePlan',
      'cancel',
      'processDueSubscriptions',
    ];

    assert.ok(subscriptionModel, 'subscriptionModel should be exported');
    modelOperations.forEach((operation) => {
      assert.strictEqual(typeof subscriptionModel[operation], 'function', `${operation} should be exported`);
    });

    // Verify that the migration defines the complete Chapter 20 persistence contract.
    const rebuildSql = fs.readFileSync(path.join(__dirname, '..', 'database', 'rebuild.sql'), 'utf8');
    [
      'CREATE TABLE IF NOT EXISTS subscription_plans',
      'CREATE TABLE IF NOT EXISTS subscriptions',
      'CREATE TABLE IF NOT EXISTS subscription_invoices',
      'CREATE TABLE IF NOT EXISTS subscription_payments',
      'CREATE TABLE IF NOT EXISTS subscription_notifications',
      'CREATE TABLE IF NOT EXISTS subscription_audit_logs',
      "VALUES ('Free'",
      "SELECT id, 'basic'",
      "SELECT id, 'premium'",
      "SELECT id, 'enterprise'",
    ].forEach((schemaMarker) => {
      assert.ok(rebuildSql.includes(schemaMarker), `migration should include ${schemaMarker}`);
    });

    // Replace database operations with deterministic fakes to test controller behavior without PostgreSQL.
    const subscriptionController = require('../controllers/subscriptionController');
    const originalSubscribe = subscriptionModel.subscribe;
    const originalChangePlan = subscriptionModel.changePlan;
    const originalCancel = subscriptionModel.cancel;
    const originalProcessDueSubscriptions = subscriptionModel.processDueSubscriptions;

    try {
      subscriptionModel.subscribe = async (userId, planKey, billingCycle, paymentMethod) => ({
        subscription: { user_id: userId, billing_cycle: billingCycle },
        plan: { plan_key: planKey, display_name: 'Premium' },
        paymentMethod,
      });
      subscriptionModel.changePlan = async (userId, planKey) => ({
        subscription: { user_id: userId },
        effective: 'immediate',
        planKey,
      });
      subscriptionModel.cancel = async (userId) => ({ user_id: userId, cancel_at_period_end: true });
      subscriptionModel.processDueSubscriptions = async (paymentSuccessful, maxRetries) => ({ paymentSuccessful, maxRetries });

      // Exercise subscribe, plan change, cancellation, and renewal controller responses.
      const makeResponse = () => ({
        payload: null,
        json(value) {
          this.payload = value;
          return value;
        },
      });
      const request = { session: { user: { id: 42 } }, body: {}, query: {} };

      request.body = { planKey: 'premium', billingCycle: 'yearly', paymentMethod: 'card' };
      const subscribeResponse = makeResponse();
      await subscriptionController.subscribe(request, subscribeResponse, (error) => { throw error; });
      assert.equal(subscribeResponse.payload.success, true);
      assert.match(subscribeResponse.payload.message, /Premium subscription activated/);

      request.body = { planKey: 'enterprise' };
      const changeResponse = makeResponse();
      await subscriptionController.changePlan(request, changeResponse, (error) => { throw error; });
      assert.equal(changeResponse.payload.success, true);
      assert.match(changeResponse.payload.message, /immediate/);

      const cancelResponse = makeResponse();
      await subscriptionController.cancel(request, cancelResponse, (error) => { throw error; });
      assert.equal(cancelResponse.payload.success, true);
      assert.match(cancelResponse.payload.message, /end of the current billing period/);

      request.body = { paymentSuccessful: false, maxRetries: 2 };
      const renewalResponse = makeResponse();
      await subscriptionController.processRenewals(request, renewalResponse, (error) => { throw error; });
      assert.deepEqual(renewalResponse.payload.data, { paymentSuccessful: false, maxRetries: 2 });
    } finally {
      // Restore model functions so this standalone test does not retain mocked behavior.
      subscriptionModel.subscribe = originalSubscribe;
      subscriptionModel.changePlan = originalChangePlan;
      subscriptionModel.cancel = originalCancel;
      subscriptionModel.processDueSubscriptions = originalProcessDueSubscriptions;
    }

    // Verify that the router exposes the dashboard and all lifecycle endpoints.
    const subscriptionRoute = require('../routes/subscriptionRoute');
    const routePaths = subscriptionRoute.stack
      .filter((layer) => layer.route)
      .map((layer) => layer.route.path);
    ['/subscriptions', '/subscriptions/subscribe', '/subscriptions/change-plan', '/subscriptions/cancel', '/subscriptions/process-renewals'].forEach((routePath) => {
      assert.ok(routePaths.includes(routePath), `router should expose ${routePath}`);
    });

    console.log('Chapter 20 subscription and billing test: PASS');
    process.exit(0);
  } catch (error) {
    console.error('Chapter 20 subscription and billing test: FAIL');
    console.error(error && error.stack ? error.stack : error);
    process.exit(1);
  }
})();
