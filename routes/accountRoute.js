const express = require("express");
const {
  registerUser,
  loginUser,
  logoutUser,
  ensureAuthenticated,
  renderForgotPassword,
  submitForgotPassword,
  renderResetPassword,
  submitResetPassword,
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
router.get("/forgot-password", renderForgotPassword);
router.post("/forgot-password", submitForgotPassword);
router.get("/reset-password/:token", renderResetPassword);
router.post("/reset-password", submitResetPassword);
router.get("/logout", logoutUser);

module.exports = router;
