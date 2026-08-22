/* ******************************************
 * marketplaceRoute.js - ACC Chapter 17 marketplace browsing and listing management routes.
 *******************************************/
const express = require("express");
const { ensureAuthenticated } = require("../controllers/accountController");
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

const router = express.Router();

// Public marketplace browsing and product/service discovery.
router.get("/marketplace", marketplacePage);

// Business ownership and management actions.
router.get("/marketplace/create", ensureAuthenticated, createListingPage);
router.post("/marketplace/create", ensureAuthenticated, submitCreateListing);
router.get("/marketplace/my-listings", ensureAuthenticated, myListingsPage);
router.get("/marketplace/:id/edit", ensureAuthenticated, editListingPage);
router.post("/marketplace/:id/edit", ensureAuthenticated, updateListing);
router.post("/marketplace/:id/delete", ensureAuthenticated, deleteListing);
router.get("/marketplace/:id", listingDetailPage);

module.exports = router;
