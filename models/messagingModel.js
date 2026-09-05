const fs = require("fs");
const path = require("path");
const notificationModel = require("./notificationModel");

const auditLogPath = path.join(__dirname, "..", "logs", "messaging-audit.log");
const notificationLogPath = path.join(__dirname, "..", "logs", "messaging-notifications.log");
fs.mkdirSync(path.dirname(auditLogPath), { recursive: true });
fs.mkdirSync(path.dirname(notificationLogPath), { recursive: true });

const fallbackConversations = [
  {
    id: 1,
    participantA: 1,
    participantB: 2,
    type: "user_to_user",
    subject: "Trade partnership discussion",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 2,
    participantA: 1,
    participantB: 3,
    type: "user_to_business",
    subject: "Procurement inquiry",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
  },
];

const fallbackMessages = [
  {
    id: 1,
    conversationId: 1,
    senderId: 1,
    receiverId: 2,
    text: "Good afternoon. I would like to explore a trade partnership in the agri-sector.",
    attachments: [],
    type: "text",
    status: "read",
    createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    deletedFor: [],
  },
  {
    id: 2,
    conversationId: 1,
    senderId: 2,
    receiverId: 1,
    text: "Absolutely. Please share your product catalogue and target markets.",
    attachments: [],
    type: "text",
    status: "read",
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    deletedFor: [],
  },
  {
    id: 3,
    conversationId: 2,
    senderId: 3,
    receiverId: 1,
    text: "We need a supplier partner for packaging logistics across East Africa.",
    attachments: [{ name: "procurement-brief.pdf", type: "application/pdf", size: 420000 }],
    type: "attachment",
    status: "delivered",
    createdAt: new Date(Date.now() - 1000 * 60 * 55).toISOString(),
    deletedFor: [],
  },
];

const fallbackBlocks = [];
const fallbackNotifications = [];

function logMessagingAudit(eventType, details = {}) {
  const entry = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    eventType,
    timestamp: new Date().toISOString(),
    details,
  };

  fs.appendFileSync(auditLogPath, `${JSON.stringify(entry)}\n`);
  return entry;
}

function logMessagingNotification(type, payload = {}) {
  const entry = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type,
    timestamp: new Date().toISOString(),
    payload,
  };

  fallbackNotifications.push(entry);
  fs.appendFileSync(notificationLogPath, `${JSON.stringify(entry)}\n`);
  // Forward message events to the shared Chapter 25 notification service.
  notificationModel.generateFromEvent(type, payload);
  return entry;
}

function normalizeMessage(record = {}) {
  return {
    id: record.id,
    conversationId: record.conversationId,
    senderId: record.senderId,
    receiverId: record.receiverId,
    text: record.text || "",
    attachments: Array.isArray(record.attachments) ? record.attachments : [],
    type: record.type || "text",
    status: record.status || "sent",
    createdAt: record.createdAt || new Date().toISOString(),
    deletedFor: Array.isArray(record.deletedFor) ? record.deletedFor : [],
  };
}

function normalizeConversation(record = {}, lastMessage = null) {
  return {
    id: record.id,
    participantA: record.participantA,
    participantB: record.participantB,
    type: record.type || "user_to_user",
    subject: record.subject || "Conversation",
    createdAt: record.createdAt || new Date().toISOString(),
    updatedAt: record.updatedAt || new Date().toISOString(),
    lastMessage: lastMessage ? normalizeMessage(lastMessage) : null,
  };
}

async function createConversation(participantA, participantB, payload = {}) {
  const sourceId = Number(participantA);
  const targetId = Number(participantB);

  if (!sourceId || !targetId || sourceId === targetId) {
    return { success: false, message: "A valid conversation participant pair is required." };
  }

  const isBlocked = fallbackBlocks.some(
    (entry) =>
      (Number(entry.userId) === sourceId && Number(entry.targetId) === targetId) ||
      (Number(entry.userId) === targetId && Number(entry.targetId) === sourceId)
  );

  if (isBlocked) {
    return { success: false, message: "One or both users are blocked from messaging." };
  }

  const existing = fallbackConversations.find(
    (entry) =>
      (Number(entry.participantA) === sourceId && Number(entry.participantB) === targetId) ||
      (Number(entry.participantA) === targetId && Number(entry.participantB) === sourceId)
  );

  if (existing) {
    const conversation = normalizeConversation(existing);
    return { success: true, ...conversation, conversation, message: "Conversation already exists." };
  }

  const record = {
    id: fallbackConversations.length ? Math.max(...fallbackConversations.map((item) => Number(item.id))) + 1 : 1,
    participantA: sourceId,
    participantB: targetId,
    type: payload.type || "user_to_user",
    subject: payload.subject || "New conversation",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  fallbackConversations.push(record);
  logMessagingAudit("conversation_created", { participantA: sourceId, participantB: targetId, type: record.type, outcome: "success" });
  logMessagingNotification("conversation_created", { senderId: sourceId, recipientId: targetId, subject: record.subject });

  const conversation = normalizeConversation(record);
  return { success: true, ...conversation, conversation, message: "Conversation started successfully." };
}

async function getConversations(userId) {
  const currentUserId = Number(userId);

  return fallbackConversations
    .filter(
      (item) => Number(item.participantA) === currentUserId || Number(item.participantB) === currentUserId
    )
    .map((conversation) => {
      const lastMessage = fallbackMessages
        .filter((message) => Number(message.conversationId) === Number(conversation.id))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];

      return normalizeConversation(conversation, lastMessage);
    })
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

async function getConversationById(conversationId, userId) {
  const currentUserId = Number(userId);
  const conversation = fallbackConversations.find(
    (entry) =>
      Number(entry.id) === Number(conversationId) &&
      (Number(entry.participantA) === currentUserId || Number(entry.participantB) === currentUserId)
  );

  if (!conversation) {
    return { success: false, message: "Conversation not found." };
  }

  const messages = fallbackMessages
    .filter((message) => Number(message.conversationId) === Number(conversationId))
    .map(normalizeMessage)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  messages.forEach((message) => {
    if (Number(message.receiverId) === currentUserId && message.status !== "read") {
      message.status = "read";
    }
  });

  return {
    success: true,
    conversation: normalizeConversation(conversation, messages[messages.length - 1] || null),
    messages,
    notificationCount: messages.filter((message) => Number(message.receiverId) === currentUserId && message.status === "read").length,
  };
}

async function sendMessage(senderId, conversationId, payload = {}) {
  const sourceId = Number(senderId);
  const threadId = Number(conversationId);
  const conversation = fallbackConversations.find((entry) => Number(entry.id) === threadId);

  if (!conversation) {
    return { success: false, message: "Conversation not found." };
  }

  if (Number(conversation.participantA) !== sourceId && Number(conversation.participantB) !== sourceId) {
    return { success: false, message: "You do not have permission to send messages in this conversation." };
  }

  const blocked = fallbackBlocks.some(
    (entry) =>
      (Number(entry.userId) === sourceId && Number(entry.targetId) === Number(conversation.participantA === sourceId ? conversation.participantB : conversation.participantA)) ||
      (Number(entry.userId) === Number(conversation.participantA === sourceId ? conversation.participantB : conversation.participantA) && Number(entry.targetId) === sourceId)
  );

  if (blocked) {
    return { success: false, message: "Messaging is blocked between these participants." };
  }

  const text = (payload.text || "").trim();
  const attachments = Array.isArray(payload.attachments) ? payload.attachments : [];
  const messageType = attachments.length > 0 || (payload.type && payload.type !== "text") ? "attachment" : "text";

  if (!text && attachments.length === 0) {
    return { success: false, message: "A message or attachment is required." };
  }

  const receiverId = Number(conversation.participantA) === sourceId ? Number(conversation.participantB) : Number(conversation.participantA);
  const record = {
    id: fallbackMessages.length ? Math.max(...fallbackMessages.map((item) => Number(item.id))) + 1 : 1,
    conversationId: threadId,
    senderId: sourceId,
    receiverId,
    text,
    attachments,
    type: messageType,
    status: "delivered",
    createdAt: new Date().toISOString(),
    deletedFor: [],
  };

  fallbackMessages.push(record);
  conversation.updatedAt = new Date().toISOString();

  logMessagingAudit("message_sent", { conversationId: threadId, senderId: sourceId, receiverId, outcome: "success" });
  logMessagingNotification("new_message", { conversationId: threadId, senderId: sourceId, recipientId: receiverId, text });

  return {
    success: true,
    message: normalizeMessage(record),
    conversation: normalizeConversation(conversation),
    notification: { recipientId: receiverId, type: "new_message" },
  };
}

async function deleteMessage(userId, messageId, mode = "self") {
  const currentUserId = Number(userId);
  const targetMessage = fallbackMessages.find((entry) => Number(entry.id) === Number(messageId));

  if (!targetMessage) {
    return { success: false, message: "Message not found." };
  }

  if (Number(targetMessage.senderId) !== currentUserId && mode === "all") {
    return { success: false, message: "Only the sender can delete for everyone." };
  }

  if (mode === "all") {
    targetMessage.status = "deleted";
    targetMessage.deletedFor = Array.from(new Set([...(targetMessage.deletedFor || []), currentUserId]));
    logMessagingAudit("message_deleted_for_all", { messageId, userId: currentUserId, outcome: "success" });
    return { success: true, message: "Message deleted for all participants." };
  }

  targetMessage.deletedFor = Array.from(new Set([...(targetMessage.deletedFor || []), currentUserId]));
  logMessagingAudit("message_deleted_for_self", { messageId, userId: currentUserId, outcome: "success" });

  return { success: true, message: "Message deleted for you only." };
}

async function blockMessagingUser(userId, targetId, reason = "") {
  const actorId = Number(userId);
  const blockedUserId = Number(targetId);

  if (!actorId || !blockedUserId || actorId === blockedUserId) {
    return { success: false, message: "A valid target user is required." };
  }

  const alreadyBlocked = fallbackBlocks.some(
    (entry) => Number(entry.userId) === actorId && Number(entry.targetId) === blockedUserId
  );

  if (alreadyBlocked) {
    return { success: true, message: "This user is already blocked from messaging." };
  }

  const blockEntry = {
    id: fallbackBlocks.length ? Math.max(...fallbackBlocks.map((item) => Number(item.id))) + 1 : 1,
    userId: actorId,
    targetId: blockedUserId,
    reason,
    createdAt: new Date().toISOString(),
  };

  fallbackBlocks.push(blockEntry);
  logMessagingAudit("message_blocked", { userId: actorId, targetId: blockedUserId, reason, outcome: "success" });

  return { success: true, block: blockEntry, message: "User blocked from messaging." };
}

async function getMessagingAuditLog(limit = 20) {
  try {
    const raw = fs.readFileSync(auditLogPath, "utf8").trim();
    if (!raw) return [];
    const entries = raw
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    return entries.slice(-limit).reverse();
  } catch (error) {
    return [];
  }
}

async function getNotifications(userId) {
  const currentUserId = Number(userId);
  return fallbackNotifications
    .filter((entry) => Number(entry.payload && entry.payload.recipientId) === currentUserId || Number(entry.payload && entry.payload.senderId) === currentUserId)
    .slice(-8)
    .reverse();
}

module.exports = {
  createConversation,
  getConversations,
  getConversationById,
  sendMessage,
  deleteMessage,
  blockMessagingUser,
  getMessagingAuditLog,
  getNotifications,
};
