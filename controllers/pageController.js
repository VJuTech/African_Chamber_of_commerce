const pageModel = require("../models/pageModel");

function loginPage(req, res) {
  res.render("accounts/login", pageModel.getLoginPageContext(req));
}

async function registerPage(req, res) {
  res.render("accounts/register", pageModel.getRegisterPageContext());
}

module.exports = {
  loginPage,
  registerPage,
};
