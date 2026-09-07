const pool = require("../database/connection");
const notificationModel = require("./notificationModel");
const { validateBusinessPayload } = require("../utility/account-validation");

// This helper records registration, verification, duplicate, and lifecycle events
// for audit and compliance monitoring.
async function logBusinessAudit(eventType, details = {}) {
  const result = await pool.query(
    "INSERT INTO business_audit_logs (user_id, business_id, event_type, outcome, details) VALUES ($1, $2, $3, $4, $5) RETURNING id, event_type, outcome, details, created_at",
    [details.userId || null, details.businessId || null, eventType, details.outcome || "success", details]
  );
  const row = result.rows[0];
  return { id: String(row.id), eventType: row.event_type, outcome: row.outcome, timestamp: new Date(row.created_at).toISOString(), details: row.details || {} };
}

async function sendBusinessRegistrationNotification(userId, businessName, channel = "email", status = "registered") {
  const result = await notificationModel.generateNotification({
    userId,
    type: "system",
    title: `Business registration ${status.replace(/_/g, " ")}`,
    message: `${businessName} registration status: ${status.replace(/_/g, " ")}.`,
    eventKey: `business_registration:${status}:${channel}`,
    dedupeKey: `business_registration:${userId}:${businessName}:${status}:${channel}`,
  });
  const notification = result.notification;
  return {
    id: notification ? notification.id : null,
    userId,
    businessName,
    channel,
    status,
    createdAt: notification ? notification.createdAt : new Date().toISOString(),
  };
}

function normalizeBusinessRecord(record = {}) {
  return {
    id: record.id,
    businessName: record.business_name || record.businessName || "",
    businessType: record.business_type || record.businessType || "",
    countryOfResidence: record.country_of_residence || record.countryOfResidence || "",
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
    countryOfResidence: payload.countryOfResidence,
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
    await logBusinessAudit("duplicate_business_attempt", {
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
      await logBusinessAudit("duplicate_business_attempt", {
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
        country_of_residence,
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
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
      RETURNING *`,
      [
        businessPayload.businessName,
        businessPayload.businessType,
        businessPayload.countryOfResidence,
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
    await logBusinessAudit("registration_started", {
      userId,
      businessId: createdBusiness.id,
      businessName: createdBusiness.businessName,
      outcome: "started",
    });
    await logBusinessAudit("registration_submitted", {
      userId,
      businessId: createdBusiness.id,
      businessName: createdBusiness.businessName,
      outcome: "submitted",
    });
    await sendBusinessRegistrationNotification(userId, createdBusiness.businessName, "email", "registered");
    await sendBusinessRegistrationNotification(userId, createdBusiness.businessName, "in-app", "registered");

    return {
      success: true,
      message: "Business registration created successfully.",
      business: createdBusiness,
    };
  } catch (error) {
    console.error("Business registration persistence failed:", error.message || error);
    return { success: false, message: "Failed to create business registration." };
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
  } catch (error) { return null; }
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
  } catch (error) { return null; }
}

async function getUserBusinesses(userId) {
  try {
    const result = await pool.query(
      `SELECT * FROM business_accounts WHERE owner_id = $1 ORDER BY created_at DESC`,
      [userId]
    );

    return result.rows.map(normalizeBusinessRecord);
  } catch (error) { return []; }
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

    await logBusinessAudit("verification_submission", {
      userId,
      businessId,
      outcome: "submitted",
    });
    await sendBusinessRegistrationNotification(userId, result.rows[0].business_name, "email", "verification_submitted");
    await sendBusinessRegistrationNotification(userId, result.rows[0].business_name, "in-app", "verification_submitted");

    return {
      success: true,
      message: "Business submitted for verification.",
      business: normalizeBusinessRecord(result.rows[0]),
    };
  } catch (error) { return { success: false, message: "Failed to submit business for verification." }; }
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

    await logBusinessAudit("administrator_added", {
      businessId,
      userId,
      role,
      outcome: "success",
    });

    return { success: true, administrator: result.rows[0] };
  } catch (error) { return { success: false, message: "Failed to add business administrator." }; }
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

    await logBusinessAudit("business_status_updated", {
      businessId,
      userId,
      newStatus,
      reason,
      outcome: "success",
    });

    return { success: true, business: normalizeBusinessRecord(result.rows[0]) };
  } catch (error) { return { success: false, message: "Failed to update business status." }; }
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

  const result = await pool.query(`INSERT INTO business_accounts (business_name,business_type,country_of_residence,country_of_registration,business_address,contact_email,contact_phone,industry_category,registration_number,tax_identification_number,website,business_description,logo,status,owner_id,ownership_role,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'draft',$14,'Business Owner',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) RETURNING *`, [draftingPayload.businessName,draftingPayload.businessType,draftingPayload.countryOfResidence || "",draftingPayload.countryOfRegistration,draftingPayload.businessAddress,draftingPayload.contactEmail,draftingPayload.contactPhone,draftingPayload.industryCategory,draftingPayload.registrationNumber || null,draftingPayload.taxIdentificationNumber || null,draftingPayload.website || null,draftingPayload.businessDescription || null,draftingPayload.logo || null,userId]);
  const draft = result.rows[0];
  await logBusinessAudit("registration_draft_saved", {
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
