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

function getTwilioConfig() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID || "";
  const authToken = process.env.TWILIO_AUTH_TOKEN || "";
  const from = process.env.TWILIO_PHONE_NUMBER || "";

  return {
    accountSid,
    authToken,
    from,
    configured: Boolean(accountSid && authToken && from),
  };
}

function getResendConfig() {
  const apiKey = process.env.RESEND_API_KEY || "";
  const from = process.env.RESEND_FROM || process.env.EMAIL_FROM || "";

  return {
    apiKey,
    from,
    configured: Boolean(apiKey && from),
  };
}

function generateVerificationCode(length = 6) {
  const digits = "0123456789";
  let code = "";

  for (let index = 0; index < length; index += 1) {
    code += digits[Math.floor(Math.random() * digits.length)];
  }

  return code;
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

async function sendWithResend({ to, from, subject, html, text, apiKey }) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html, text }),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const providerMessage = result && result.message ? result.message : "Email provider request failed.";
    throw new Error(providerMessage);
  }

  return result;
}

async function sendPasswordResetEmail({ to, resetUrl, appName = "African Chamber of Commerce" }) {
  const config = getMailerConfig();
  const resend = getResendConfig();
  const transport = resend.configured ? null : getTransporter();

  if (!resend.configured && (!transport || !config.configured)) {
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
    const info = resend.configured
      ? await sendWithResend({ ...mailOptions, from: resend.from, apiKey: resend.apiKey })
      : await transport.sendMail(mailOptions);
    return {
      success: true,
      configured: true,
      messageId: info.messageId || info.id,
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

async function sendAccountVerificationEmail({
  to,
  firstName = "Member",
  verificationCode,
  phone = "",
  appName = "African Chamber of Commerce",
}) {
  const config = getMailerConfig();
  const resend = getResendConfig();
  const transport = resend.configured ? null : getTransporter();

  if (!resend.configured && (!transport || !config.configured)) {
    console.warn("SMTP delivery is not configured. Account verification email was not sent.");
    return {
      success: false,
      configured: false,
      message: "Email delivery is not configured for this environment.",
    };
  }

  const safePhone = String(phone || "").trim();
  const mailOptions = {
    from: config.from,
    to,
    subject: `Verify your ${appName} account`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937;">
        <h2 style="color: #1d4ed8;">Welcome to ${appName}</h2>
        <p>Hello ${firstName},</p>
        <p>Thank you for creating your account. Please verify your email address to activate your profile.</p>
        <p>Your verification code is:</p>
        <p style="font-size: 28px; font-weight: bold; letter-spacing: 6px; margin: 20px 0; color: #111827;">${verificationCode}</p>
        <p>Registered phone number: <strong>${safePhone || "Not provided"}</strong></p>
        <p>This code is valid for 30 minutes. If you did not create this account, you can ignore this email.</p>
      </div>
    `,
    text: `Hello ${firstName}, thank you for creating your ${appName} account. Your verification code is ${verificationCode}. Registered phone number: ${safePhone || "Not provided"}. This code is valid for 30 minutes.`,
  };

  try {
    const info = resend.configured
      ? await sendWithResend({ ...mailOptions, from: resend.from, apiKey: resend.apiKey })
      : await transport.sendMail(mailOptions);
    console.log(`✓ Account verification email sent to ${to} (messageId: ${info.messageId || info.id})`);
    return {
      success: true,
      configured: true,
      messageId: info.messageId || info.id,
    };
  } catch (error) {
    console.error(`✗ Account verification email delivery failed to ${to}:`, error && error.message ? error.message : error);
    return {
      success: false,
      configured: true,
      message: error && error.message ? error.message : "Email delivery failed.",
    };
  }
}

async function sendAccountVerificationSms({
  to,
  firstName = "Member",
  verificationCode,
  appName = "African Chamber of Commerce",
}) {
  const config = getTwilioConfig();

  if (!config.configured) {
    console.warn("Twilio SMS delivery is not configured. Account verification SMS was not sent.");
    return {
      success: false,
      configured: false,
      message: "SMS delivery is not configured for this environment.",
    };
  }

  const body = `Hello ${firstName}, your ${appName} verification code is ${verificationCode}. Enter it to activate your account.`;

  try {
    const authHeader = Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64");
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${authHeader}`,
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      },
      body: new URLSearchParams({
        To: String(to),
        From: String(config.from),
        Body: body,
      }).toString(),
    });

    const resultText = await response.text();
    if (!response.ok) {
      console.error(`✗ Twilio SMS delivery failed to ${to}:`, resultText);
      return {
        success: false,
        configured: true,
        message: resultText || "SMS delivery failed.",
      };
    }

    console.log(`✓ Account verification SMS sent to ${to}`);
    return {
      success: true,
      configured: true,
      provider: "twilio",
      response: resultText,
    };
  } catch (error) {
    console.error("Twilio SMS delivery error:", error && error.message ? error.message : error);
    return {
      success: false,
      configured: true,
      message: error && error.message ? error.message : "SMS delivery failed.",
    };
  }
}

module.exports = {
  getMailerConfig,
  getResendConfig,
  getTwilioConfig,
  generateVerificationCode,
  sendPasswordResetEmail,
  sendAccountVerificationEmail,
  sendAccountVerificationSms,
};
