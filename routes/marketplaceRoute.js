/* ******************************************
 * marketplaceRoute.js - ACC Chapter 17 marketplace browsing and listing management routes.
 *******************************************/
const express = require("express");
const { ensureAuthenticated, ensureVerifiedAccount } = require("../controllers/accountController");
const {
  marketplacePage,
  createListingPage,
  submitCreateListing,
  listingDetailPage,
  myListingsPage,
  editListingPage,
  updateListing,
  deleteListing,
} = require("../controllers/marketplaceController");
const { marketplaceImageUpload } = require("../utility/marketplaceUpload");

// Convert upload failures into the same friendly form experience as validation failures.
function handleMarketplaceImageUpload(req, res, next) {
  marketplaceImageUpload.single("listingImage")(req, res, (error) => {
    if (!error) return next();

    const message = error.code === "LIMIT_FILE_SIZE"
      ? "The product image must be 2MB or smaller."
      : error.code === "LIMIT_UNEXPECTED_FILE"
        ? "Please choose one product image using the listing image field."
        : error.message || "The product image could not be uploaded.";

    const view = req.path === "/create" ? "marketplace/create" : "marketplace/edit";
    const formData = { ...(req.body || {}) };
    if (view === "marketplace/edit") {
      formData.tags = String(formData.tags || "")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
    }
    const templateData = {
      title: view.endsWith("create") ? "Create Listing" : "Edit Listing",
      user: req.session && req.session.user ? req.session.user : null,
      formData,
      listing: req.params.id ? { id: req.params.id, ...req.body } : undefined,
      error: message,
      message: "",
    };

    return res.status(400).render(view, templateData);
  });
}

const router = express.Router();

// Public marketplace browsing and product/service discovery.
router.get("/marketplace", marketplacePage);

// Business ownership and management actions.
router.get("/marketplace/create", ensureAuthenticated, ensureVerifiedAccount, createListingPage);
router.post("/marketplace/create", ensureAuthenticated, ensureVerifiedAccount, handleMarketplaceImageUpload, submitCreateListing);
router.get("/marketplace/my-listings", ensureAuthenticated, myListingsPage);
router.get("/marketplace/:id/edit", ensureAuthenticated, ensureVerifiedAccount, editListingPage);
router.post("/marketplace/:id/edit", ensureAuthenticated, ensureVerifiedAccount, handleMarketplaceImageUpload, updateListing);
router.post("/marketplace/:id/delete", ensureAuthenticated, ensureVerifiedAccount, deleteListing);
router.get("/marketplace/:id", listingDetailPage);

module.exports = router;
