const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const pool = require("../database/connection");
const authModel = require("./authModel");
const { validateEmail, validatePassword, validatePhone } = require("../utility/account-validation");

// Store uploaded profile media inside the public folder so files can be served
// without additional controller logic.
const profileUploadDirectory = path.join(__dirname, "..", "public", "uploads", "profiles");

// Keep lightweight in-memory state for environments that do not have Postgres configured.
const localProfileStore = new Map();
const localContactRequests = new Map();

fs.mkdirSync(profileUploadDirectory, { recursive: true });

function hasDatabaseConfiguration() {
  return Boolean(process.env.DATABASE_URL || process.env.PGHOST);
}

// Borrow a database client when Postgres is configured and reachable.
async function getClient() {
  if (!hasDatabaseConfiguration()) return null;

  try {
    return await pool.connect();
  } catch (error) {
    return null;
  }
}

// Centralize default communication preferences for new and existing profiles.
function getDefaultPreferences() {
  return {
    emailNotifications: true,
    smsNotifications: true,
    pushNotifications: true,
    marketingCommunications: false,
    newsletterSubscription: false,
    eventReminders: true,
    procurementNotifications: true,
    marketplaceUpdates: true,
  };
}

// Normalize stored and submitted preference data into a complete profile payload.
function normalizePreferences(input = {}) {
  const defaults = getDefaultPreferences();

  return {
    ...defaults,
    ...input,
    emailNotifications: input.emailNotifications !== false,
    smsNotifications: input.smsNotifications !== false,
    pushNotifications: input.pushNotifications !== false,
    marketingCommunications: Boolean(input.marketingCommunications),
    newsletterSubscription: Boolean(input.newsletterSubscription),
    eventReminders: input.eventReminders !== false,
    procurementNotifications: input.procurementNotifications !== false,
    marketplaceUpdates: input.marketplaceUpdates !== false,
    legalNotifications: true,
    securityNotifications: true,
  };
}

// Build a display-friendly full name from profile name parts.
function buildDisplayName(firstName, lastName, middleName) {
  return [firstName, middleName, lastName]
    .filter(Boolean)
    .map((value) => String(value).trim())
    .join(" ")
    .trim();
}

// Convert date values into the HTML date-input format.
function formatIsoDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

// Ensure stored photo paths are public URL paths.
function getPublicPhotoUrl(photoPath) {
  if (!photoPath) return "";
  return String(photoPath).startsWith("/") ? photoPath : `/${String(photoPath).replace(/\\/g, "/")}`;
}

// Map DB and session user records into the profile view-model shape.
function mapUserToProfile(userRecord = {}) {
  const preferences = normalizePreferences(userRecord.communication_preferences || userRecord.preferences || {});
  const firstName = userRecord.first_name || userRecord.firstName || "";
  const lastName = userRecord.last_name || userRecord.lastName || "";
  const middleName = userRecord.middle_name || userRecord.middleName || "";

  return {
    id: userRecord.id,
    firstName,
    middleName,
    lastName,
    preferredDisplayName: userRecord.preferred_display_name || userRecord.preferredDisplayName || "",
    dateOfBirth: formatIsoDate(userRecord.date_of_birth || userRecord.dateOfBirth),
    gender: userRecord.gender || "",
    nationality: userRecord.nationality || "",
    country: userRecord.country || "",
    countryOfResidence: userRecord.country_of_residence || userRecord.countryOfResidence || userRecord.country || "",
    stateProvince: userRecord.state_province || userRecord.stateProvince || "",
    city: userRecord.city || "",
    preferredLanguage: userRecord.preferred_language || userRecord.preferredLanguage || "",
    timeZone: userRecord.time_zone || userRecord.timeZone || "",
    email: userRecord.email || "",
    phone: userRecord.phone || "",
    alternativePhone: userRecord.alternative_phone || userRecord.alternativePhone || "",
    address: userRecord.mailing_address || userRecord.address || userRecord.mailingAddress || "",
    username: userRecord.username || "",
    organizationName: userRecord.organization_name || userRecord.organizationName || "",
    membershipStatus: userRecord.membership_status || userRecord.membershipStatus || userRecord.status || "pending_verification",
    accountStatus: userRecord.account_status || userRecord.accountStatus || userRecord.status || "active",
    registrationDate: userRecord.created_at || userRecord.createdAt || null,
    lastLogin: userRecord.last_login_at || userRecord.lastLoginAt || null,
    roles: [userRecord.role || "member"],
    linkedOrganizations: userRecord.organization_name ? [userRecord.organization_name] : [],
    emailVerified: Boolean(userRecord.email_verified ?? userRecord.emailVerified),
    phoneVerified: Boolean(userRecord.phone_verified ?? userRecord.phoneVerified),
    profilePhotoUrl: getPublicPhotoUrl(userRecord.profile_photo_path || userRecord.profilePhotoPath),
    profilePhotoMimeType: userRecord.profile_photo_mime_type || userRecord.profilePhotoMimeType || "",
    preferences,
    security: {
      mfaEnabled: Boolean(userRecord.mfa_enabled ?? userRecord.mfaEnabled),
      trustedDevicesSupported: false,
    },
  };
}

// Preserve profile functionality when the application is running without Postgres.
function getLocalProfile(userId, sessionUser = {}) {
  if (!localProfileStore.has(userId)) {
    localProfileStore.set(userId, mapUserToProfile(sessionUser));
  }

  const existing = localProfileStore.get(userId);
  return {
    ...mapUserToProfile(sessionUser),
    ...existing,
    preferences: normalizePreferences(existing.preferences || sessionUser.preferences || {}),
  };
}

// Expose at least the current session when DB-backed session queries are unavailable.
function buildFallbackSession(currentSessionId, sessionMeta = {}) {
  return [
    {
      sid: currentSessionId,
      current: true,
      device: sessionMeta.device || "Current device",
      browser: sessionMeta.browser || "Web Browser",
      operatingSystem: sessionMeta.operatingSystem || "Unknown OS",
      location: sessionMeta.ipAddress || "Approximate location unavailable",
      loginTime: sessionMeta.loginAt || null,
      lastActivity: sessionMeta.lastActivityAt || null,
      expiresAt: null,
    },
  ];
}

// Reuse file or DB audit entries as a recent activity timeline.
function buildFallbackActivity(userId) {
  return authModel
    .getAuditEntries()
    .filter((entry) => entry.details && Number(entry.details.userId) === Number(userId))
    .slice(-12)
    .reverse()
    .map((entry) => ({
      eventType: entry.eventType,
      timestamp: entry.timestamp,
      outcome: entry.details ? entry.details.outcome : "success",
      details: entry.details || {},
    }));
}

// Limit the verification request fields shown back to the profile page.
function buildPendingRequestSummary(request) {
  return {
    id: request.id,
    contactType: request.contact_type || request.contactType,
    pendingValue: request.pending_value || request.pendingValue,
    currentValue: request.current_value || request.currentValue,
    status: request.status,
    requestedAt: request.requested_at || request.requestedAt,
    expiresAt: request.expires_at || request.expiresAt,
    verificationCode: process.env.NODE_ENV === "production" ? "" : (request.verification_token || request.verificationToken || ""),
  };
}

// Fetch the main profile, activity, pending verification, and session slices together.
async function getProfileDashboard(userId, currentSessionId, sessionUser = {}, sessionMeta = {}) {
  const client = await getClient();

  if (!client) {
    const profile = getLocalProfile(userId, sessionUser);
    const requests = Array.from(localContactRequests.values())
      .filter((request) => Number(request.userId) === Number(userId) && request.status === "pending")
      .map(buildPendingRequestSummary);

    return {
      profile,
      sessions: buildFallbackSession(currentSessionId, sessionMeta),
      activity: buildFallbackActivity(userId),
      pendingContactChanges: requests,
    };
  }

  try {
    const userResult = await client.query("SELECT * FROM users WHERE id = $1 LIMIT 1", [userId]);
    const userRecord = userResult.rows[0] || sessionUser;
    const profile = mapUserToProfile(userRecord);

    const requestResult = await client.query(
      `SELECT *
       FROM profile_contact_change_requests
       WHERE user_id = $1 AND status = 'pending'
       ORDER BY requested_at DESC`,
      [userId]
    );

    const activityResult = await client.query(
      `SELECT event_type, outcome, created_at, details
       FROM audit_logs
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 12`,
      [userId]
    );

    const sessionResult = await client.query(
      `SELECT sid, sess, expire
       FROM session
       WHERE COALESCE(sess->>'userId', sess->'sessionMeta'->>'userId', sess->'user'->>'id') = $1`,
      [String(userId)]
    );

    const sessions = sessionResult.rows
      .map((row) => {
        const sessionState = row.sess || {};
        const meta = sessionState.sessionMeta || {};

        return {
          sid: row.sid,
          current: row.sid === currentSessionId,
          device: meta.device || "Web Session",
          browser: meta.browser || "Web Browser",
          operatingSystem: meta.operatingSystem || "Unknown OS",
          location: meta.ipAddress || "Approximate location unavailable",
          loginTime: meta.loginAt || null,
          lastActivity: meta.lastActivityAt || null,
          expiresAt: row.expire,
        };
      })
      .sort((left, right) => new Date(right.lastActivity || right.loginTime || 0) - new Date(left.lastActivity || left.loginTime || 0));

    return {
      profile,
      sessions,
      activity: activityResult.rows.map((row) => ({
        eventType: row.event_type,
        timestamp: row.created_at,
        outcome: row.outcome,
        details: row.details || {},
      })),
      pendingContactChanges: requestResult.rows.map(buildPendingRequestSummary),
    };
  } finally {
    client.release();
  }
}

// Persist editable personal details and audit the update.
async function updateProfileData(userId, profileData = {}, context = {}) {
  const payload = {
    firstName: String(profileData.firstName || "").trim(),
    middleName: String(profileData.middleName || "").trim(),
    lastName: String(profileData.lastName || "").trim(),
    preferredDisplayName: String(profileData.preferredDisplayName || "").trim(),
    dateOfBirth: String(profileData.dateOfBirth || "").trim(),
    gender: String(profileData.gender || "").trim(),
    nationality: String(profileData.nationality || "").trim(),
    country: String(profileData.country || "").trim(),
    countryOfResidence: String(profileData.countryOfResidence || profileData.country || "").trim(),
    stateProvince: String(profileData.stateProvince || "").trim(),
    city: String(profileData.city || "").trim(),
    preferredLanguage: String(profileData.preferredLanguage || "").trim(),
    timeZone: String(profileData.timeZone || "").trim(),
    alternativePhone: String(profileData.alternativePhone || "").trim(),
    address: String(profileData.address || "").trim(),
    username: String(profileData.username || "").trim(),
    organizationName: String(profileData.organizationName || "").trim(),
  };

  if (!payload.firstName || !payload.lastName) {
    return { success: false, message: "First name and last name are required." };
  }

  if (payload.alternativePhone) {
    const phoneErrors = validatePhone(payload.alternativePhone);
    if (phoneErrors.length > 0) {
      return { success: false, message: phoneErrors.join(" ") };
    }
  }

  const client = await getClient();

  if (!client) {
    const existing = getLocalProfile(userId, context.currentUser || {});
    const updated = {
      ...existing,
      ...payload,
      linkedOrganizations: payload.organizationName ? [payload.organizationName] : existing.linkedOrganizations,
    };

    localProfileStore.set(userId, updated);
    await authModel.logEvent("profile_updated", {
      userId,
      outcome: "success",
      ipAddress: context.ipAddress || null,
      userAgent: context.userAgent || null,
      profile: payload,
    });

    return { success: true, message: "Profile updated successfully.", profile: updated };
  }

  try {
    const result = await client.query(
      `UPDATE users
       SET first_name = $1,
           middle_name = $2,
           last_name = $3,
           name = $4,
           preferred_display_name = $5,
           date_of_birth = NULLIF($6, '')::date,
           gender = NULLIF($7, ''),
           nationality = NULLIF($8, ''),
           country = $9,
           country_of_residence = $10,
           state_province = NULLIF($11, ''),
           city = NULLIF($12, ''),
           preferred_language = NULLIF($13, ''),
           time_zone = NULLIF($14, ''),
           alternative_phone = NULLIF($15, ''),
           mailing_address = NULLIF($16, ''),
           username = NULLIF($17, ''),
           organization_name = NULLIF($18, ''),
           updated_at = NOW()
       WHERE id = $19
       RETURNING *`,
      [
        payload.firstName,
        payload.middleName || null,
        payload.lastName,
        buildDisplayName(payload.firstName, payload.lastName, payload.middleName),
        payload.preferredDisplayName || null,
        payload.dateOfBirth,
        payload.gender,
        payload.nationality,
        payload.country || payload.countryOfResidence,
        payload.countryOfResidence || payload.country,
        payload.stateProvince,
        payload.city,
        payload.preferredLanguage,
        payload.timeZone,
        payload.alternativePhone,
        payload.address,
        payload.username,
        payload.organizationName,
        userId,
      ]
    );

    await authModel.logEvent("profile_updated", {
      userId,
      outcome: "success",
      ipAddress: context.ipAddress || null,
      userAgent: context.userAgent || null,
      profile: payload,
    });

    return {
      success: true,
      message: "Profile updated successfully.",
      profile: mapUserToProfile(result.rows[0]),
    };
  } catch (error) {
    if (error && error.code === "23505") {
      return { success: false, message: "That username is already in use." };
    }

    throw error;
  } finally {
    client.release();
  }
}

// Enforce password policy and persist the replacement hash.
async function updatePasswordData(userId, currentPassword, newPassword, confirmNewPassword, context = {}) {
  if (!currentPassword) {
    return { success: false, message: "Current password is required." };
  }

  const passwordErrors = validatePassword(newPassword, confirmNewPassword);
  if (passwordErrors.length > 0) {
    return { success: false, message: passwordErrors.join(" ") };
  }

  if (String(currentPassword) === String(newPassword)) {
    return { success: false, message: "New password must be different from the current password." };
  }

  const client = await getClient();

  if (!client) {
    if (!context.currentPasswordHash || !bcrypt.compareSync(currentPassword, context.currentPasswordHash)) {
      return { success: false, message: "Current password is incorrect." };
    }

    const passwordHash = bcrypt.hashSync(newPassword, 10);
    await authModel.logEvent("password_changed", {
      userId,
      outcome: "success",
      ipAddress: context.ipAddress || null,
      userAgent: context.userAgent || null,
    });

    return { success: true, message: "Password updated successfully.", passwordHash };
  }

  try {
    const currentResult = await client.query("SELECT password_hash FROM users WHERE id = $1 LIMIT 1", [userId]);
    const currentRecord = currentResult.rows[0];

    if (!currentRecord || !bcrypt.compareSync(currentPassword, currentRecord.password_hash)) {
      return { success: false, message: "Current password is incorrect." };
    }

    const passwordHash = bcrypt.hashSync(newPassword, 10);
    await client.query(
      `UPDATE users
       SET password_hash = $1,
           updated_at = NOW()
       WHERE id = $2`,
      [passwordHash, userId]
    );

    await authModel.logEvent("password_changed", {
      userId,
      outcome: "success",
      ipAddress: context.ipAddress || null,
      userAgent: context.userAgent || null,
    });

    return { success: true, message: "Password updated successfully.", passwordHash };
  } finally {
    client.release();
  }
}

// Save communication preferences while leaving legal and security notices enabled.
async function updatePreferencesData(userId, preferences, context = {}) {
  const normalized = normalizePreferences(preferences);
  const client = await getClient();

  if (!client) {
    const existing = getLocalProfile(userId, context.currentUser || {});
    const updated = {
      ...existing,
      preferences: normalized,
    };
    localProfileStore.set(userId, updated);

    await authModel.logEvent("communication_preferences_updated", {
      userId,
      outcome: "success",
      ipAddress: context.ipAddress || null,
      userAgent: context.userAgent || null,
      preferences: normalized,
    });

    return { success: true, message: "Communication preferences updated.", data: normalized };
  }

  try {
    await client.query(
      `UPDATE users
       SET communication_preferences = $1,
           updated_at = NOW()
       WHERE id = $2`,
      [normalized, userId]
    );

    await authModel.logEvent("communication_preferences_updated", {
      userId,
      outcome: "success",
      ipAddress: context.ipAddress || null,
      userAgent: context.userAgent || null,
      preferences: normalized,
    });

    return { success: true, message: "Communication preferences updated.", data: normalized };
  } finally {
    client.release();
  }
}

// Create a pending contact-change request instead of replacing verified data immediately.
async function createContactChangeRequest(userId, requestData = {}, context = {}) {
  const contactType = requestData.contactType === "phone" ? "phone" : "email";
  const pendingValue = String(requestData.pendingValue || "").trim();

  if (!pendingValue) {
    return { success: false, message: `New ${contactType} is required.` };
  }

  const validationErrors = contactType === "email" ? validateEmail(pendingValue) : validatePhone(pendingValue);
  if (validationErrors.length > 0) {
    return { success: false, message: validationErrors.join(" ") };
  }

  const client = await getClient();
  const verificationToken = crypto.randomBytes(8).toString("hex").toUpperCase();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);

  if (!client) {
    const currentProfile = getLocalProfile(userId, context.currentUser || {});
    const currentValue = contactType === "email" ? currentProfile.email : currentProfile.phone;

    if (String(currentValue || "").toLowerCase() === pendingValue.toLowerCase()) {
      return { success: false, message: `That ${contactType} is already on your profile.` };
    }

    const request = {
      id: `${userId}-${Date.now()}`,
      userId,
      contactType,
      currentValue,
      pendingValue,
      verificationToken,
      status: "pending",
      requestedAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
    };
    localContactRequests.set(request.id, request);

    await authModel.logEvent("verified_contact_change_requested", {
      userId,
      outcome: "pending_verification",
      contactType,
      ipAddress: context.ipAddress || null,
      userAgent: context.userAgent || null,
    });

    return {
      success: true,
      message: `${contactType === "email" ? "Email address" : "Mobile number"} change request created. Verify it to replace the current verified contact.`,
      request: buildPendingRequestSummary(request),
    };
  }

  try {
    const userResult = await client.query("SELECT email, phone FROM users WHERE id = $1 LIMIT 1", [userId]);
    const userRecord = userResult.rows[0];
    const currentValue = contactType === "email" ? userRecord.email : userRecord.phone;

    if (String(currentValue || "").toLowerCase() === pendingValue.toLowerCase()) {
      return { success: false, message: `That ${contactType} is already on your profile.` };
    }

    if (contactType === "email") {
      const duplicateResult = await client.query("SELECT id FROM users WHERE lower(email) = lower($1) AND id <> $2 LIMIT 1", [pendingValue, userId]);
      if (duplicateResult.rows.length > 0) {
        return { success: false, message: "That email address is already in use." };
      }
    } else {
      const duplicateResult = await client.query("SELECT id FROM users WHERE phone = $1 AND id <> $2 LIMIT 1", [pendingValue, userId]);
      if (duplicateResult.rows.length > 0) {
        return { success: false, message: "That mobile number is already in use." };
      }
    }

    await client.query(
      `UPDATE profile_contact_change_requests
       SET status = 'superseded'
       WHERE user_id = $1 AND contact_type = $2 AND status = 'pending'`,
      [userId, contactType]
    );

    const requestResult = await client.query(
      `INSERT INTO profile_contact_change_requests(
         user_id,
         contact_type,
         current_value,
         pending_value,
         verification_token,
         status,
         expires_at,
         details
       ) VALUES($1,$2,$3,$4,$5,'pending',$6,$7)
       RETURNING *`,
      [
        userId,
        contactType,
        currentValue,
        pendingValue,
        verificationToken,
        expiresAt,
        {
          ipAddress: context.ipAddress || null,
          userAgent: context.userAgent || null,
        },
      ]
    );

    await authModel.logEvent("verified_contact_change_requested", {
      userId,
      outcome: "pending_verification",
      contactType,
      ipAddress: context.ipAddress || null,
      userAgent: context.userAgent || null,
    });

    return {
      success: true,
      message: `${contactType === "email" ? "Email address" : "Mobile number"} change request created. Verify it to replace the current verified contact.`,
      request: buildPendingRequestSummary(requestResult.rows[0]),
    };
  } finally {
    client.release();
  }
}

// Confirm a pending contact change and swap the verified email or mobile number.
async function confirmContactChange(userId, verificationToken, context = {}) {
  const token = String(verificationToken || "").trim().toUpperCase();

  if (!token) {
    return { success: false, message: "Verification code is required." };
  }

  const client = await getClient();

  if (!client) {
    const request = Array.from(localContactRequests.values()).find(
      (entry) => Number(entry.userId) === Number(userId) && entry.verificationToken === token && entry.status === "pending"
    );

    if (!request) {
      return { success: false, message: "Verification code is invalid or expired." };
    }

    if (new Date(request.expiresAt).getTime() < Date.now()) {
      request.status = "expired";
      return { success: false, message: "Verification code is invalid or expired." };
    }

    const profile = getLocalProfile(userId, context.currentUser || {});
    if (request.contactType === "email") {
      profile.email = request.pendingValue;
      profile.emailVerified = true;
    } else {
      profile.phone = request.pendingValue;
      profile.phoneVerified = true;
    }
    request.status = "verified";
    request.verifiedAt = new Date().toISOString();
    localProfileStore.set(userId, profile);

    await authModel.logEvent("verified_contact_change_completed", {
      userId,
      outcome: "success",
      contactType: request.contactType,
      ipAddress: context.ipAddress || null,
      userAgent: context.userAgent || null,
    });

    return { success: true, message: `${request.contactType === "email" ? "Email address" : "Mobile number"} updated successfully.`, profile };
  }

  try {
    const requestResult = await client.query(
      `SELECT *
       FROM profile_contact_change_requests
       WHERE user_id = $1 AND verification_token = $2 AND status = 'pending'
       LIMIT 1`,
      [userId, token]
    );
    const request = requestResult.rows[0];

    if (!request || new Date(request.expires_at).getTime() < Date.now()) {
      if (request) {
        await client.query("UPDATE profile_contact_change_requests SET status = 'expired' WHERE id = $1", [request.id]);
      }
      return { success: false, message: "Verification code is invalid or expired." };
    }

    if (request.contact_type === "email") {
      const duplicateResult = await client.query("SELECT id FROM users WHERE lower(email) = lower($1) AND id <> $2 LIMIT 1", [request.pending_value, userId]);
      if (duplicateResult.rows.length > 0) {
        return { success: false, message: "That email address is already in use." };
      }
    } else {
      const duplicateResult = await client.query("SELECT id FROM users WHERE phone = $1 AND id <> $2 LIMIT 1", [request.pending_value, userId]);
      if (duplicateResult.rows.length > 0) {
        return { success: false, message: "That mobile number is already in use." };
      }
    }

    const updateSql = request.contact_type === "email"
      ? `UPDATE users SET email = $1, email_verified = TRUE, updated_at = NOW() WHERE id = $2 RETURNING *`
      : `UPDATE users SET phone = $1, phone_verified = TRUE, updated_at = NOW() WHERE id = $2 RETURNING *`;
    const userResult = await client.query(updateSql, [request.pending_value, userId]);

    await client.query(
      `UPDATE profile_contact_change_requests
       SET status = 'verified',
           verified_at = NOW()
       WHERE id = $1`,
      [request.id]
    );

    await authModel.logEvent("verified_contact_change_completed", {
      userId,
      outcome: "success",
      contactType: request.contact_type,
      ipAddress: context.ipAddress || null,
      userAgent: context.userAgent || null,
    });

    return {
      success: true,
      message: `${request.contact_type === "email" ? "Email address" : "Mobile number"} updated successfully.`,
      profile: mapUserToProfile(userResult.rows[0]),
    };
  } finally {
    client.release();
  }
}

// Persist uploaded profile-photo metadata and clean up replaced files.
async function updateProfilePhotoData(userId, photoInfo, context = {}) {
  const client = await getClient();

  if (!client) {
    const existing = getLocalProfile(userId, context.currentUser || {});
    const updated = {
      ...existing,
      profilePhotoUrl: photoInfo.publicPath,
      profilePhotoMimeType: photoInfo.mimeType,
    };
    localProfileStore.set(userId, updated);

    await authModel.logEvent("profile_photo_changed", {
      userId,
      outcome: "success",
      ipAddress: context.ipAddress || null,
      userAgent: context.userAgent || null,
      fileName: photoInfo.fileName,
    });

    return { success: true, profile: updated };
  }

  try {
    const previousResult = await client.query("SELECT profile_photo_path FROM users WHERE id = $1 LIMIT 1", [userId]);
    const previousPath = previousResult.rows[0] ? previousResult.rows[0].profile_photo_path : null;

    const updateResult = await client.query(
      `UPDATE users
       SET profile_photo_path = $1,
           profile_photo_mime_type = $2,
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [photoInfo.publicPath, photoInfo.mimeType, userId]
    );

    if (previousPath && previousPath !== photoInfo.publicPath) {
      const previousDiskPath = path.join(__dirname, "..", "public", previousPath.replace(/^\//, ""));
      if (fs.existsSync(previousDiskPath)) {
        fs.unlinkSync(previousDiskPath);
      }
    }

    await authModel.logEvent("profile_photo_changed", {
      userId,
      outcome: "success",
      ipAddress: context.ipAddress || null,
      userAgent: context.userAgent || null,
      fileName: photoInfo.fileName,
    });

    return { success: true, profile: mapUserToProfile(updateResult.rows[0]) };
  } finally {
    client.release();
  }
}

// Remove the current profile photo from both storage and the user record.
async function removeProfilePhotoData(userId, context = {}) {
  const client = await getClient();

  if (!client) {
    const existing = getLocalProfile(userId, context.currentUser || {});
    if (existing.profilePhotoUrl) {
      const diskPath = path.join(__dirname, "..", "public", existing.profilePhotoUrl.replace(/^\//, ""));
      if (fs.existsSync(diskPath)) {
        fs.unlinkSync(diskPath);
      }
    }
    existing.profilePhotoUrl = "";
    existing.profilePhotoMimeType = "";
    localProfileStore.set(userId, existing);

    await authModel.logEvent("profile_photo_removed", {
      userId,
      outcome: "success",
      ipAddress: context.ipAddress || null,
      userAgent: context.userAgent || null,
    });

    return { success: true, profile: existing };
  }

  try {
    const existingResult = await client.query("SELECT profile_photo_path FROM users WHERE id = $1 LIMIT 1", [userId]);
    const existingPath = existingResult.rows[0] ? existingResult.rows[0].profile_photo_path : null;

    const updateResult = await client.query(
      `UPDATE users
       SET profile_photo_path = NULL,
           profile_photo_mime_type = NULL,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [userId]
    );

    if (existingPath) {
      const diskPath = path.join(__dirname, "..", "public", existingPath.replace(/^\//, ""));
      if (fs.existsSync(diskPath)) {
        fs.unlinkSync(diskPath);
      }
    }

    await authModel.logEvent("profile_photo_removed", {
      userId,
      outcome: "success",
      ipAddress: context.ipAddress || null,
      userAgent: context.userAgent || null,
    });

    return { success: true, profile: mapUserToProfile(updateResult.rows[0]) };
  } finally {
    client.release();
  }
}

// Delete a selected non-current session for the user.
async function terminateSessionById(userId, sessionId, currentSessionId, context = {}) {
  if (!sessionId) {
    return { success: false, message: "A session identifier is required." };
  }

  if (sessionId === currentSessionId) {
    return { success: false, message: "Use the standard logout action to end the current session." };
  }

  const client = await getClient();

  if (!client) {
    return { success: false, message: "Session management requires database-backed sessions." };
  }

  try {
    const result = await client.query(
      `DELETE FROM session
       WHERE sid = $1
         AND COALESCE(sess->>'userId', sess->'sessionMeta'->>'userId', sess->'user'->>'id') = $2`,
      [sessionId, String(userId)]
    );

    if (result.rowCount === 0) {
      return { success: false, message: "The selected session could not be terminated." };
    }

    await authModel.logEvent("session_terminated", {
      userId,
      outcome: "success",
      targetSessionId: sessionId,
      ipAddress: context.ipAddress || null,
      userAgent: context.userAgent || null,
    });

    return { success: true, message: "Session terminated successfully." };
  } finally {
    client.release();
  }
}

// Delete every session except the current one for the user.
async function terminateOtherSessions(userId, currentSessionId, context = {}) {
  const client = await getClient();

  if (!client) {
    return { success: false, message: "Session management requires database-backed sessions." };
  }

  try {
    const result = await client.query(
      `DELETE FROM session
       WHERE sid <> $1
         AND COALESCE(sess->>'userId', sess->'sessionMeta'->>'userId', sess->'user'->>'id') = $2`,
      [currentSessionId, String(userId)]
    );

    await authModel.logEvent("other_sessions_terminated", {
      userId,
      outcome: "success",
      terminatedCount: result.rowCount,
      ipAddress: context.ipAddress || null,
      userAgent: context.userAgent || null,
    });

    return {
      success: true,
      message: result.rowCount > 0 ? "All other sessions were terminated." : "No other active sessions were found.",
    };
  } finally {
    client.release();
  }
}

module.exports = {
  getDefaultPreferences,
  getProfileDashboard,
  updateProfileData,
  updatePasswordData,
  updatePreferencesData,
  createContactChangeRequest,
  confirmContactChange,
  updateProfilePhotoData,
  removeProfilePhotoData,
  terminateSessionById,
  terminateOtherSessions,
  profileUploadDirectory,
};
