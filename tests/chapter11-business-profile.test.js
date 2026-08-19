const assert = require('node:assert/strict');

(async () => {
  try {
    const profileModel = require('../models/businessProfileModel');
    assert.ok(profileModel, 'businessProfileModel should be exported');
    assert.strictEqual(typeof profileModel.getBusinessProfile, 'function');
    assert.strictEqual(typeof profileModel.updateBusinessProfile, 'function');
    assert.strictEqual(typeof profileModel.uploadBusinessLogo, 'function');
    assert.strictEqual(typeof profileModel.setBusinessVisibility, 'function');
    assert.strictEqual(typeof profileModel.getBusinessProfileAuditLogs, 'function');
    console.log('Chapter 11 business profile test: PASS');
    process.exit(0);
  } catch (error) {
    console.error('Chapter 11 business profile test: FAIL');
    console.error(error && error.stack ? error.stack : error);
    process.exit(1);
  }
})();
