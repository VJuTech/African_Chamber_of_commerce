// Middleware for handling missing routes and unexpected server errors.
// This keeps the application responsive and gives users clear feedback.
const loggingModel = require("../models/loggingModel");

function notFoundHandler(req, res, next) {
  loggingModel.recordEvent({
    eventType: "route_not_found",
    severity: "info",
    source: "error_handler",
    userId: req.session && req.session.user ? req.session.user.id : null,
    requestId: req.id,
    method: req.method,
    path: req.originalUrl,
    outcome: "not_found",
    message: "Requested route was not found.",
  }).catch((error) => console.error("404 logging failed:", error.message));
  res.status(404).render("error/404", {
    title: "Page Not Found",
    message: "The page you requested could not be found.",
  });
}

async function globalErrorHandler(err, req, res, next) {
  console.error(err);
  try {
    await loggingModel.recordError(err, req, { statusCode: err.statusCode || 500 });
  } catch (loggingError) {
    console.error("Structured error logging failed:", loggingError.message);
  }

  const statusCode = err.statusCode || 500;
  const message = statusCode === 400
    ? "Invalid input. Please review your request and try again."
    : statusCode === 401 || statusCode === 403
      ? "You are not authorized to perform this action."
      : statusCode === 404
        ? "The requested resource could not be found."
        : statusCode === 503
          ? "Service temporarily unavailable. Please try again shortly."
          : "Something went wrong on the server. Our team has been notified.";

  if (req.xhr || req.headers.accept?.includes("application/json")) {
    return res.status(statusCode).json({
      success: false,
      message,
    });
  }

  return res.status(statusCode).render("error/500", {
    title: "Server Error",
    message,
  });
}

module.exports = {
  notFoundHandler,
  globalErrorHandler,
};
