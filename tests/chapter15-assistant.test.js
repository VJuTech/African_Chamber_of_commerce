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

    const knowledge = assistantModel.getAssistantMemory();
    assert.ok(knowledge && knowledge.goal, 'assistant memory should include ACC goal');
    assert.ok(/trusted|connect|business|Africa|growth/i.test(knowledge.goal), 'goal should describe ACC purpose');
    assert.ok(knowledge && knowledge.ideal, 'assistant memory should include ACC ideal');
    assert.ok(/trust|growth|network|Africa|opportunity/i.test(knowledge.ideal), 'ideal should describe the desired ACC future');

    const memoryResponse = assistantModel.getAssistantReply('What is the goal and ideal of ACC?', { includeMemory: true });
    assert.ok(typeof memoryResponse === 'object' && memoryResponse.answer, 'assistant should return answer plus memory metadata');
    assert.ok(/goal|ideal|trusted|growth|Africa/i.test(memoryResponse.answer), 'assistant should answer using ACC goal and ideal context');

    console.log('Chapter 15 assistant test: PASS');
    process.exit(0);
  } catch (error) {
    console.error('Chapter 15 assistant test: FAIL');
    console.error(error && error.stack ? error.stack : error);
    process.exit(1);
  }
})();
