const assert = require('node:assert/strict');

(async () => {
  try {
    const networkingModel = require('../models/businessNetworkingModel');
    assert.ok(networkingModel, 'businessNetworkingModel should be exported');
    assert.strictEqual(typeof networkingModel.sendConnectionRequest, 'function');
    assert.strictEqual(typeof networkingModel.acceptConnectionRequest, 'function');
    assert.strictEqual(typeof networkingModel.rejectConnectionRequest, 'function');
    assert.strictEqual(typeof networkingModel.getConnectionRequests, 'function');
    assert.strictEqual(typeof networkingModel.getConnections, 'function');
    assert.strictEqual(typeof networkingModel.blockConnectionTarget, 'function');
    assert.strictEqual(typeof networkingModel.reportConnectionIssue, 'function');
    assert.strictEqual(typeof networkingModel.getConnectionSuggestions, 'function');
    console.log('Chapter 13 networking test: PASS');
    process.exit(0);
  } catch (error) {
    console.error('Chapter 13 networking test: FAIL');
    console.error(error && error.stack ? error.stack : error);
    process.exit(1);
  }
})();
