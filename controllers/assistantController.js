const { getAssistantReply } = require("../models/accAssistantModel");
const supportModel = require("../models/assistantSupportModel");

function assistantPage(req, res) {
  res.render("assistant", {
    title: "ACC Assistant",
    user: req.session && req.session.user ? req.session.user : null,
    assistantResponse: "Hello! Ask me about ACC membership, networking, accounts, or business growth.",
    question: "",
  });
}

function askAssistant(req, res) {
  const question = req.body && req.body.question ? req.body.question : "";
  const answer = getAssistantReply(question);

  const wantsJson = req.xhr || (req.headers.accept || "").includes("application/json") || req.path === "/assistant";

  if (wantsJson) {
    return res.json({
      success: true,
      question,
      answer,
      escalationRequested: /speak to an agent|talk to an agent|customer care|customer support|human agent|live agent|representative/i.test(question),
    });
  }

  return res.render("assistant", {
    title: "ACC Assistant",
    user: req.session && req.session.user ? req.session.user : null,
    assistantResponse: answer,
    question,
  });
}

async function escalateAssistant(req, res, next) {
  try {
    const question = String(req.body && req.body.question || "").trim();
    const assistantResponse = String(req.body && req.body.assistantResponse || "").trim();
    if (!question || question.length > 4000) {
      return res.status(400).json({ success: false, message: "Please provide a question of 4,000 characters or fewer." });
    }
    if (!assistantResponse || assistantResponse.length > 4000) {
      return res.status(400).json({ success: false, message: "The assistant context could not be recorded." });
    }

    const sessionUser = req.session && req.session.user ? req.session.user : null;
    const request = await supportModel.createRequest({
      userId: sessionUser ? sessionUser.id : null,
      name: sessionUser ? sessionUser.name : null,
      email: sessionUser ? sessionUser.email : null,
      question,
      assistantResponse,
    });
    return res.json({ success: true, requestId: String(request.id), message: "Your request has been sent to ACC customer care. An authorized representative will continue from here." });
  } catch (error) { return next(error); }
}

module.exports = {
  assistantPage,
  askAssistant,
  escalateAssistant,
};
