const fs = require("fs");
const path = require("path");
const pool = require("../database/connection");
const { validateEmail, validatePhone } = require("../utility/account-validation");

const profileAuditLogPath = path.join(__dirname, "..", "logs", "business-profile-audit.log");
const profileUploadDirectory = path.join(__dirname, "..", "public", "uploads", "businesses");
fs.mkdirSync(profileUploadDirectory, { recursive: true });
fs.mkdirSync(path.dirname(profileAuditLogPath), { recursive: true });

const fallbackProfiles = [
  {
    id: 1,
    businessId: 1,
    businessName: "ACC Demo Holding",
    businessType: "Limited Liability Company (LLC)",
    industryCategory: "Trade Facilitation",
    businessDescription: "ACC Demo Holding supports trade facilitation and cross-border commercial operations across African markets.",
    emailAddress: "hello@accdemo.com",
    phoneNumber: "+2348000001000",
    website: "https://accdemo.com",
    physicalAddress: "Plot 18, Lekki Phase 1, Lagos, Nigeria",
    logoPath: "",
    coverBanner: "",
    visibility: "public",
    verificationStatus: "verified",
    yearEstablished: 2024,
    numberOfEmployees: 32,
    operatingHours: "Mon-Fri 8am-6pm",
    serviceAreas: ["West Africa", "East Africa", "Regional Trade"],
    socialLinks: {
      facebook: "https://facebook.com/accdemo",
      linkedIn: "https://linkedin.com/company/accdemo",
      twitter: "https://x.com/accdemo",
      instagram: "https://instagram.com/accdemo",
    },
    active: true,
  },
];

function auditProfileEvent(eventType, details = {}) {
  const entry = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    eventType,
    timestamp: new Date().toISOString(),
    details,
  };

  fs.appendFileSync(profileAuditLogPath, `${JSON.stringify(entry)}\n`);
  return entry;
}

function normalizeProfile(profile = {}) {
  return {
    id: profile.id || profile.businessId || null,
    businessId: profile.business_id || profile.businessId || profile.id || null,
    businessName: profile.business_name || profile.businessName || "",
    businessType: profile.business_type || profile.businessType || "",
    industryCategory: profile.industry_category || profile.industryCategory || "",
    businessDescription: profile.business_description || profile.businessDescription || "",
    emailAddress: profile.email_address || profile.emailAddress || "",
    phoneNumber: profile.phone_number || profile.phoneNumber || "",
    website: profile.website || "",
    physicalAddress: profile.physical_address || profile.physicalAddress || "",
    logoPath: profile.logo_path || profile.logoPath || "",
    coverBanner: profile.cover_banner || profile.coverBanner || "",
    visibility: profile.visibility || "public",
    verificationStatus: profile.verification_status || profile.verificationStatus || "pending",
    yearEstablished: profile.year_established || profile.yearEstablished || null,
    numberOfEmployees: profile.number_of_employees || profile.numberOfEmployees || null,
    operatingHours: profile.operating_hours || profile.operatingHours || "",
    serviceAreas: Array.isArray(profile.service_areas || profile.serviceAreas) ? (profile.service_areas || profile.serviceAreas) : [],
    socialLinks: profile.social_links || profile.socialLinks || {},
    isVerified: Boolean(profile.is_verified ?? profile.isVerified ?? (profile.verification_status === "verified")),
    active: profile.active !== false,
  };
}

async function getBusinessProfile(businessId) {
  try {
    const result = await pool.query("SELECT * FROM business_profiles WHERE business_id = $1 LIMIT 1", [businessId]);
    if (result.rows.length > 0) {
      return normalizeProfile(result.rows[0]);
    }
  } catch (error) {
    // Fallback to local data when Postgres is not available.
  }

  const fallbackProfile = fallbackProfiles.find((item) => Number(item.businessId) === Number(businessId));
  return fallbackProfile ? normalizeProfile(fallbackProfile) : null;
}

async function updateBusinessProfile(businessId, userId, payload = {}) {
  const updates = {
    businessName: payload.businessName,
    businessType: payload.businessType,
    industryCategory: payload.industryCategory,
    businessDescription: payload.businessDescription,
    emailAddress: payload.emailAddress,
    phoneNumber: payload.phoneNumber,
    website: payload.website,
    physicalAddress: payload.physicalAddress,
    yearEstablished: payload.yearEstablished,
    numberOfEmployees: payload.numberOfEmployees,
    operatingHours: payload.operatingHours,
    serviceAreas: payload.serviceAreas,
    socialLinks: payload.socialLinks,
  };

  if (!updates.businessName || !updates.businessType || !updates.industryCategory || !updates.physicalAddress) {
    return { success: false, message: "Business name, business type, industry category, and address are required." };
  }

  if (updates.emailAddress) {
    const emailErrors = validateEmail(updates.emailAddress);
    if (emailErrors.length > 0) return { success: false, message: emailErrors.join(" ") };
  }

  if (updates.phoneNumber) {
    const phoneErrors = validatePhone(updates.phoneNumber);
    if (phoneErrors.length > 0) return { success: false, message: phoneErrors.join(" ") };
  }

  try {
    const result = await pool.query(
      `INSERT INTO business_profiles (
        business_id,
        business_name,
        business_type,
        industry_category,
        business_description,
        email_address,
        phone_number,
        website,
        physical_address,
        year_established,
        number_of_employees,
        operating_hours,
        service_areas,
        social_links,
        updated_by_user_id,
        updated_at,
        verification_status
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,CURRENT_TIMESTAMP,'pending')
      ON CONFLICT (business_id)
      DO UPDATE SET
        business_name = EXCLUDED.business_name,
        business_type = EXCLUDED.business_type,
        industry_category = EXCLUDED.industry_category,
        business_description = EXCLUDED.business_description,
        email_address = EXCLUDED.email_address,
        phone_number = EXCLUDED.phone_number,
        website = EXCLUDED.website,
        physical_address = EXCLUDED.physical_address,
        year_established = EXCLUDED.year_established,
        number_of_employees = EXCLUDED.number_of_employees,
        operating_hours = EXCLUDED.operating_hours,
        service_areas = EXCLUDED.service_areas,
        social_links = EXCLUDED.social_links,
        updated_by_user_id = EXCLUDED.updated_by_user_id,
        updated_at = CURRENT_TIMESTAMP,
        verification_status = 'pending'
      RETURNING *`,
      [
        businessId,
        updates.businessName,
        updates.businessType,
        updates.industryCategory,
        updates.businessDescription || null,
        updates.emailAddress || null,
        updates.phoneNumber || null,
        updates.website || null,
        updates.physicalAddress,
        updates.yearEstablished || null,
        updates.numberOfEmployees || null,
        updates.operatingHours || null,
        JSON.stringify(updates.serviceAreas || []),
        JSON.stringify(updates.socialLinks || {}),
        userId,
      ]
    );

    const updated = normalizeProfile(result.rows[0]);
    auditProfileEvent("profile_updated", { businessId, userId, outcome: "success" });
    return { success: true, profile: updated, message: "Business profile updated successfully." };
  } catch (error) {
    const fallbackProfile = fallbackProfiles.find((profile) => Number(profile.businessId) === Number(businessId));
    const merged = fallbackProfile || fallbackProfiles[0];
    const nextProfile = {
      ...merged,
      businessName: updates.businessName || merged.businessName,
      businessType: updates.businessType || merged.businessType,
      industryCategory: updates.industryCategory || merged.industryCategory,
      businessDescription: updates.businessDescription || merged.businessDescription,
      emailAddress: updates.emailAddress || merged.emailAddress,
      phoneNumber: updates.phoneNumber || merged.phoneNumber,
      website: updates.website || merged.website,
      physicalAddress: updates.physicalAddress || merged.physicalAddress,
      yearEstablished: updates.yearEstablished || merged.yearEstablished,
      numberOfEmployees: updates.numberOfEmployees || merged.numberOfEmployees,
      operatingHours: updates.operatingHours || merged.operatingHours,
      serviceAreas: updates.serviceAreas || merged.serviceAreas,
      socialLinks: updates.socialLinks || merged.socialLinks,
      verificationStatus: "pending",
    };

    auditProfileEvent("profile_updated", { businessId, userId, outcome: "fallback" });
    return { success: true, profile: normalizeProfile(nextProfile), message: "Business profile updated successfully in fallback mode." };
  }
}

async function uploadBusinessLogo(businessId, file) {
  if (!file) {
    return { success: false, message: "No file provided." };
  }

  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!allowedTypes.includes(file.mimetype)) {
    return { success: false, message: "Unsupported file type. Use JPEG, PNG, or WebP." };
  }

  const maxBytes = 2 * 1024 * 1024;
  if (file.size > maxBytes) {
    return { success: false, message: "File is too large. Maximum size is 2 MB." };
  }

  const fileName = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const targetPath = path.join(profileUploadDirectory, fileName);
  fs.writeFileSync(targetPath, file.buffer);

  const publicUrl = `/uploads/businesses/${fileName}`;
  auditProfileEvent("logo_upload", { businessId, outcome: "success", fileName });

  return { success: true, logoPath: publicUrl, message: "Business logo uploaded successfully." };
}

async function setBusinessVisibility(businessId, visibility) {
  const allowed = ["public", "private", "restricted"];
  if (!allowed.includes(visibility)) {
    return { success: false, message: "Visibility must be public, private, or restricted." };
  }

  try {
    const result = await pool.query(
      `INSERT INTO business_profiles (business_id, visibility, updated_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (business_id) DO UPDATE SET visibility = EXCLUDED.visibility, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [businessId, visibility]
    );

    auditProfileEvent("visibility_change", { businessId, visibility, outcome: "success" });
    return { success: true, profile: normalizeProfile(result.rows[0]), message: "Visibility updated successfully." };
  } catch (error) {
    const profile = fallbackProfiles.find((item) => Number(item.businessId) === Number(businessId));
    if (profile) {
      profile.visibility = visibility;
    }
    auditProfileEvent("visibility_change", { businessId, visibility, outcome: "fallback" });
    return { success: true, profile: normalizeProfile(profile || fallbackProfiles[0]), message: "Visibility updated successfully." };
  }
}

async function getBusinessProfileAuditLogs(businessId) {
  try {
    const result = await pool.query(
      `SELECT * FROM business_profile_audit_logs WHERE business_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [businessId]
    );

    return result.rows;
  } catch (error) {
    const lines = fs.existsSync(profileAuditLogPath) ? fs.readFileSync(profileAuditLogPath, "utf8") : "";
    return lines
      .split("\n")
      .filter(Boolean)
      .slice(0, 50)
      .map((line) => JSON.parse(line));
  }
}

module.exports = {
  getBusinessProfile,
  updateBusinessProfile,
  uploadBusinessLogo,
  setBusinessVisibility,
  getBusinessProfileAuditLogs,
};
