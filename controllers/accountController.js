const authModel = require("../models/accountModel");
const { sendError } = require("../utility/responseHelper");
const { validateAccountPayload } = require("../utility/account-validation");
const pool = require("../database/connection");
// Render the login page with any status message from the redirect flow.
function loginPage(req, res) {
  res.render("accounts/login", {
    title: "Sign In",
    message: req.query.message || "",
    error: "",
  });
}

async function registerPage(req, res) {
  res.render("accounts/register", {
    title: "Create Account",
    error: "",
    success: "",
  });
}

// Handle account registration and route validation errors.
async function registerUser(req, res, next) {
  try {
    const { name, email, phone, password, password2, role } = req.body;
    const errors = validateAccountPayload({
      name,
      email,
      password,
      password2,
    });

    if (errors.length > 0) {
      return res.render("accounts/register", {
        title: "Create Account",
        error: errors.join(" "),
        success: "",
      });
    }

    const result = await authModel.createUser({
      name,
      email,
      phone,
      password,
      role: role || "member",
    });

    if (!result.success) {
      return res.render("accounts/register", {
        title: "Create Account",
        error: result.message,
        success: "",
      });
    }

    return res.redirect("/login?message=Account created successfully. Please sign in.");
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

function dashboardPage(req, res) {
  res.render("dashboard", {
    title: "Dashboard",
    user: req.session.user,
  });
}

module.exports = {
  loginPage,
  registerPage,
  registerUser,
  loginUser,
  logoutUser,
  ensureAuthenticated,
  dashboardPage,
};
