const express = require("express");
const {
  registerUser,
  loginUser,
  logoutUser,
  ensureAuthenticated,
} = require("../controllers/accountController");

const router = express.Router();

router.get("/", (req, res) => {
  if (req.session && req.session.authenticated) {
    return res.redirect("/dashboard");
  }
  return res.redirect("/login");
});

router.post("/login", loginUser);
router.post("/register", registerUser);
router.get("/logout", logoutUser);

module.exports = router;
