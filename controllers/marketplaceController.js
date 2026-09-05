/* ******************************************
 * marketplaceController.js - Marketplace listing management for ACC Chapter 17.
 *******************************************/
const marketplaceModel = require("../models/marketplaceModel");
const { publicImagePath, removeUploadedImage } = require("../utility/marketplaceUpload");

async function marketplacePage(req, res, next) {
  try {
    const page = Number(req.query.page || 1);
    const filters = {
      keyword: req.query.keyword || "",
      type: req.query.type || "all",
      category: req.query.category || "",
      visibility: "public",
      page,
      limit: 9,
    };

    const result = await marketplaceModel.getMarketplaceListings(filters);

    return res.render("marketplace/index", {
      title: "Marketplace",
      user: req.session && req.session.user ? req.session.user : null,
      listings: result.listings || [],
      total: result.total || 0,
      page: result.page || 1,
      totalPages: result.totalPages || 1,
      keyword: filters.keyword,
      type: filters.type,
      category: filters.category,
      message: req.query.message || "",
      error: "",
    });
  } catch (error) {
    return next(error);
  }
}

async function createListingPage(req, res, next) {
  try {
    return res.render("marketplace/create", {
      title: "Create Listing",
      user: req.session && req.session.user ? req.session.user : null,
      formData: {},
      error: "",
      message: req.query.message || "",
    });
  } catch (error) {
    return next(error);
  }
}

async function submitCreateListing(req, res, next) {
  try {
    const userId = req.session && req.session.user ? req.session.user.id : null;
    if (!userId) {
      return res.redirect("/login?message=" + encodeURIComponent("Please sign in to create a listing."));
    }

    const uploadedImage = publicImagePath(req.file);
    const result = await marketplaceModel.createListing(userId, {
      businessId: Number(req.body.businessId || userId),
      title: req.body.title,
      description: req.body.description,
      category: req.body.category,
      type: req.body.type,
      pricingModel: req.body.pricingModel,
      price: req.body.price,
      minPrice: req.body.minPrice,
      maxPrice: req.body.maxPrice,
      currency: req.body.currency,
      inventory: req.body.inventory,
      availability: req.body.availability,
      visibility: req.body.visibility,
      location: req.body.location,
      media: uploadedImage ? [uploadedImage] : (req.body.media ? [req.body.media] : []),
      tags: String(req.body.tags || "").split(",").map((tag) => tag.trim()).filter(Boolean),
    });

    if (!result.success) {
      removeUploadedImage(req.file);
      return res.render("marketplace/create", {
        title: "Create Listing",
        user: req.session && req.session.user ? req.session.user : null,
        formData: req.body,
        error: result.message,
        message: "",
      });
    }

    return res.redirect("/marketplace/my-listings?message=" + encodeURIComponent(result.message));
  } catch (error) {
    return next(error);
  }
}

async function listingDetailPage(req, res, next) {
  try {
    const listing = await marketplaceModel.getListingById(req.params.id);

    if (!listing) {
      return res.status(404).render("error/404", {
        title: "Listing not found",
        user: req.session && req.session.user ? req.session.user : null,
      });
    }

    return res.render("marketplace/detail", {
      title: listing.title,
      user: req.session && req.session.user ? req.session.user : null,
      listing,
      message: req.query.message || "",
      error: "",
    });
  } catch (error) {
    return next(error);
  }
}

async function myListingsPage(req, res, next) {
  try {
    const userId = req.session && req.session.user ? req.session.user.id : null;
    if (!userId) {
      return res.redirect("/login?message=" + encodeURIComponent("Please sign in to manage your listings."));
    }

    const listings = await marketplaceModel.getBusinessListings(userId);

    return res.render("marketplace/manage", {
      title: "My Listings",
      user: req.session && req.session.user ? req.session.user : null,
      listings: listings || [],
      message: req.query.message || "",
      error: "",
    });
  } catch (error) {
    return next(error);
  }
}

async function editListingPage(req, res, next) {
  try {
    const listing = await marketplaceModel.getListingById(req.params.id);
    if (!listing) {
      return res.status(404).render("error/404", {
        title: "Listing not found",
        user: req.session && req.session.user ? req.session.user : null,
      });
    }

    return res.render("marketplace/edit", {
      title: "Edit Listing",
      user: req.session && req.session.user ? req.session.user : null,
      listing,
      formData: listing,
      error: "",
      message: req.query.message || "",
    });
  } catch (error) {
    return next(error);
  }
}

async function updateListing(req, res, next) {
  try {
    const userId = req.session && req.session.user ? req.session.user.id : null;
    if (!userId) {
      return res.redirect("/login?message=" + encodeURIComponent("Please sign in to update your listing."));
    }

    const uploadedImage = publicImagePath(req.file);
    const result = await marketplaceModel.updateListing(userId, req.params.id, {
      title: req.body.title,
      description: req.body.description,
      category: req.body.category,
      type: req.body.type,
      pricingModel: req.body.pricingModel,
      price: req.body.price,
      minPrice: req.body.minPrice,
      maxPrice: req.body.maxPrice,
      currency: req.body.currency,
      inventory: req.body.inventory,
      availability: req.body.availability,
      visibility: req.body.visibility,
      location: req.body.location,
      tags: String(req.body.tags || "").split(",").map((tag) => tag.trim()).filter(Boolean),
      media: uploadedImage ? [uploadedImage] : undefined,
    });

    if (!result.success) {
      removeUploadedImage(req.file);
      return res.redirect("/marketplace/" + req.params.id + "/edit?message=" + encodeURIComponent(result.message));
    }

    return res.redirect("/marketplace/my-listings?message=" + encodeURIComponent(result.message));
  } catch (error) {
    return next(error);
  }
}

async function deleteListing(req, res, next) {
  try {
    const userId = req.session && req.session.user ? req.session.user.id : null;
    if (!userId) {
      return res.redirect("/login?message=" + encodeURIComponent("Please sign in to delete your listing."));
    }

    const result = await marketplaceModel.deleteListing(userId, req.params.id);
    return res.redirect("/marketplace/my-listings?message=" + encodeURIComponent(result.message));
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  marketplacePage,
  createListingPage,
  submitCreateListing,
  listingDetailPage,
  myListingsPage,
  editListingPage,
  updateListing,
  deleteListing,
};
