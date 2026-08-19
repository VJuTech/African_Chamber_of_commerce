const pageModel = require("../models/pageModel");

// Render the public marketing landing page for new and returning visitors.
function homePage(req, res) {
  res.render("pages/home", {
    title: "African Chamber of Commerce | Business Growth Across Africa",
    user: req.session && req.session.user ? req.session.user : null,
  });
}

// Render the login screen for returning users.
function loginPage(req, res) {
  res.render("accounts/login", pageModel.getLoginPageContext(req));
}

// Render the registration page for new members.
async function registerPage(req, res) {
  res.render("accounts/register", pageModel.getRegisterPageContext());
}

module.exports = {
  homePage,
  loginPage,
  registerPage,
};
