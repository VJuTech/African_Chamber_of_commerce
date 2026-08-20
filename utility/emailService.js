const nodemailer = require("nodemailer");

function getMailerConfig() {
  const host = process.env.SMTP_HOST || "";
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = process.env.SMTP_SECURE === "true" || process.env.SMTP_SECURE === "1" || port === 465;
  const user = process.env.SMTP_USER || "";
  const pass = process.env.SMTP_PASS || "";
  const from = process.env.SMTP_FROM || process.env.MAIL_FROM || "no-reply@acc.local";

  return {
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
    from,
    configured: Boolean(host && user && pass),
  };
}

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const config = getMailerConfig();
  if (!config.configured) {
    transporter = null;
    return null;
  }

  transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
  });

  return transporter;
}

async function sendPasswordResetEmail({ to, resetUrl, appName = "African Chamber of Commerce" }) {
  const config = getMailerConfig();
  const transport = getTransporter();

  if (!transport || !config.configured) {
    console.warn("SMTP delivery is not configured. Password reset link was not emailed.");
    return {
      success: false,
      configured: false,
      message: "Email delivery is not configured for this environment.",
    };
  }

  const mailOptions = {
    from: config.from,
    to,
    subject: `Reset your ${appName} password`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937;">
        <h2 style="color: #4c1d95;">Reset your password</h2>
        <p>We received a request to reset the password for your <strong>${appName}</strong> account.</p>
        <p>Use the button below to create a new password. This link will expire in 30 minutes.</p>
        <p style="margin: 24px 0;">
          <a href="${resetUrl}" style="background: #4c1d95; color: white; padding: 12px 18px; text-decoration: none; border-radius: 8px; display: inline-block;">
            Reset password
          </a>
        </p>
        <p>If the button does not work, copy and paste this link into your browser:</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
      </div>
    `,
    text: `Reset your ${appName} password. Open this link to continue: ${resetUrl}`,
  };

  try {
    const info = await transport.sendMail(mailOptions);
    return {
      success: true,
      configured: true,
      messageId: info.messageId,
    };
  } catch (error) {
    console.error("Password reset email delivery failed:", error && error.message ? error.message : error);
    return {
      success: false,
      configured: true,
      message: error && error.message ? error.message : "Email delivery failed.",
    };
  }
}

module.exports = {
  getMailerConfig,
  sendPasswordResetEmail,
};
