const assert = require('node:assert/strict');

(async () => {
  try {
    const messagingModel = require('../models/messagingModel');

    assert.ok(messagingModel, 'messagingModel should be exported');
    assert.strictEqual(typeof messagingModel.createConversation, 'function');
    assert.strictEqual(typeof messagingModel.getConversations, 'function');
    assert.strictEqual(typeof messagingModel.getConversationById, 'function');
    assert.strictEqual(typeof messagingModel.sendMessage, 'function');
    assert.strictEqual(typeof messagingModel.deleteMessage, 'function');
    assert.strictEqual(typeof messagingModel.blockMessagingUser, 'function');
    assert.strictEqual(typeof messagingModel.getMessagingAuditLog, 'function');

    const conversation = await messagingModel.createConversation(1, 2, {
      subject: 'Trade partnership discussion',
      type: 'user_to_user',
    });

    assert.ok(conversation && conversation.id, 'conversation should be created');

    const sentMessage = await messagingModel.sendMessage(1, conversation.id, {
      text: 'Hello, can we schedule a call about a partnership?',
    });

    assert.ok(sentMessage && sentMessage.success, 'message should send successfully');

    const conversationView = await messagingModel.getConversationById(conversation.id, 1);
    assert.ok(Array.isArray(conversationView.messages), 'messages should be returned for the conversation');
    assert.ok(conversationView.messages.length >= 1, 'conversation should contain at least one message');

    const blocked = await messagingModel.blockMessagingUser(1, 2, 'spam');
    assert.ok(blocked && blocked.success, 'user should be blockable');

    console.log('Chapter 14 messaging test: PASS');
    process.exit(0);
  } catch (error) {
    console.error('Chapter 14 messaging test: FAIL');
    console.error(error && error.stack ? error.stack : error);
    process.exit(1);
  }
})();
