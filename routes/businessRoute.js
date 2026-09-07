const express = require("express");
const { ensureAuthenticated, ensureVerifiedAccount } = require("../controllers/accountController");
const {
  registerBusinessPage,
  createBusinessAccount,
  saveBusinessDraft,
  myBusinessesPage,
  verifyBusiness,
} = require("../controllers/businessController");
const { businessLogoUpload } = require("../utility/businessUpload");

const router = express.Router();

function handleBusinessLogoUpload(req, res, next) {
  businessLogoUpload.single("logo")(req, res, (error) => {
    if (!error) return next();

    const message = error.code === "LIMIT_FILE_SIZE"
      ? "The business logo must be 2MB or smaller."
      : error.message || "The business logo could not be uploaded.";

    return res.status(400).render("business/register", {
      title: "Register Business",
      user: req.session && req.session.user ? req.session.user : null,
      formData: req.body || {},
      error: message,
      success: "",
      africanCountries: require("../utility/business-options").africanCountries,
      industryCategories: require("../utility/business-options").industryCategories,
    });
  });
}

// ACC-FRS-BIZ-001: Initiate Business Registration
router.get("/business/register", ensureAuthenticated, ensureVerifiedAccount, registerBusinessPage);
router.post("/business/register", ensureAuthenticated, ensureVerifiedAccount, handleBusinessLogoUpload, createBusinessAccount);

// ACC-FRS-BIZ-008: Save Draft Business Registration
router.post("/business/draft", ensureAuthenticated, ensureVerifiedAccount, saveBusinessDraft);

// ACC-FRS-BIZ-007: Submit Business for Verification
router.post("/business/:id/verify", ensureAuthenticated, ensureVerifiedAccount, verifyBusiness);

// Shared business account dashboard
router.get("/business/my-businesses", ensureAuthenticated, myBusinessesPage);

module.exports = router;
