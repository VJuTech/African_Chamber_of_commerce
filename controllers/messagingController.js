const messagingModel = require("../models/messagingModel");

async function messagesPage(req, res, next) {
  try {
    const userId = req.session && req.session.user ? req.session.user.id : null;
    if (!userId) return res.redirect("/login?message=Please sign in to view your messages.");

    const conversations = await messagingModel.getConversations(userId);
    const notifications = await messagingModel.getNotifications(userId);

    return res.render("messaging/index", {
      title: "Messages",
      user: req.session && req.session.user ? req.session.user : null,
      conversations,
      notifications,
      message: req.query.message || "",
      error: "",
    });
  } catch (error) {
    return next(error);
  }
}

async function conversationPage(req, res, next) {
  try {
    const userId = req.session && req.session.user ? req.session.user.id : null;
    if (!userId) return res.redirect("/login?message=Please sign in to view messages.");

    const conversationId = req.params.id;
    const result = await messagingModel.getConversationById(conversationId, userId);

    if (!result.success) {
      return res.redirect("/messages?message=" + encodeURIComponent(result.message));
    }

    return res.render("messaging/conversation", {
      title: "Conversation",
      user: req.session && req.session.user ? req.session.user : null,
      conversation: result.conversation,
      messages: result.messages,
      message: req.query.message || "",
      error: "",
    });
  } catch (error) {
    return next(error);
  }
}

async function initiateConversation(req, res, next) {
  try {
    const userId = req.session && req.session.user ? req.session.user.id : null;
    if (!userId) return res.redirect("/login?message=Please sign in to start a conversation.");

    const payload = {
      subject: req.body.subject || "New conversation",
      type: req.body.type || "user_to_user",
    };

    const result = await messagingModel.createConversation(userId, req.body.targetId, payload);
    if (!result.success) {
      return res.redirect("/messages?message=" + encodeURIComponent(result.message));
    }

    return res.redirect("/messages/conversation/" + result.conversation.id + "?message=" + encodeURIComponent(result.message));
  } catch (error) {
    return next(error);
  }
}

async function sendMessage(req, res, next) {
  try {
    const userId = req.session && req.session.user ? req.session.user.id : null;
    if (!userId) return res.redirect("/login?message=Please sign in to send a message.");

    const conversationId = req.body.conversationId || req.params.id;
    const result = await messagingModel.sendMessage(userId, conversationId, {
      text: req.body.text || "",
      attachments: req.body.attachments ? JSON.parse(req.body.attachments) : [],
      type: req.body.type || "text",
    });

    if (!result.success) {
      return res.redirect("/messages/conversation/" + conversationId + "?message=" + encodeURIComponent(result.message));
    }

    return res.redirect("/messages/conversation/" + conversationId + "?message=" + encodeURIComponent("Message sent successfully."));
  } catch (error) {
    return next(error);
  }
}

async function deleteMessage(req, res, next) {
  try {
    const userId = req.session && req.session.user ? req.session.user.id : null;
    if (!userId) return res.redirect("/login?message=Please sign in to manage messages.");

    const conversationId = req.params.conversationId || req.body.conversationId;
    const messageId = req.params.messageId || req.body.messageId;
    const mode = req.body.mode || "self";
    const result = await messagingModel.deleteMessage(userId, messageId, mode);

    if (!result.success) {
      return res.redirect("/messages/conversation/" + conversationId + "?message=" + encodeURIComponent(result.message));
    }

    return res.redirect("/messages/conversation/" + conversationId + "?message=" + encodeURIComponent(result.message));
  } catch (error) {
    return next(error);
  }
}

async function blockUser(req, res, next) {
  try {
    const userId = req.session && req.session.user ? req.session.user.id : null;
    if (!userId) return res.redirect("/login?message=Please sign in to manage privacy settings.");

    const targetId = req.body.targetId || req.params.targetId;
    const result = await messagingModel.blockMessagingUser(userId, targetId, req.body.reason || "Blocked by user request");

    return res.redirect("/messages?message=" + encodeURIComponent(result.message));
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  messagesPage,
  conversationPage,
  initiateConversation,
  sendMessage,
  deleteMessage,
  blockUser,
};
