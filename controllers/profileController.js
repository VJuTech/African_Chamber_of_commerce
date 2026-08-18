const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const profileModel = require("../models/profileModel");

const maxProfilePhotoBytes = Number(process.env.PROFILE_PHOTO_MAX_BYTES || 2 * 1024 * 1024);
const supportedImageMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

// Use memory storage so we can validate file signatures before writing to disk.
const profilePhotoUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: maxProfilePhotoBytes,
  },
  fileFilter(req, file, callback) {
    if (!supportedImageMimeTypes.has(file.mimetype)) {
      return callback(new Error("Profile photo must be a JPEG, PNG, or WebP image."));
    }

    return callback(null, true);
  },
});

// Gather request metadata used by audit logging and session management.
function buildRequestContext(req) {
  return {
    currentUser: req.session.user,
    currentPasswordHash: req.session.user ? req.session.user.passwordHash : "",
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"] || "",
  };
}

// Keep the session user record aligned with the latest persisted profile data.
function syncSessionUser(req, profile = {}, extras = {}) {
  if (!req.session || !req.session.user) return;

  req.session.user = {
    ...req.session.user,
    id: profile.id || req.session.user.id,
    name: profile.preferredDisplayName || [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim() || req.session.user.name,
    firstName: profile.firstName || req.session.user.firstName,
    middleName: profile.middleName || req.session.user.middleName,
    lastName: profile.lastName || req.session.user.lastName,
    preferredDisplayName: profile.preferredDisplayName || req.session.user.preferredDisplayName,
    email: profile.email || req.session.user.email,
    phone: profile.phone || req.session.user.phone,
    country: profile.country || req.session.user.country,
    preferredLanguage: profile.preferredLanguage || req.session.user.preferredLanguage,
    timeZone: profile.timeZone || req.session.user.timeZone,
    address: profile.address || req.session.user.address,
    organizationName: profile.organizationName || req.session.user.organizationName,
    profilePhotoUrl: profile.profilePhotoUrl || req.session.user.profilePhotoUrl,
    preferences: profile.preferences || req.session.user.preferences,
    emailVerified: profile.emailVerified ?? req.session.user.emailVerified,
    phoneVerified: profile.phoneVerified ?? req.session.user.phoneVerified,
    ...extras,
  };
}

// Convert checkbox posts into explicit boolean communication preferences.
function buildPreferencesFromRequest(body = {}) {
  return {
    emailNotifications: body.emailNotifications === "true",
    smsNotifications: body.smsNotifications === "true",
    pushNotifications: body.pushNotifications === "true",
    marketingCommunications: body.marketingCommunications === "true",
    newsletterSubscription: body.newsletterSubscription === "true",
    eventReminders: body.eventReminders === "true",
    procurementNotifications: body.procurementNotifications === "true",
    marketplaceUpdates: body.marketplaceUpdates === "true",
  };
}

// Rebuild the form state after validation failures without dropping known profile data.
function normalizeProfileFormData(body = {}, fallbackProfile = {}) {
  return {
    ...fallbackProfile,
    firstName: body.firstName ?? fallbackProfile.firstName ?? "",
    middleName: body.middleName ?? fallbackProfile.middleName ?? "",
    lastName: body.lastName ?? fallbackProfile.lastName ?? "",
    preferredDisplayName: body.preferredDisplayName ?? fallbackProfile.preferredDisplayName ?? "",
    dateOfBirth: body.dateOfBirth ?? fallbackProfile.dateOfBirth ?? "",
    gender: body.gender ?? fallbackProfile.gender ?? "",
    nationality: body.nationality ?? fallbackProfile.nationality ?? "",
    country: body.country ?? fallbackProfile.country ?? "",
    countryOfResidence: body.countryOfResidence ?? fallbackProfile.countryOfResidence ?? "",
    stateProvince: body.stateProvince ?? fallbackProfile.stateProvince ?? "",
    city: body.city ?? fallbackProfile.city ?? "",
    preferredLanguage: body.preferredLanguage ?? fallbackProfile.preferredLanguage ?? "",
    timeZone: body.timeZone ?? fallbackProfile.timeZone ?? "",
    email: fallbackProfile.email ?? "",
    phone: fallbackProfile.phone ?? "",
    alternativePhone: body.alternativePhone ?? fallbackProfile.alternativePhone ?? "",
    address: body.address ?? fallbackProfile.address ?? "",
    username: body.username ?? fallbackProfile.username ?? "",
    organizationName: body.organizationName ?? fallbackProfile.organizationName ?? "",
    preferences: fallbackProfile.preferences || profileModel.getDefaultPreferences(),
  };
}

// Validate the uploaded bytes against the claimed image type before saving.
function verifyImageSignature(buffer, mimeType) {
  if (!buffer || buffer.length < 12) return false;

  // Signature validation provides a basic malware barrier in environments where
  // a dedicated antivirus scanner has not yet been integrated.
  if (mimeType === "image/jpeg") {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[buffer.length - 2] === 0xff && buffer[buffer.length - 1] === 0xd9;
  }

  if (mimeType === "image/png") {
    return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  }

  if (mimeType === "image/webp") {
    return buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP";
  }

  return false;
}

// Map MIME types to a safe on-disk file extension.
function getProfilePhotoExtension(mimeType) {
  if (mimeType === "image/png") return ".png";
  if (mimeType === "image/webp") return ".webp";
  return ".jpg";
}

// Load all profile dashboard slices in one place before rendering the page.
async function renderProfileView(req, res, options = {}) {
  const dashboard = await profileModel.getProfileDashboard(
    req.session.user.id,
    req.sessionID,
    req.session.user,
    req.session.sessionMeta || {}
  );

  const profile = options.profile
    ? {
        ...dashboard.profile,
        ...options.profile,
        preferences: options.profile.preferences || dashboard.profile.preferences,
      }
    : dashboard.profile;

  return res.render("profile", {
    title: "My Profile",
    user: req.session.user,
    profile,
    error: options.error || "",
    success: options.success || "",
    sessions: dashboard.sessions,
    activity: dashboard.activity,
    pendingContactChanges: dashboard.pendingContactChanges,
    pageScript: "/scripts/profile.js",
  });
}

// Render the current user's profile dashboard.
async function profilePage(req, res, next) {
  try {
    await renderProfileView(req, res, {
      success: req.query.success || "",
      error: req.query.error || "",
    });
  } catch (error) {
    next(error);
  }
}

// Persist editable personal-information fields.
async function updateProfile(req, res, next) {
  try {
    const currentUser = req.session.user;

    if (!currentUser) {
      return res.redirect("/login?message=Please sign in to continue.");
    }

    const result = await profileModel.updateProfileData(currentUser.id, req.body, buildRequestContext(req));

    if (!result.success) {
      return renderProfileView(req, res, {
        profile: normalizeProfileFormData(req.body),
        error: result.message,
      });
    }

    syncSessionUser(req, result.profile);
    return res.redirect("/profile?success=Profile updated successfully.");
  } catch (error) {
    return next(error);
  }
}

// Validate and store a new profile image.
async function handleProfilePhotoUpload(req, res, next) {
  try {
    const currentUser = req.session.user;

    if (!currentUser) {
      return res.redirect("/login?message=Please sign in to continue.");
    }

    if (!req.file) {
      return renderProfileView(req, res, {
        error: "Select a profile image to upload.",
      });
    }

    if (!verifyImageSignature(req.file.buffer, req.file.mimetype)) {
      return renderProfileView(req, res, {
        error: "The uploaded file did not pass image validation.",
      });
    }

    const fileName = `profile-${currentUser.id}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}${getProfilePhotoExtension(req.file.mimetype)}`;
    const diskPath = path.join(profileModel.profileUploadDirectory, fileName);
    const publicPath = `/uploads/profiles/${fileName}`;

    fs.writeFileSync(diskPath, req.file.buffer);

    const result = await profileModel.updateProfilePhotoData(
      currentUser.id,
      {
        fileName,
        mimeType: req.file.mimetype,
        publicPath,
      },
      buildRequestContext(req)
    );

    syncSessionUser(req, result.profile);
    return res.redirect("/profile?success=Profile photo updated successfully.");
  } catch (error) {
    return next(error);
  }
}

// Remove the current profile image from storage and the user record.
async function removeProfilePhoto(req, res, next) {
  try {
    const currentUser = req.session.user;
    if (!currentUser) {
      return res.redirect("/login?message=Please sign in to continue.");
    }

    const result = await profileModel.removeProfilePhotoData(currentUser.id, buildRequestContext(req));
    syncSessionUser(req, result.profile, { profilePhotoUrl: "" });
    return res.redirect("/profile?success=Profile photo removed successfully.");
  } catch (error) {
    return next(error);
  }
}

// Change the authenticated user's password after verifying the current secret.
async function updatePassword(req, res, next) {
  try {
    const currentUser = req.session.user;

    if (!currentUser) {
      return res.redirect("/login?message=Please sign in to continue.");
    }

    const { currentPassword, newPassword, confirmNewPassword } = req.body;
    const result = await profileModel.updatePasswordData(
      currentUser.id,
      currentPassword,
      newPassword,
      confirmNewPassword,
      buildRequestContext(req)
    );

    if (!result.success) {
      return renderProfileView(req, res, {
        error: result.message,
      });
    }

    syncSessionUser(req, {}, { passwordHash: result.passwordHash || req.session.user.passwordHash });
    return res.redirect("/profile?success=Password updated successfully.");
  } catch (error) {
    return next(error);
  }
}

// Save communication preference changes while preserving mandatory notifications.
async function updatePreferences(req, res, next) {
  try {
    const currentUser = req.session.user;
    if (!currentUser) {
      return res.redirect("/login?message=Please sign in to continue.");
    }

    const preferences = buildPreferencesFromRequest(req.body);
    const result = await profileModel.updatePreferencesData(currentUser.id, preferences, buildRequestContext(req));

    syncSessionUser(req, { preferences: result.data });
    return res.redirect("/profile?success=Communication preferences updated.");
  } catch (error) {
    return next(error);
  }
}

// Start a verified contact change workflow for email or mobile number.
async function requestContactChange(req, res, next) {
  try {
    const currentUser = req.session.user;
    if (!currentUser) {
      return res.redirect("/login?message=Please sign in to continue.");
    }

    const result = await profileModel.createContactChangeRequest(
      currentUser.id,
      {
        contactType: req.body.contactType,
        pendingValue: req.body.pendingValue,
      },
      buildRequestContext(req)
    );

    if (!result.success) {
      return renderProfileView(req, res, {
        error: result.message,
      });
    }

    const verificationSuffix = result.request && result.request.verificationCode
      ? ` Development verification code: ${result.request.verificationCode}.`
      : "";

    return res.redirect(`/profile?success=${encodeURIComponent(result.message + verificationSuffix)}`);
  } catch (error) {
    return next(error);
  }
}

// Complete a pending verified contact change after code confirmation.
async function confirmContactChange(req, res, next) {
  try {
    const currentUser = req.session.user;
    if (!currentUser) {
      return res.redirect("/login?message=Please sign in to continue.");
    }

    const result = await profileModel.confirmContactChange(
      currentUser.id,
      req.body.verificationToken,
      buildRequestContext(req)
    );

    if (!result.success) {
      return renderProfileView(req, res, {
        error: result.message,
      });
    }

    syncSessionUser(req, result.profile || {});
    return res.redirect("/profile?success=Verified contact information updated successfully.");
  } catch (error) {
    return next(error);
  }
}

// Terminate a single non-current active session for the authenticated user.
async function terminateSession(req, res, next) {
  try {
    const currentUser = req.session.user;
    if (!currentUser) {
      return res.redirect("/login?message=Please sign in to continue.");
    }

    const result = await profileModel.terminateSessionById(
      currentUser.id,
      req.body.sessionId,
      req.sessionID,
      buildRequestContext(req)
    );

    if (!result.success) {
      return renderProfileView(req, res, {
        error: result.message,
      });
    }

    return res.redirect(`/profile?success=${encodeURIComponent(result.message)}`);
  } catch (error) {
    return next(error);
  }
}

// Revoke every active session except the current one.
async function terminateOtherSessions(req, res, next) {
  try {
    const currentUser = req.session.user;
    if (!currentUser) {
      return res.redirect("/login?message=Please sign in to continue.");
    }

    const result = await profileModel.terminateOtherSessions(
      currentUser.id,
      req.sessionID,
      buildRequestContext(req)
    );

    if (!result.success) {
      return renderProfileView(req, res, {
        error: result.message,
      });
    }

    return res.redirect(`/profile?success=${encodeURIComponent(result.message)}`);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  profilePage,
  profilePhotoUpload,
  updateProfile,
  handleProfilePhotoUpload,
  removeProfilePhoto,
  updatePassword,
  updatePreferences,
  requestContactChange,
  confirmContactChange,
  terminateSession,
  terminateOtherSessions,
};
