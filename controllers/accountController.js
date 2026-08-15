const authModel = require("../models/authModel");
const { validateAccountPayload } = require("../utility/account-validation");

// Handle account registration and route validation errors.
async function registerUser(req, res, next) {
  try {
    const {
      firstName,
      lastName,
      middleName,
      email,
      phone,
      country,
      password,
      password2,
      preferredLanguage,
      referralCode,
      organizationName,
      role,
      acceptTerms,
      acceptPrivacy,
      termsAccepted,
      privacyAccepted,
    } = req.body;

    const errors = validateAccountPayload({
      firstName,
      lastName,
      email,
      phone,
      country,
      password,
      password2,
      acceptTerms: acceptTerms ?? termsAccepted,
      acceptPrivacy: acceptPrivacy ?? privacyAccepted,
    });

    if (errors.length > 0) {
      return res.render("accounts/register", {
        title: "Create Account",
        error: errors.join(" "),
        success: "",
        formData: req.body,
      });
    }

    const result = await authModel.createUser({
      firstName,
      lastName,
      middleName,
      email,
      phone,
      country,
      preferredLanguage,
      referralCode,
      organizationName,
      password,
      password2,
      acceptTerms: acceptTerms ?? termsAccepted,
      acceptPrivacy: acceptPrivacy ?? privacyAccepted,
      role: role || "member",
    });

    if (!result.success) {
      return res.render("accounts/register", {
        title: "Create Account",
        error: result.message,
        success: "",
        formData: req.body,
      });
    }

    return res.redirect("/login?message=Registration submitted successfully. Please verify your email or mobile number to activate your account.");
  } catch (error) {
    return next(error);
  }
}

// Authenticate a user and handle login-flow errors.
async function loginUser(req, res, next) {
  try {
    const { identifier, password, rememberMe } = req.body;

    if (!identifier || !password) {
      return res.render("accounts/login", {
        title: "Sign In",
        message: "",
        error: "Email/mobile and password are required.",
      });
    }

    const result = await authModel.authenticateUser(identifier, password);

    if (!result.success) {
      return res.render("accounts/login", {
        title: "Sign In",
        message: "",
        error: result.message,
      });
    }

    req.session.authenticated = true;
    req.session.user = {
      ...result.user,
      id: result.user.id,
      name: result.user.name,
      email: result.user.email,
      role: result.user.role,
      status: result.user.status,
    };

    req.session.cookie.maxAge = rememberMe ? 1000 * 60 * 60 * 24 * 7 : 1000 * 60 * 30;

    return req.session.save(() => {
      res.redirect("/dashboard");
    });
  } catch (error) {
    return next(error);
  }
}

// Log the current user out and surface session cleanup errors.
async function logoutUser(req, res, next) {
  try {
    await authModel.logEvent("logout", {
      userId: req.session.user ? req.session.user.id : null,
      outcome: "success",
    });

    req.session.destroy((err) => {
      if (err) {
        console.error(err);
        return next(err);
      }
      res.redirect("/login?message=You have been logged out.");
    });
  } catch (error) {
    return next(error);
  }
}

function ensureAuthenticated(req, res, next) {
  if (req.session && req.session.authenticated && req.session.user) {
    return next();
  }
  return res.redirect("/login?message=Please sign in to continue.");
}

module.exports = {
  registerUser,
  loginUser,
  logoutUser,
  ensureAuthenticated,
};
