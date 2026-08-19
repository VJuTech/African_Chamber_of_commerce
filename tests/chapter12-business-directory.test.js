const assert = require('node:assert/strict');

(async () => {
  try {
    const directoryModel = require('../models/businessDirectoryModel');
    assert.ok(directoryModel, 'businessDirectoryModel should be exported');
    assert.strictEqual(typeof directoryModel.searchBusinesses, 'function');
    assert.strictEqual(typeof directoryModel.getDirectoryListings, 'function');
    assert.strictEqual(typeof directoryModel.getBusinessDirectoryEntry, 'function');
    assert.strictEqual(typeof directoryModel.logDirectoryActivity, 'function');

    const initialListings = await directoryModel.getDirectoryListings({ page: 1, limit: 10 });
    assert.ok(Array.isArray(initialListings.listings), 'directory results should be an array');
    assert.ok(initialListings.page >= 1, 'directory page should be valid');

    console.log('Chapter 12 business directory test: PASS');
    process.exit(0);
  } catch (error) {
    console.error('Chapter 12 business directory test: FAIL');
    console.error(error && error.stack ? error.stack : error);
    process.exit(1);
  }
})();
