const businessModel = require("../models/businessModel");

// This controller handles the chapter-10 registration journey: start, draft-save,
// submission, and status management for each business account.
async function registerBusinessPage(req, res) {
  res.render("business/register", {
    title: "Register Business",
    user: req.session && req.session.user ? req.session.user : null,
    formData: {},
    error: "",
    success: "",
  });
}

async function createBusinessAccount(req, res, next) {
  try {
    const userId = req.session && req.session.user ? req.session.user.id : null;
    if (!userId) {
      return res.redirect("/login?message=Please sign in to create a business account.");
    }

    const result = await businessModel.createBusiness(userId, req.body);

    if (!result.success) {
      return res.render("business/register", {
        title: "Register Business",
        user: req.session && req.session.user ? req.session.user : null,
        formData: req.body,
        error: result.message,
        success: "",
      });
    }

    return res.redirect("/business/my-businesses?message=" + encodeURIComponent(result.message));
  } catch (error) {
    return next(error);
  }
}

async function saveBusinessDraft(req, res, next) {
  try {
    const userId = req.session && req.session.user ? req.session.user.id : null;
    if (!userId) {
      return res.redirect("/login?message=Please sign in to save a business draft.");
    }

    const result = await businessModel.saveBusinessDraft(userId, req.body);

    if (!result.success) {
      return res.render("business/register", {
        title: "Register Business",
        user: req.session && req.session.user ? req.session.user : null,
        formData: req.body,
        error: result.message,
        success: "",
      });
    }

    return res.redirect("/business/my-businesses?message=" + encodeURIComponent(result.message));
  } catch (error) {
    return next(error);
  }
}

async function myBusinessesPage(req, res, next) {
  try {
    const userId = req.session && req.session.user ? req.session.user.id : null;
    if (!userId) {
      return res.redirect("/login?message=Please sign in to view your businesses.");
    }

    const businesses = await businessModel.getUserBusinesses(userId);
    res.render("business/my-businesses", {
      title: "My Businesses",
      user: req.session && req.session.user ? req.session.user : null,
      businesses,
      message: req.query.message || "",
      error: "",
    });
  } catch (error) {
    return next(error);
  }
}

async function verifyBusiness(req, res, next) {
  try {
    const userId = req.session && req.session.user ? req.session.user.id : null;
    if (!userId) {
      return res.redirect("/login?message=Please sign in to verify your business.");
    }

    const businessId = req.params.id;
    const result = await businessModel.submitBusinessForVerification(userId, businessId);

    if (!result.success) {
      return res.redirect("/business/my-businesses?message=" + encodeURIComponent(result.message));
    }

    return res.redirect("/business/my-businesses?message=" + encodeURIComponent(result.message));
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  registerBusinessPage,
  createBusinessAccount,
  saveBusinessDraft,
  myBusinessesPage,
  verifyBusiness,
};
