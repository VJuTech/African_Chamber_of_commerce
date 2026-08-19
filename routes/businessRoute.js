const express = require("express");
const { ensureAuthenticated } = require("../controllers/accountController");
const {
  registerBusinessPage,
  createBusinessAccount,
  saveBusinessDraft,
  myBusinessesPage,
  verifyBusiness,
} = require("../controllers/businessController");

const router = express.Router();

// ACC-FRS-BIZ-001: Initiate Business Registration
router.get("/business/register", ensureAuthenticated, registerBusinessPage);
router.post("/business/register", ensureAuthenticated, createBusinessAccount);

// ACC-FRS-BIZ-008: Save Draft Business Registration
router.post("/business/draft", ensureAuthenticated, saveBusinessDraft);

// ACC-FRS-BIZ-007: Submit Business for Verification
router.post("/business/:id/verify", ensureAuthenticated, verifyBusiness);

// Shared business account dashboard
router.get("/business/my-businesses", ensureAuthenticated, myBusinessesPage);

module.exports = router;
