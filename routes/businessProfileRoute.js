const express = require("express");
const multer = require("multer");
const { ensureAuthenticated } = require("../controllers/accountController");
const {
  businessProfilePage,
  updateBusinessProfile,
  uploadLogo,
  visibilitySettings,
} = require("../controllers/businessProfileController");

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 2 * 1024 * 1024 } });

router.get("/business/profile/:id", ensureAuthenticated, businessProfilePage);
router.post("/business/profile/:id", ensureAuthenticated, updateBusinessProfile);
router.post("/business/profile/:id/logo", ensureAuthenticated, upload.single("logo"), uploadLogo);
router.post("/business/profile/:id/visibility", ensureAuthenticated, visibilitySettings);

module.exports = router;
