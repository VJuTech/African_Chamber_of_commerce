// Middleware for handling missing routes and unexpected server errors.
// This keeps the application responsive and gives users clear feedback.

function notFoundHandler(req, res, next) {
  res.status(404).render("error/404", {
    title: "Page Not Found",
    message: "The page you requested could not be found.",
  });
}

function globalErrorHandler(err, req, res, next) {
  console.error(err);

  const statusCode = err.statusCode || 500;
  const message = err.message || "Something went wrong on the server.";

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
