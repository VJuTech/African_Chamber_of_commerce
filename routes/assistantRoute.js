const express = require("express");
const { assistantPage, askAssistant } = require("../controllers/assistantController");

const router = express.Router();

router.get("/assistant", assistantPage);
router.post("/assistant", askAssistant);

module.exports = router;
