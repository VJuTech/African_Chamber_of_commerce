const express = require("express");
const { ensureAuthenticated } = require("../controllers/accountController");
const { settingsPage, updatePreferences, completeOnboarding } = require("../controllers/uxController");

const router = express.Router();

router.get("/settings", ensureAuthenticated, settingsPage);
router.post("/preferences", ensureAuthenticated, updatePreferences);
router.post("/onboarding/complete", ensureAuthenticated, completeOnboarding);

module.exports = router;
