const assert = require('node:assert/strict');

(async () => {
  try {
    const businessModel = require('../models/businessModel');
    assert.ok(businessModel, 'businessModel should be exported');
    assert.strictEqual(typeof businessModel.createBusiness, 'function');
    assert.strictEqual(typeof businessModel.getUserBusinesses, 'function');
    assert.strictEqual(typeof businessModel.submitBusinessForVerification, 'function');
    console.log('Chapter 10 business registration test: PASS');
    process.exit(0);
  } catch (error) {
    console.error('Chapter 10 business registration test: FAIL');
    console.error(error && error.stack ? error.stack : error);
    process.exit(1);
  }
})();
