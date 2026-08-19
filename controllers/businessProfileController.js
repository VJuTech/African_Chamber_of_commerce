const businessProfileModel = require("../models/businessProfileModel");

async function businessProfilePage(req, res, next) {
  try {
    const businessId = req.params.id || req.query.businessId || 1;
    const profile = await businessProfileModel.getBusinessProfile(businessId);

    if (!profile) {
      return res.status(404).render("error/404", {
        title: "Business profile not found",
        user: req.session && req.session.user ? req.session.user : null,
      });
    }

    return res.render("business/profile", {
      title: `${profile.businessName} | Business Profile`,
      user: req.session && req.session.user ? req.session.user : null,
      profile,
      success: req.query.message || "",
      error: "",
    });
  } catch (error) {
    return next(error);
  }
}

async function updateBusinessProfile(req, res, next) {
  try {
    const businessId = req.params.id || req.body.businessId || 1;
    const userId = req.session && req.session.user ? req.session.user.id : null;
    const result = await businessProfileModel.updateBusinessProfile(businessId, userId, req.body);

    if (!result.success) {
      return res.render("business/profile", {
        title: "Update business profile",
        user: req.session && req.session.user ? req.session.user : null,
        profile: await businessProfileModel.getBusinessProfile(businessId),
        success: "",
        error: result.message,
      });
    }

    return res.redirect("/business/profile/" + businessId + "?message=" + encodeURIComponent(result.message));
  } catch (error) {
    return next(error);
  }
}

async function uploadLogo(req, res, next) {
  try {
    const businessId = req.params.id || req.body.businessId || 1;
    const result = await businessProfileModel.uploadBusinessLogo(businessId, req.file);

    if (!result.success) {
      return res.redirect("/business/profile/" + businessId + "?message=" + encodeURIComponent(result.message));
    }

    return res.redirect("/business/profile/" + businessId + "?message=" + encodeURIComponent(result.message));
  } catch (error) {
    return next(error);
  }
}

async function visibilitySettings(req, res, next) {
  try {
    const businessId = req.params.id || req.body.businessId || 1;
    const visibility = req.body.visibility || "public";
    const result = await businessProfileModel.setBusinessVisibility(businessId, visibility);
    return res.redirect("/business/profile/" + businessId + "?message=" + encodeURIComponent(result.message));
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  businessProfilePage,
  updateBusinessProfile,
  uploadLogo,
  visibilitySettings,
};
