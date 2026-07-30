const express = require("express");
const {
  loginPage,
  registerPage,
  registerUser,
  loginUser,
  logoutUser,
  dashboardPage,
  ensureAuthenticated,
} = require("../controllers/accountController");

const router = express.Router();

router.get("/", (req, res) => {
  if (req.session && req.session.authenticated) {
    return res.redirect("/dashboard");
  }
  return res.redirect("/login");
});

router.get("/login", loginPage);
router.post("/login", loginUser);
router.get("/register", registerPage);
router.post("/register", registerUser);
router.get("/logout", logoutUser);
router.get("/dashboard", ensureAuthenticated, dashboardPage);

module.exports = router;
