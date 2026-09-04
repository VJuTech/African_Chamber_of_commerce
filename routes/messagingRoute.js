const express = require("express");
const { ensureAuthenticated, ensureVerifiedAccount } = require("../controllers/accountController");
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
router.post("/messages/start", ensureAuthenticated, ensureVerifiedAccount, initiateConversation);
router.post("/messages/send", ensureAuthenticated, ensureVerifiedAccount, sendMessage);
router.post("/messages/conversation/:conversationId/delete/:messageId", ensureAuthenticated, ensureVerifiedAccount, deleteMessage);
router.post("/messages/block", ensureAuthenticated, ensureVerifiedAccount, blockUser);

module.exports = router;
