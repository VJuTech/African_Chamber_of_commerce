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
const businessRoutes = require("./routes/businessRoute");
const businessProfileRoutes = require("./routes/businessProfileRoute");
const businessDirectoryRoutes = require("./routes/businessDirectoryRoute");
const businessNetworkingRoutes = require("./routes/businessNetworkingRoute");
const messagingRoutes = require("./routes/messagingRoute");
const eventsRoutes = require("./routes/eventsRoute");
const trustRoutes = require("./routes/trustRoute");
const marketplaceRoutes = require("./routes/marketplaceRoute");
const orderRoutes = require("./routes/orderRoute");
const logisticsRoutes = require("./routes/logisticsRoute");
const paymentRoutes = require("./routes/paymentRoute");
const subscriptionRoutes = require("./routes/subscriptionRoute");
const assistantRoutes = require("./routes/assistantRoute");
// Load the Chapter 22 procurement route collection for authenticated buyers and suppliers.
const procurementRoutes = require("./routes/procurementRoute");
// Load the Chapter 23 contract route collection for authorized business parties.
const contractRoutes = require("./routes/contractRoute");
// Load the Chapter 24 dispute route collection for transaction parties and moderators.
const disputeRoutes = require("./routes/disputeRoute");
const { notFoundHandler, globalErrorHandler } = require("./middleware/errorHandler");

// Create the Express application instance.
const app = express();
const PORT = Number(process.env.PORT) || 5500;
const HOST = process.env.HOST || "0.0.0.0";
const DATABASE_STARTUP_ATTEMPTS = 12;
const DATABASE_STARTUP_RETRY_MS = 5000;

// Derive a lightweight device label for active-session displays without adding
// another runtime dependency.
function inferDevice(userAgent) {
  const ua = String(userAgent || "").toLowerCase();
  if (/tablet|ipad/.test(ua)) return "Tablet";
  if (/mobile|iphone|android/.test(ua)) return "Mobile";
  return "Desktop";
}

// Parse a human-readable browser label from the current request user agent.
function inferBrowser(userAgent) {
  const ua = String(userAgent || "").toLowerCase();
  if (ua.includes("edg/")) return "Microsoft Edge";
  if (ua.includes("chrome/")) return "Chrome";
  if (ua.includes("firefox/")) return "Firefox";
  if (ua.includes("safari/") && !ua.includes("chrome/")) return "Safari";
  return "Web Browser";
}

// Parse a human-readable operating-system label from the current request user agent.
function inferOperatingSystem(userAgent) {
  const ua = String(userAgent || "").toLowerCase();
  if (ua.includes("windows")) return "Windows";
  if (ua.includes("mac os")) return "macOS";
  if (ua.includes("android")) return "Android";
  if (ua.includes("iphone") || ua.includes("ipad") || ua.includes("ios")) return "iOS";
  if (ua.includes("linux")) return "Linux";
  return "Unknown OS";
}

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

// Ensure the favicon asset is always reachable from the app root.
app.get("/favicon.svg", (req, res) => {
  console.log("Favicon route hit");
  res.setHeader("Content-Type", "image/svg+xml");
  res.sendFile(path.join(__dirname, "public", "favicon.svg"));
});

// We'll initialize the session store after testing DB connectivity to avoid
// connect-pg-simple pruning attempts against an unstable DB which can cause ECONNRESET.
async function createSessionStore() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured");
  }

  // Render databases can briefly reset connections while waking or restarting.
  // Retry startup, but never replace PostgreSQL with an in-memory session store.
  let lastError;
  for (let attempt = 1; attempt <= DATABASE_STARTUP_ATTEMPTS; attempt += 1) {
    let client;
    try {
      client = await pool.connect();
      await client.query("SELECT 1");
      console.log(`PostgreSQL connection established on startup (attempt ${attempt}/${DATABASE_STARTUP_ATTEMPTS})`);
      return new PgSession({ pool, tableName: "session", pruneSessionInterval: 0 });
    } catch (err) {
      lastError = err;
      console.error(`PostgreSQL startup attempt ${attempt}/${DATABASE_STARTUP_ATTEMPTS} failed:`, err && err.message ? err.message : err);
    } finally {
      if (client) client.release();
    }

    if (attempt < DATABASE_STARTUP_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, DATABASE_STARTUP_RETRY_MS));
    }
  }

  throw new Error(`PostgreSQL is required for session storage after ${DATABASE_STARTUP_ATTEMPTS} attempts: ${lastError && lastError.message ? lastError.message : lastError}`);
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

  // Keep the authenticated user available to layouts and store session metadata
  // used by the profile active-session views.
  app.use((req, res, next) => {
    res.locals.user = req.session && req.session.user ? req.session.user : null;

    if (req.session && req.session.authenticated && req.session.user) {
      const previousMeta = req.session.sessionMeta || {};
      const userAgent = req.headers["user-agent"] || previousMeta.userAgent || "";

      req.session.userId = req.session.userId || req.session.user.id;
      req.session.sessionMeta = {
        userId: req.session.userId,
        userAgent,
        device: inferDevice(userAgent),
        browser: inferBrowser(userAgent),
        operatingSystem: inferOperatingSystem(userAgent),
        ipAddress: req.ip,
        loginAt: previousMeta.loginAt || new Date().toISOString(),
        lastActivityAt: new Date().toISOString(),
      };
    }

    next();
  });

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
  app.use("/", businessRoutes);
  app.use("/", businessProfileRoutes);
  app.use("/", businessDirectoryRoutes);
  app.use("/", businessNetworkingRoutes);
  app.use("/", messagingRoutes);
  app.use("/", eventsRoutes);
  app.use("/", trustRoutes);
  app.use("/", marketplaceRoutes);
  app.use("/", orderRoutes);
  app.use("/", logisticsRoutes);
  app.use("/", paymentRoutes);
  app.use("/", subscriptionRoutes);
  app.use("/", assistantRoutes);
  // Mount procurement after the existing commerce routes without changing their behavior.
  app.use("/", procurementRoutes);
  // Mount contract management after procurement so awarded sourcing records can be referenced.
  app.use("/", contractRoutes);
  // Mount dispute resolution after contracts so cases can reference contract records.
  app.use("/", disputeRoutes);

  // Handle unmatched routes gracefully.
  app.use(notFoundHandler);

  // Handle unexpected errors in the application.
  app.use(globalErrorHandler);

  console.log("Mounted account routes:", accountRoutes.stack.map((layer) => layer.route && layer.route.path).filter(Boolean));
  console.log("Mounted page routes:", pageRoutes.stack.map((layer) => layer.route && layer.route.path).filter(Boolean));

  // Start the server and listen for incoming requests.
  app.listen(PORT, HOST, () => {
    console.log(`ACC server running on http://${HOST}:${PORT}`);
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
