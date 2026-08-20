const assert = require('node:assert/strict');

(async () => {
  try {
    const assistantModel = require('../models/accAssistantModel');

    assert.ok(assistantModel, 'accAssistantModel should be exported');
    assert.strictEqual(typeof assistantModel.getAssistantReply, 'function');

    const membershipReply = assistantModel.getAssistantReply('How do I become a member of ACC?');
    assert.ok(/member|membership|join/i.test(membershipReply), 'membership reply should mention ACC membership or joining');

    const networkingReply = assistantModel.getAssistantReply('How do I connect with businesses?');
    assert.ok(/network|business|connect/i.test(networkingReply), 'networking reply should mention networking or business connections');

    const fallbackReply = assistantModel.getAssistantReply('Tell me about your platform');
    assert.ok(/ACC|African Chamber|business/i.test(fallbackReply), 'fallback reply should answer ACC-related questions');

    console.log('Chapter 15 assistant test: PASS');
    process.exit(0);
  } catch (error) {
    console.error('Chapter 15 assistant test: FAIL');
    console.error(error && error.stack ? error.stack : error);
    process.exit(1);
  }
})();
