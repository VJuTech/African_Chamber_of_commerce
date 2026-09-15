const express = require("express");
const { ensureAuthenticated } = require("../controllers/accountController");
const localizationController = require("../controllers/localizationController");

const router = express.Router();

router.get("/settings/localization", ensureAuthenticated, localizationController.settingsPage);
router.post("/settings/localization", ensureAuthenticated, localizationController.updatePreferences);

module.exports = router;
