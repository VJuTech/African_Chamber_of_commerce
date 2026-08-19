const fs = require("fs");
const path = require("path");
const pool = require("../database/connection");
const { validateBusinessPayload } = require("../utility/account-validation");

// Notification messages are stored in a separate log so Chapter 10 can support
// both email delivery and in-app notifications without needing a mailbox service.
const businessAuditLogPath = path.join(__dirname, "..", "logs", "business-audit.log");
const businessNotificationLogPath = path.join(__dirname, "..", "logs", "business-notifications.log");
fs.mkdirSync(path.dirname(businessAuditLogPath), { recursive: true });
fs.mkdirSync(path.dirname(businessNotificationLogPath), { recursive: true });

const inMemoryBusinesses = [];

// This helper records registration, verification, duplicate, and lifecycle events
// for audit and compliance monitoring.
function logBusinessAudit(eventType, details = {}) {
  const entry = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    eventType,
    timestamp: new Date().toISOString(),
    details,
  };

  fs.appendFileSync(businessAuditLogPath, `${JSON.stringify(entry)}\n`);
  return entry;
}

// In-app/Email notifications are persisted to a dedicated log so the app can act
// as event-driven even before a formal mail provider is connected.
function sendBusinessRegistrationNotification(userId, businessName, channel = "email", status = "registered") {
  const entry = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    userId,
    businessName,
    channel,
    status,
    createdAt: new Date().toISOString(),
  };

  fs.appendFileSync(businessNotificationLogPath, `${JSON.stringify(entry)}\n`);
  return entry;
}

function normalizeBusinessRecord(record = {}) {
  return {
    id: record.id,
    businessName: record.business_name || record.businessName || "",
    businessType: record.business_type || record.businessType || "",
    countryOfRegistration: record.country_of_registration || record.countryOfRegistration || "",
    businessAddress: record.business_address || record.businessAddress || "",
    contactEmail: record.contact_email || record.contactEmail || "",
    contactPhone: record.contact_phone || record.contactPhone || "",
    industryCategory: record.industry_category || record.industryCategory || "",
    registrationNumber: record.registration_number || record.registrationNumber || "",
    taxIdentificationNumber: record.tax_identification_number || record.taxIdentificationNumber || "",
    website: record.website || "",
    businessDescription: record.business_description || record.businessDescription || "",
    logo: record.logo || "",
    status: record.status || "draft",
    ownerId: record.owner_id || record.ownerId || null,
    ownershipRole: record.ownership_role || record.ownershipRole || "Business Owner",
    createdAt: record.created_at || record.createdAt || new Date().toISOString(),
    updatedAt: record.updated_at || record.updatedAt || new Date().toISOString(),
  };
}

async function createBusiness(userId, payload = {}) {
  // ACC-FRS-BIZ-001 through ACC-FRS-BIZ-004: start, validate, prevent duplicates,
  // and assign ownership immediately to the creating user.
  const businessPayload = {
    businessName: payload.businessName,
    businessType: payload.businessType,
    countryOfRegistration: payload.countryOfRegistration,
    businessAddress: payload.businessAddress,
    contactEmail: payload.contactEmail,
    contactPhone: payload.contactPhone,
    industryCategory: payload.industryCategory,
    registrationNumber: payload.registrationNumber,
    taxIdentificationNumber: payload.taxIdentificationNumber,
    website: payload.website,
    businessDescription: payload.businessDescription,
    logo: payload.logo,
    ownerId: userId,
  };

  const validationErrors = validateBusinessPayload(businessPayload);
  if (validationErrors.length > 0) {
    return { success: false, message: validationErrors.join(" ") };
  }

  const duplicateCheck = await findBusinessByNameAndCountry(
    businessPayload.businessName,
    businessPayload.countryOfRegistration,
    userId
  );

  if (duplicateCheck) {
    logBusinessAudit("duplicate_business_attempt", {
      userId,
      businessName: businessPayload.businessName,
      country: businessPayload.countryOfRegistration,
      outcome: "rejected",
    });
    return { success: false, message: "A business with the same name and country already exists." };
  }

  if (businessPayload.registrationNumber) {
    const existingRegistration = await findBusinessByRegistrationNumber(businessPayload.registrationNumber);
    if (existingRegistration) {
      logBusinessAudit("duplicate_business_attempt", {
        userId,
        registrationNumber: businessPayload.registrationNumber,
        outcome: "rejected",
      });
      return { success: false, message: "That registration number is already in use." };
    }
  }

  try {
    const result = await pool.query(
      `INSERT INTO business_accounts (
        business_name,
        business_type,
        country_of_registration,
        business_address,
        contact_email,
        contact_phone,
        industry_category,
        registration_number,
        tax_identification_number,
        website,
        business_description,
        logo,
        status,
        owner_id,
        ownership_role,
        created_at,
        updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
      RETURNING *`,
      [
        businessPayload.businessName,
        businessPayload.businessType,
        businessPayload.countryOfRegistration,
        businessPayload.businessAddress,
        businessPayload.contactEmail,
        businessPayload.contactPhone,
        businessPayload.industryCategory,
        businessPayload.registrationNumber || null,
        businessPayload.taxIdentificationNumber || null,
        businessPayload.website || null,
        businessPayload.businessDescription || null,
        businessPayload.logo || null,
        "draft",
        userId,
        "Business Owner",
      ]
    );

    const createdBusiness = normalizeBusinessRecord(result.rows[0]);
    logBusinessAudit("registration_started", {
      userId,
      businessId: createdBusiness.id,
      businessName: createdBusiness.businessName,
      outcome: "started",
    });
    logBusinessAudit("registration_submitted", {
      userId,
      businessId: createdBusiness.id,
      businessName: createdBusiness.businessName,
      outcome: "submitted",
    });
    sendBusinessRegistrationNotification(userId, createdBusiness.businessName, "email", "registered");
    sendBusinessRegistrationNotification(userId, createdBusiness.businessName, "in-app", "registered");

    return {
      success: true,
      message: "Business registration created successfully.",
      business: createdBusiness,
    };
  } catch (error) {
    const inMemoryBusiness = {
      id: inMemoryBusinesses.length + 1,
      business_name: businessPayload.businessName,
      business_type: businessPayload.businessType,
      country_of_registration: businessPayload.countryOfRegistration,
      business_address: businessPayload.businessAddress,
      contact_email: businessPayload.contactEmail,
      contact_phone: businessPayload.contactPhone,
      industry_category: businessPayload.industryCategory,
      registration_number: businessPayload.registrationNumber || null,
      tax_identification_number: businessPayload.taxIdentificationNumber || null,
      website: businessPayload.website || null,
      business_description: businessPayload.businessDescription || null,
      logo: businessPayload.logo || null,
      status: "draft",
      owner_id: userId,
      ownership_role: "Business Owner",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    inMemoryBusinesses.push(inMemoryBusiness);
    logBusinessAudit("registration_started", {
      userId,
      businessName: businessPayload.businessName,
      outcome: "fallback",
    });
    sendBusinessRegistrationNotification(userId, businessPayload.businessName, "email", "registered");
    sendBusinessRegistrationNotification(userId, businessPayload.businessName, "in-app", "registered");
    return {
      success: true,
      message: "Business registration created successfully in fallback mode.",
      business: normalizeBusinessRecord(inMemoryBusiness),
    };
  }
}

async function findBusinessByNameAndCountry(businessName, country, userId = null) {
  if (!businessName || !country) return null;

  try {
    const result = await pool.query(
      `SELECT * FROM business_accounts WHERE lower(business_name) = lower($1) AND lower(country_of_registration) = lower($2) LIMIT 1`,
      [String(businessName).trim(), String(country).trim()]
    );

    if (result.rows.length > 0) {
      return normalizeBusinessRecord(result.rows[0]);
    }
  } catch (error) {
    // Fallback to memory store for local-only demo mode.
  }

  return inMemoryBusinesses.find((business) => {
    if (userId && Number(business.owner_id) === Number(userId)) {
      return false;
    }

    return String(business.business_name || "").trim().toLowerCase() === String(businessName).trim().toLowerCase() &&
      String(business.country_of_registration || "").trim().toLowerCase() === String(country).trim().toLowerCase();
  }) || null;
}

async function findBusinessByRegistrationNumber(registrationNumber) {
  if (!registrationNumber) return null;

  try {
    const result = await pool.query(
      `SELECT * FROM business_accounts WHERE registration_number = $1 LIMIT 1`,
      [String(registrationNumber).trim()]
    );

    if (result.rows.length > 0) {
      return normalizeBusinessRecord(result.rows[0]);
    }
  } catch (error) {
    // Accept memory fallback below.
  }

  return inMemoryBusinesses.find((business) => String(business.registration_number || "").trim() === String(registrationNumber).trim()) || null;
}

async function getUserBusinesses(userId) {
  try {
    const result = await pool.query(
      `SELECT * FROM business_accounts WHERE owner_id = $1 ORDER BY created_at DESC`,
      [userId]
    );

    return result.rows.map(normalizeBusinessRecord);
  } catch (error) {
    return inMemoryBusinesses
      .filter((business) => Number(business.owner_id) === Number(userId))
      .map((business) => normalizeBusinessRecord(business));
  }
}

async function submitBusinessForVerification(userId, businessId) {
  // ACC-FRS-BIZ-007: owners may submit the record for verification, which triggers
  // the review workflow required by the business-account lifecycle.
  try {
    const result = await pool.query(
      `UPDATE business_accounts SET status = 'pending', verification_status = 'submitted', updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND owner_id = $2 RETURNING *`,
      [businessId, userId]
    );

    if (result.rows.length === 0) {
      return { success: false, message: "Business not found or you do not have permission to submit it." };
    }

    logBusinessAudit("verification_submission", {
      userId,
      businessId,
      outcome: "submitted",
    });
    sendBusinessRegistrationNotification(userId, result.rows[0].business_name, "email", "verification_submitted");
    sendBusinessRegistrationNotification(userId, result.rows[0].business_name, "in-app", "verification_submitted");

    return {
      success: true,
      message: "Business submitted for verification.",
      business: normalizeBusinessRecord(result.rows[0]),
    };
  } catch (error) {
    const index = inMemoryBusinesses.findIndex((business) => Number(business.id) === Number(businessId) && Number(business.owner_id) === Number(userId));
    if (index === -1) {
      return { success: false, message: "Business not found or you do not have permission to submit it." };
    }

    inMemoryBusinesses[index].status = "pending";
    logBusinessAudit("verification_submission", {
      userId,
      businessId,
      outcome: "submitted",
    });
    sendBusinessRegistrationNotification(userId, inMemoryBusinesses[index].business_name, "email", "verification_submitted");
    sendBusinessRegistrationNotification(userId, inMemoryBusinesses[index].business_name, "in-app", "verification_submitted");

    return {
      success: true,
      message: "Business submitted for verification.",
      business: normalizeBusinessRecord(inMemoryBusinesses[index]),
    };
  }
}

async function addBusinessAdministrator(businessId, userId, role = "Administrator") {
  // ACC-FRS-BIZ-005: A business owner can grant access to other users in the same
  // organization, with either Administrator or Staff privileges.
  try {
    const result = await pool.query(
      `INSERT INTO business_administrators (business_id, user_id, role, status, invited_at, accepted_at)
       VALUES ($1, $2, $3, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (business_id, user_id) DO UPDATE SET role = EXCLUDED.role, status = 'active', accepted_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [businessId, userId, role]
    );

    logBusinessAudit("administrator_added", {
      businessId,
      userId,
      role,
      outcome: "success",
    });

    return { success: true, administrator: result.rows[0] };
  } catch (error) {
    const fallback = {
      business_id: Number(businessId),
      user_id: Number(userId),
      role,
      status: "active",
    };

    logBusinessAudit("administrator_added", {
      businessId,
      userId,
      role,
      outcome: "fallback",
    });

    return { success: true, administrator: fallback };
  }
}

async function updateBusinessStatus(businessId, userId, newStatus, reason = "") {
  // ACC-FRS-BIZ-006: status changes are the core lifecycle control for draft,
  // pending, verified, rejected, and suspended business records.
  const allowed = ["draft", "pending", "verified", "rejected", "suspended"];
  if (!allowed.includes(newStatus)) {
    return { success: false, message: "Invalid business status." };
  }

  try {
    const result = await pool.query(
      `UPDATE business_accounts SET status = $1, verification_notes = COALESCE($2, verification_notes), updated_at = CURRENT_TIMESTAMP WHERE id = $3 AND owner_id = $4 RETURNING *`,
      [newStatus, reason || null, businessId, userId]
    );

    if (result.rows.length === 0) {
      return { success: false, message: "Business not found or you are not allowed to update it." };
    }

    logBusinessAudit("business_status_updated", {
      businessId,
      userId,
      newStatus,
      reason,
      outcome: "success",
    });

    return { success: true, business: normalizeBusinessRecord(result.rows[0]) };
  } catch (error) {
    const index = inMemoryBusinesses.findIndex((item) => Number(item.id) === Number(businessId) && Number(item.owner_id) === Number(userId));
    if (index === -1) {
      return { success: false, message: "Business not found or you are not allowed to update it." };
    }

    inMemoryBusinesses[index].status = newStatus;
    logBusinessAudit("business_status_updated", {
      businessId,
      userId,
      newStatus,
      reason,
      outcome: "fallback",
    });

    return { success: true, business: normalizeBusinessRecord(inMemoryBusinesses[index]) };
  }
}

async function getBusinessAuditLogs(businessId) {
  try {
    const result = await pool.query(
      `SELECT * FROM business_audit_logs WHERE business_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [businessId]
    );

    return result.rows;
  } catch (error) {
    return [];
  }
}

async function saveBusinessDraft(userId, payload = {}) {
  const draftingPayload = {
    businessName: payload.businessName,
    businessType: payload.businessType,
    countryOfRegistration: payload.countryOfRegistration,
    businessAddress: payload.businessAddress,
    contactEmail: payload.contactEmail,
    contactPhone: payload.contactPhone,
    industryCategory: payload.industryCategory,
    registrationNumber: payload.registrationNumber,
    taxIdentificationNumber: payload.taxIdentificationNumber,
    website: payload.website,
    businessDescription: payload.businessDescription,
    logo: payload.logo,
  };

  const validationErrors = validateBusinessPayload(draftingPayload);
  if (validationErrors.length > 0) {
    return { success: false, message: validationErrors.join(" ") };
  }

  const draft = {
    id: inMemoryBusinesses.length + 1,
    business_name: draftingPayload.businessName,
    business_type: draftingPayload.businessType,
    country_of_registration: draftingPayload.countryOfRegistration,
    business_address: draftingPayload.businessAddress,
    contact_email: draftingPayload.contactEmail,
    contact_phone: draftingPayload.contactPhone,
    industry_category: draftingPayload.industryCategory,
    registration_number: draftingPayload.registrationNumber || null,
    tax_identification_number: draftingPayload.taxIdentificationNumber || null,
    website: draftingPayload.website || null,
    business_description: draftingPayload.businessDescription || null,
    logo: draftingPayload.logo || null,
    status: "draft",
    owner_id: userId,
    ownership_role: "Business Owner",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  inMemoryBusinesses.push(draft);
  logBusinessAudit("registration_draft_saved", {
    userId,
    businessName: draftingPayload.businessName,
    outcome: "saved",
  });

  return {
    success: true,
    message: "Business draft saved successfully.",
    business: normalizeBusinessRecord(draft),
  };
}

module.exports = {
  createBusiness,
  getUserBusinesses,
  submitBusinessForVerification,
  saveBusinessDraft,
  addBusinessAdministrator,
  updateBusinessStatus,
  getBusinessAuditLogs,
  findBusinessByNameAndCountry,
  findBusinessByRegistrationNumber,
  logBusinessAudit,
  sendBusinessRegistrationNotification,
};
