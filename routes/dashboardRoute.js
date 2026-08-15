const express = require("express");
const { dashboardPage } = require("../controllers/dashboardController");
const { ensureAuthenticated } = require("../controllers/accountController");

const router = express.Router();

router.get("/dashboard", ensureAuthenticated, dashboardPage);

module.exports = router;
