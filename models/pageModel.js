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
  };
}

module.exports = {
  getLoginPageContext,
  getRegisterPageContext,
};
