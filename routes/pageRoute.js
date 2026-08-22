const express = require("express");
const { homePage, loginPage, registerPage } = require("../controllers/pageController");

const router = express.Router();

// Render the public landing page while preserving the shared navigation header.
router.get("/", homePage);

router.get("/login", loginPage);
router.get("/register", registerPage);

module.exports = router;
