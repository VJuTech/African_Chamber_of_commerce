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

const router = express.Router();

// Public marketplace browsing and product/service discovery.
router.get("/marketplace", marketplacePage);

// Business ownership and management actions.
router.get("/marketplace/create", ensureAuthenticated, ensureVerifiedAccount, createListingPage);
router.post("/marketplace/create", ensureAuthenticated, ensureVerifiedAccount, submitCreateListing);
router.get("/marketplace/my-listings", ensureAuthenticated, myListingsPage);
router.get("/marketplace/:id/edit", ensureAuthenticated, ensureVerifiedAccount, editListingPage);
router.post("/marketplace/:id/edit", ensureAuthenticated, ensureVerifiedAccount, updateListing);
router.post("/marketplace/:id/delete", ensureAuthenticated, ensureVerifiedAccount, deleteListing);
router.get("/marketplace/:id", listingDetailPage);

module.exports = router;
