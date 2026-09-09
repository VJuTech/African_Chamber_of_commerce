const fs = require("fs");
const path = require("path");
const pool = require("../database/connection");

async function logSystemError(error, req) {
  const details = {
    message: error && error.message ? error.message : String(error),
    stack: error && error.stack ? error.stack : null,
    method: req && req.method,
    path: req && req.originalUrl,
    userId: req && req.session && req.session.user ? req.session.user.id : null,
    ip: req && req.ip,
  };

  try {
    await pool.query(
      `INSERT INTO audit_logs (event_type, user_id, outcome, details)
       VALUES ('system_error', $1, 'failure', $2::jsonb)`,
      [details.userId || null, JSON.stringify(details)]
    );
    return;
  } catch (loggingError) {
    const logDirectory = path.join(__dirname, "..", "logs");
    const logFile = path.join(logDirectory, "system-errors.log");
    try {
      fs.mkdirSync(logDirectory, { recursive: true });
      fs.appendFileSync(logFile, `${new Date().toISOString()} ${JSON.stringify(details)}\n`, "utf8");
    } catch (fileError) {
      console.error("System error logging failed:", loggingError.message, fileError.message);
    }
  }
}

module.exports = { logSystemError };
