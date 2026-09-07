const { africanCountries } = require("../utility/business-options");

function getLoginPageContext(req) {
  return {
    title: "Sign In",
    message: req.query.message || "",
    error: "",
  };
}

function getRegisterPageContext() {
  return {
    title: "Create Account",
    error: "",
    success: "",
    formData: {},
    africanCountries,
  };
}

module.exports = {
  getLoginPageContext,
  getRegisterPageContext,
};
