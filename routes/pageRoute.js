const express = require("express");
const path = require("path");
const { homePage, loginPage, registerPage } = require("../controllers/pageController");

const router = express.Router();

// Render the polished static landing page as the first page users see.
router.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "views", "index.html"));
});

router.get("/login", loginPage);
router.get("/register", registerPage);

module.exports = router;
