const express = require("express");
const { loginPage, registerPage } = require("../controllers/pageController");

const router = express.Router();

router.get("/login", loginPage);
router.get("/register", registerPage);

module.exports = router;
