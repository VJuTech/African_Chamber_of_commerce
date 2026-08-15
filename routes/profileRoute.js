const express = require("express");
const { ensureAuthenticated } = require("../controllers/accountController");
const { profilePage, updateProfile, updatePassword, updatePreferences } = require("../controllers/profileController");

const router = express.Router();

router.get("/profile", ensureAuthenticated, profilePage);
router.post("/profile", ensureAuthenticated, updateProfile);
router.post("/profile/password", ensureAuthenticated, updatePassword);
router.post("/profile/preferences", ensureAuthenticated, updatePreferences);

module.exports = router;
