const express = require("express");
const { ensureAuthenticated } = require("../controllers/accountController");
const {
  messagesPage,
  conversationPage,
  initiateConversation,
  sendMessage,
  deleteMessage,
  blockUser,
} = require("../controllers/messagingController");

const router = express.Router();

router.get("/messages", ensureAuthenticated, messagesPage);
router.get("/messages/conversation/:id", ensureAuthenticated, conversationPage);
router.post("/messages/start", ensureAuthenticated, initiateConversation);
router.post("/messages/send", ensureAuthenticated, sendMessage);
router.post("/messages/conversation/:conversationId/delete/:messageId", ensureAuthenticated, deleteMessage);
router.post("/messages/block", ensureAuthenticated, blockUser);

module.exports = router;
