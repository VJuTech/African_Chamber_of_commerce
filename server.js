/* ******************************************
 * server.js - Main application entry point
 * Initializes the Express server, session handling, and routes.
 *******************************************/

const express = require("express");
const expressLayouts = require("express-ejs-layouts");
const session = require("express-session");
const path = require("path");
require("dotenv").config();

// Load the account-related routes and error handlers.
const accountRoutes = require("./routes/accountRoute");
const { notFoundHandler, globalErrorHandler } = require("./middleware/errorHandler");

// Create the Express application instance.
const app = express();
const PORT = process.env.PORT || 3000;

// Configure the view engine and the folder where templates are stored.
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(expressLayouts);
app.set("layout", "layouts/layout");

// Enable parsing of form data and JSON request bodies.
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Serve static files from the public directory.
app.use(express.static(path.join(__dirname, "public")));

// Set up session support for authentication and user state.
app.use(
  session({
    secret: process.env.SESSION_SECRET || "acc-session-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false,
      maxAge: 1000 * 60 * 30,
    },
  })
);

// Register the main application routes.
app.use("/", accountRoutes);

// Handle unmatched routes gracefully.
app.use(notFoundHandler);

// Handle unexpected errors in the application.
app.use(globalErrorHandler);

// Start the server and listen for incoming requests.
app.listen(PORT, () => {
  console.log(`ACC server running on http://localhost:${PORT}`);
});
