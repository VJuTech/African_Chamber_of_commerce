const assert = require('node:assert/strict');

(async () => {
  try {
    const trustModel = require('../models/trustModel');

    assert.ok(trustModel, 'trustModel should be exported');
    assert.strictEqual(typeof trustModel.submitReview, 'function');
    assert.strictEqual(typeof trustModel.rateBusiness, 'function');
    assert.strictEqual(typeof trustModel.getBusinessReviews, 'function');
    assert.strictEqual(typeof trustModel.getBusinessTrustSummary, 'function');
    assert.strictEqual(typeof trustModel.flagReview, 'function');
    assert.strictEqual(typeof trustModel.moderateReview, 'function');
    assert.strictEqual(typeof trustModel.respondToReview, 'function');
    assert.strictEqual(typeof trustModel.getTrustAuditLog, 'function');

    const review = await trustModel.submitReview(10, 3, {
      rating: 5,
      title: 'Excellent supplier',
      comments: 'The team shipped on time and communication was excellent.',
      categories: { quality: 5, delivery: 5, communication: 4 },
    });

    assert.ok(review && review.success, 'review should be submitted when the user is eligible');
    assert.ok(review.review && review.review.id, 'review record should contain an ID');

    const duplicate = await trustModel.submitReview(10, 3, {
      rating: 5,
      title: 'Duplicate',
      comments: 'Duplicate review attempt.',
    });

    assert.ok(!duplicate.success, 'duplicate review should be rejected');

    const summary = await trustModel.getBusinessTrustSummary(3);
    assert.ok(summary && summary.averageRating >= 1, 'trust summary should include average rating');
    assert.ok(summary.totalReviews >= 1, 'trust summary should count reviews');

    const flagged = await trustModel.flagReview(1, 20, 'Spam or abusive content');
    assert.ok(flagged && flagged.success, 'review abuse should be reportable');

    const moderated = await trustModel.moderateReview(1, 'approve', 99);
    assert.ok(moderated && moderated.success, 'admin moderation should work');

    const responded = await trustModel.respondToReview(1, 3, 'Thank you for the feedback. We value your partnership.', 3);
    assert.ok(responded && responded.success, 'business should be able to respond to review');

    console.log('Chapter 16 trust system test: PASS');
    process.exit(0);
  } catch (error) {
    console.error('Chapter 16 trust system test: FAIL');
    console.error(error && error.stack ? error.stack : error);
    process.exit(1);
  }
})();
