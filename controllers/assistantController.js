const { getAssistantReply } = require("../models/accAssistantModel");

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
    });
  }

  return res.render("assistant", {
    title: "ACC Assistant",
    user: req.session && req.session.user ? req.session.user : null,
    assistantResponse: answer,
    question,
  });
}

module.exports = {
  assistantPage,
  askAssistant,
};
