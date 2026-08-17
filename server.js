/* ******************************************
 * server.js - Main application entry point
 * Initializes the Express server, session handling, and routes.
 *******************************************/

const express = require("express");
const expressLayouts = require("express-ejs-layouts");
const session = require("express-session");
const PgSession = require("connect-pg-simple")(session);
const path = require("path");
const pool = require("./database/connection");
require("dotenv").config();

// Load route modules and error handlers.
const accountRoutes = require("./routes/accountRoute");
const pageRoutes = require("./routes/pageRoute");
const dashboardRoutes = require("./routes/dashboardRoute");
const profileRoutes = require("./routes/profileRoute");
const membershipRoutes = require("./routes/membershipRoute");
const { notFoundHandler, globalErrorHandler } = require("./middleware/errorHandler");

// Create the Express application instance.
const app = express();
const PORT = process.env.PORT || 5500;

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
// We'll initialize the session store after testing DB connectivity to avoid
// connect-pg-simple pruning attempts against an unstable DB which can cause ECONNRESET.
async function createSessionStore() {
  if (!process.env.DATABASE_URL) return undefined;

  // Reuse the shared pool configured in database/connection.js.
  try {
    const client = await pool.connect();
    try {
      await client.query("SELECT 1");
    } finally {
      client.release();
    }
    return new PgSession({ pool, tableName: "session", pruneSessionInterval: 0 });
  } catch (err) {
    console.error("Postgres unreachable for session store, falling back to memory store:", err && err.message ? err.message : err);
    return undefined;
  }
}

async function initApp() {
  const store = await createSessionStore();

  // Set up session support for authentication and user state.
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "acc-session-secret",
      store: store,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 1000 * 60 * 30,
      },
    })
  );

  // If running behind a proxy (e.g., in production with a load balancer), enable trust proxy
  if (process.env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
  }

  // Register the main application routes.
  app.use("/", pageRoutes);
  app.use("/", accountRoutes);
  app.use("/", dashboardRoutes);
  app.use("/", profileRoutes);
  app.use("/", membershipRoutes);

  // Handle unmatched routes gracefully.
  app.use(notFoundHandler);

  // Handle unexpected errors in the application.
  app.use(globalErrorHandler);

  // Start the server and listen for incoming requests.
  app.listen(PORT, () => {
    console.log(`ACC server running on http://localhost:${PORT}`);
  });
}

// Initialize and start the app
initApp().catch((err) => {
  console.error("Failed to initialize application:", err && err.message ? err.message : err);
  process.exit(1);
});


// Global process-level handlers to avoid unhandled crashes.
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  // In production consider graceful shutdown and restart. For now, exit.
  process.exit(1);
});
