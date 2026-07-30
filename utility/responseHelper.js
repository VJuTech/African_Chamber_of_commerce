// Shared response helpers for returning consistent JSON payloads.
// These helpers keep API responses predictable across controllers and middleware.

function sendSuccess(res, message, data = null, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
}

function sendError(res, message, statusCode = 500, details = null) {
  return res.status(statusCode).json({
    success: false,
    message,
    details,
  });
}

module.exports = {
  sendSuccess,
  sendError,
};
