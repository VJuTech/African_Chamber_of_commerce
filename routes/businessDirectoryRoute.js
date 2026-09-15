const express = require("express");
const { ensureAuthenticated, ensureVerifiedAccount } = require("../controllers/accountController");
const {
  directoryPage,
  businessDetailPage,
  connectFromDirectory,
} = require("../controllers/businessDirectoryController");

const router = express.Router();

router.get("/directory", directoryPage);
router.get("/directory/:id", ensureAuthenticated, businessDetailPage);
router.post("/directory/:id/connect", ensureAuthenticated, ensureVerifiedAccount, connectFromDirectory);

module.exports = router;
