const express = require("express");
const { ensureAuthenticated } = require("../controllers/accountController");
const {
	profilePage,
	profilePhotoUpload,
	updateProfile,
	updatePassword,
	updatePreferences,
	handleProfilePhotoUpload,
	removeProfilePhoto,
	requestContactChange,
	confirmContactChange,
	terminateSession,
	terminateOtherSessions,
} = require("../controllers/profileController");

const router = express.Router();

router.get("/profile", ensureAuthenticated, profilePage);
router.post("/profile", ensureAuthenticated, updateProfile);
router.post("/profile/photo", ensureAuthenticated, profilePhotoUpload.single("profilePhoto"), handleProfilePhotoUpload);
router.post("/profile/photo/remove", ensureAuthenticated, removeProfilePhoto);
router.post("/profile/password", ensureAuthenticated, updatePassword);
router.post("/profile/preferences", ensureAuthenticated, updatePreferences);
router.post("/profile/contact-change", ensureAuthenticated, requestContactChange);
router.post("/profile/contact-change/verify", ensureAuthenticated, confirmContactChange);
router.post("/profile/sessions/terminate", ensureAuthenticated, terminateSession);
router.post("/profile/sessions/terminate-others", ensureAuthenticated, terminateOtherSessions);

module.exports = router;
