const express = require("express");
const { ensureAuthenticated } = require("../controllers/accountController");
const {
  directoryPage,
  businessDetailPage,
} = require("../controllers/businessDirectoryController");

const router = express.Router();

router.get("/directory", directoryPage);
router.get("/directory/:id", ensureAuthenticated, businessDetailPage);

module.exports = router;
