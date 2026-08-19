const businessDirectoryModel = require("../models/businessDirectoryModel");

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
      message: result.message || "",
      error: "",
    });
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
      message: "",
      error: "",
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  directoryPage,
  businessDetailPage,
};
