const express = require("express");
const { assistantPage, askAssistant, escalateAssistant } = require("../controllers/assistantController");

const router = express.Router();

router.get("/assistant", assistantPage);
router.post("/assistant", askAssistant);
router.post("/assistant/escalate", escalateAssistant);

module.exports = router;
