const assert = require('node:assert/strict');
const { createTestUser, createTestBusiness, removeTestUsers } = require('./test-fixtures');
const pool = require('../database/connection');

(async () => {
  const userIds = [];
  try {
    const marketplaceModel = require('../models/marketplaceModel');
    const userId = await createTestUser('Marketplace');
    userIds.push(userId);
    const businessId = await createTestBusiness(userId);

    assert.ok(marketplaceModel, 'marketplaceModel should be exported');
    assert.strictEqual(typeof marketplaceModel.createListing, 'function');
    assert.strictEqual(typeof marketplaceModel.updateListing, 'function');
    assert.strictEqual(typeof marketplaceModel.deleteListing, 'function');
    assert.strictEqual(typeof marketplaceModel.getMarketplaceListings, 'function');
    assert.strictEqual(typeof marketplaceModel.getListingById, 'function');
    assert.strictEqual(typeof marketplaceModel.getBusinessListings, 'function');
    assert.strictEqual(typeof marketplaceModel.validateMediaUpload, 'function');

    const created = await marketplaceModel.createListing(userId, {
      businessId,
      title: 'Organic Coffee Beans',
      description: 'Premium roasted coffee for wholesalers and cafés in East Africa.',
      category: 'Agriculture',
      type: 'product',
      pricingModel: 'fixed',
      price: 24.5,
      currency: 'USD',
      inventory: 120,
      visibility: 'public',
      location: 'Nairobi, Kenya',
      media: ['coffee-hero.png'],
      tags: ['coffee', 'organic'],
    });

    assert.ok(created && created.success, 'listing should be created successfully');
    assert.ok(created.listing && created.listing.id, 'listing should include an id');
    assert.strictEqual(created.listing.type, 'product');

    const updated = await marketplaceModel.updateListing(userId, created.listing.id, {
      visibility: 'draft',
      pricingModel: 'range',
      price: 22,
      maxPrice: 30,
    });

    assert.ok(updated && updated.success, 'listing should be updateable');
    assert.strictEqual(updated.listing.visibility, 'draft');

    const listings = await marketplaceModel.getMarketplaceListings({ keyword: 'coffee', visibility: 'all' });
    assert.ok(listings && Array.isArray(listings.listings), 'marketplace listings should be returned');
    assert.ok(listings.listings.length >= 1, 'search should find at least one listing');

    const detail = await marketplaceModel.getListingById(created.listing.id);
    assert.ok(detail && detail.id === created.listing.id, 'detail lookup should return the listing');

    const removed = await marketplaceModel.deleteListing(userId, created.listing.id);
    assert.ok(removed && removed.success, 'listing should be deletable');

    console.log('Chapter 17 marketplace test: PASS');
  } catch (error) {
    console.error('Chapter 17 marketplace test: FAIL');
    console.error(error && error.stack ? error.stack : error);
    process.exitCode = 1;
  } finally {
    await removeTestUsers(userIds);
    await pool.end();
  }
})();
