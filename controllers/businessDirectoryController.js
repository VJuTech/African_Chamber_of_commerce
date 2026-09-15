const businessDirectoryModel = require("../models/businessDirectoryModel");
const businessNetworkingModel = require("../models/businessNetworkingModel");

async function directoryPage(req, res, next) {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 10);
    const keyword = req.query.keyword || "";
    const filters = {
      country: req.query.country || "",
      industry: req.query.industry || "",
      businessType: req.query.businessType || "",
      verificationStatus: req.query.verificationStatus || "",
    };

    const sort = req.query.sort || "relevance";
    const result = await businessDirectoryModel.searchBusinesses(keyword, filters, { page, limit, sort });

    return res.render("business/directory", {
      title: "Business Directory",
      user: req.session && req.session.user ? req.session.user : null,
      listings: result.listings || [],
      total: result.total || 0,
      page: result.page || 1,
      totalPages: result.totalPages || 1,
      keyword,
      filters,
      sort,
      message: req.query.message || result.message || "",
      error: "",
    });
  } catch (error) {
    return next(error);
  }
}

async function connectFromDirectory(req, res, next) {
  try {
    const senderId = req.session && req.session.user ? req.session.user.id : null;
    if (!senderId) {
      return res.redirect(`/login?message=${encodeURIComponent("Please sign in to connect with a verified business.")}`);
    }

    const target = await businessDirectoryModel.getVerifiedBusinessConnectionTarget(req.params.id);
    if (!target || !target.targetId) {
      return res.redirect(`/directory?message=${encodeURIComponent("This verified business is not available for connection requests.")}`);
    }

    const result = await businessNetworkingModel.sendConnectionRequest(senderId, target.targetId, {
      targetType: target.targetType,
      message: String(req.body.message || "").trim(),
    });

    return res.redirect(`/directory/${target.businessId}?message=${encodeURIComponent(result.message)}`);
  } catch (error) {
    return next(error);
  }
}

async function businessDetailPage(req, res, next) {
  try {
    const businessId = req.params.id;
    const listing = await businessDirectoryModel.getBusinessDirectoryEntry(businessId);

    if (!listing) {
      return res.status(404).render("error/404", {
        title: "Business not found",
        user: req.session && req.session.user ? req.session.user : null,
      });
    }

    return res.render("business/detail", {
      title: listing.businessName,
      user: req.session && req.session.user ? req.session.user : null,
      business: listing,
      message: req.query.message || "",
      error: "",
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  directoryPage,
  businessDetailPage,
  connectFromDirectory,
};
