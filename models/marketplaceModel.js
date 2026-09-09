/* ******************************************
 * marketplaceModel.js - Marketplace listing lifecycle, pricing, visibility, and audit support for ACC Chapter 17.
 * Provides PostgreSQL-backed marketplace listing lifecycle, pricing, visibility, and audit support.
 *******************************************/
const path = require("path");
const pool = require("../database/connection");

async function logMarketplaceAudit(eventType, details = {}) {
  const result = await pool.query(
    `INSERT INTO marketplace_audit_logs (
       listing_id, user_id, business_id, event_type, outcome, details
     ) VALUES ($1, $2, $3, $4, $5, $6::jsonb)
     RETURNING id, event_type, created_at, details`,
    [details.listingId || null, details.userId || null, details.businessId || null,
      eventType, details.outcome || null, JSON.stringify(details)]
  );
  const auditEntry = result.rows[0];
  return {
    id: auditEntry.id,
    eventType: auditEntry.event_type,
    timestamp: auditEntry.created_at,
    details: auditEntry.details || {},
  };
}

function normalizeListing(record = {}) {
  return {
    id: Number(record.id),
    businessId: Number(record.businessId || record.business_id || 0),
    userId: Number(record.userId || record.user_id || 0),
    sellerId: Number(record.sellerId || record.seller_id || record.userId || record.user_id || 0),
    title: record.title || "Untitled listing",
    description: record.description || "",
    category: record.category || "General",
    type: (record.type || "product").toLowerCase(),
    pricingModel: (record.pricingModel || record.pricing_model || "fixed").toLowerCase(),
    price: Number(record.price || 0),
    minPrice: Number(record.minPrice || record.min_price || 0),
    maxPrice: Number(record.maxPrice || record.max_price || 0),
    currency: record.currency || "USD",
    inventory: Number(record.inventory || 0),
    availability: record.availability || (record.type === "product" ? "in_stock" : "available"),
    visibility: (record.visibility || "public").toLowerCase(),
    location: record.location || "",
    media: Array.isArray(record.media) ? record.media : [],
    tags: Array.isArray(record.tags) ? record.tags : [],
    status: (record.status || "active").toLowerCase(),
    createdAt: record.createdAt || record.created_at || new Date().toISOString(),
    updatedAt: record.updatedAt || record.updated_at || record.created_at || new Date().toISOString(),
  };
}

function validateMediaUpload(mediaEntries = []) {
  const mediaList = Array.isArray(mediaEntries) ? mediaEntries : [mediaEntries].filter(Boolean);
  const allowedExtensions = [".jpg", ".jpeg", ".png"];
  const maxSizeBytes = 2 * 1024 * 1024;

  for (const entry of mediaList) {
    if (typeof entry === "string" && /^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(entry)) {
      const encodedBytes = Buffer.byteLength(entry.slice(entry.indexOf(",") + 1), "base64");
      if (encodedBytes > maxSizeBytes) {
        return {
          success: false,
          message: "Listing media must be 2MB or smaller.",
        };
      }
      continue;
    }

    const sourceName = entry && entry.originalname ? entry.originalname : String(entry || "");
    const fileSize = entry && entry.size ? Number(entry.size) : 0;
    const extension = path.extname(sourceName || "").toLowerCase();

    if (!sourceName || !allowedExtensions.includes(extension)) {
      return {
        success: false,
        message: "Listing media must be a JPEG or PNG image file.",
      };
    }

    if (fileSize > maxSizeBytes) {
      return {
        success: false,
        message: "Listing media must be 2MB or smaller.",
      };
    }
  }

  return { success: true, media: mediaList.map((item) => String(item.originalname || item || "").trim()).filter(Boolean) };
}

async function createListing(userId, payload = {}) {
  const title = String(payload.title || "").trim();
  const description = String(payload.description || "").trim();
  const category = String(payload.category || "").trim();
  const type = String(payload.type || "product").trim().toLowerCase();
  const pricingModel = String(payload.pricingModel || payload.pricing_model || "fixed").trim().toLowerCase();
  const price = Number(payload.price || 0);
  const currency = String(payload.currency || "USD").trim().toUpperCase();
  const visibility = String(payload.visibility || "public").trim().toLowerCase();
  const location = String(payload.location || "").trim();
  let businessId = Number(payload.businessId || 0);

  if (!title || !description || !category) {
    return { success: false, message: "Title, description, and category are required." };
  }

  if (!['product', 'service'].includes(type)) {
    return { success: false, message: "Listing type must be product or service." };
  }

  if (!["fixed", "negotiable", "range"].includes(pricingModel)) {
    return { success: false, message: "Pricing model must be fixed, negotiable, or range." };
  }

  const mediaCheck = validateMediaUpload(Array.isArray(payload.media) ? payload.media : []);
  if (!mediaCheck.success) {
    return mediaCheck;
  }

  const businessResult = await pool.query(
    `SELECT ba.id
     FROM business_accounts ba
     LEFT JOIN business_administrators administrator
       ON administrator.business_id = ba.id AND administrator.user_id = $1
     WHERE (ba.id = $2 AND (ba.owner_id = $1 OR administrator.user_id IS NOT NULL))
        OR ba.owner_id = $1
        OR administrator.user_id IS NOT NULL
     ORDER BY CASE WHEN ba.id = $2 THEN 0 ELSE 1 END, ba.id
     LIMIT 1`,
    [userId, businessId]
  );

  if (businessResult.rows.length === 0) {
    return {
      success: false,
      message: "Create or select an authorized business profile before creating a marketplace listing.",
    };
  }

  businessId = Number(businessResult.rows[0].id);

  const listing = {
    id: null,
    businessId,
    userId: Number(userId || 1),
    title,
    description,
    category,
    type,
    pricingModel,
    price,
    minPrice: Number(payload.minPrice || 0),
    maxPrice: Number(payload.maxPrice || 0),
    currency,
    inventory: Number(payload.inventory || 0),
    availability: String(payload.availability || (type === "product" ? "in_stock" : "available")).trim().toLowerCase(),
    visibility,
    location,
    media: mediaCheck.media.length ? mediaCheck.media : (Array.isArray(payload.media) ? payload.media : []),
    tags: Array.isArray(payload.tags) ? payload.tags : [],
    status: "active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const result = await pool.query(
    `INSERT INTO marketplace_listings (
        business_id, user_id, title, description, category, listing_type, pricing_model,
        price, min_price, max_price, currency, inventory, availability, visibility,
        location, media, tags, status, created_at, updated_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb,$17::jsonb,'active',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
    RETURNING *`,
    [businessId, userId, title, description, category, type, pricingModel, price,
      listing.minPrice, listing.maxPrice, currency, listing.inventory, listing.availability,
      visibility, location, JSON.stringify(listing.media), JSON.stringify(listing.tags)]
  );
  const persistedListing = normalizeListing(result.rows[0]);
  await logMarketplaceAudit("listing_created", { listingId: persistedListing.id, userId, businessId, title, visibility, outcome: "success" });
  return { success: true, listing: persistedListing, message: "Listing created successfully." };
}

async function updateListing(userId, listingId, payload = {}) {
  const existingResult = await pool.query(
    "SELECT * FROM marketplace_listings WHERE id = $1 AND status <> 'deleted' LIMIT 1",
    [listingId]
  );
  if (existingResult.rows.length === 0) {
    return { success: false, message: "Listing not found." };
  }

  const existing = normalizeListing(existingResult.rows[0]);
  if (Number(existing.userId) !== Number(userId)) {
    return { success: false, message: "You can only update your own listings." };
  }

  const next = {
    ...existing,
    title: typeof payload.title !== "undefined" ? String(payload.title || "").trim() : existing.title,
    description: typeof payload.description !== "undefined" ? String(payload.description || "").trim() : existing.description,
    category: typeof payload.category !== "undefined" ? String(payload.category || "").trim() : existing.category,
    type: typeof payload.type !== "undefined" ? String(payload.type || "product").trim().toLowerCase() : existing.type,
    pricingModel: typeof payload.pricingModel !== "undefined" ? String(payload.pricingModel || "fixed").trim().toLowerCase() : existing.pricingModel,
    price: typeof payload.price !== "undefined" ? Number(payload.price || 0) : existing.price,
    minPrice: typeof payload.minPrice !== "undefined" ? Number(payload.minPrice || 0) : existing.minPrice,
    maxPrice: typeof payload.maxPrice !== "undefined" ? Number(payload.maxPrice || 0) : existing.maxPrice,
    currency: typeof payload.currency !== "undefined" ? String(payload.currency || "USD").trim().toUpperCase() : existing.currency,
    inventory: typeof payload.inventory !== "undefined" ? Number(payload.inventory || 0) : existing.inventory,
    availability: typeof payload.availability !== "undefined" ? String(payload.availability || "available").trim().toLowerCase() : existing.availability,
    visibility: typeof payload.visibility !== "undefined" ? String(payload.visibility || "public").trim().toLowerCase() : existing.visibility,
    location: typeof payload.location !== "undefined" ? String(payload.location || "").trim() : existing.location,
    tags: typeof payload.tags !== "undefined" && Array.isArray(payload.tags) ? payload.tags : existing.tags,
    media: typeof payload.media !== "undefined" ? (Array.isArray(payload.media) ? payload.media : [payload.media]) : existing.media,
  };

  if (!next.title || !next.description || !next.category) {
    return { success: false, message: "Title, description, and category are required." };
  }

  const result = await pool.query(
    `UPDATE marketplace_listings SET title=$1, description=$2, category=$3, listing_type=$4,
      pricing_model=$5, price=$6, min_price=$7, max_price=$8, currency=$9, inventory=$10,
      availability=$11, visibility=$12, location=$13, media=$14::jsonb, tags=$15::jsonb,
      updated_at=CURRENT_TIMESTAMP WHERE id=$16 AND user_id=$17 RETURNING *`,
    [next.title, next.description, next.category, next.type, next.pricingModel, next.price,
      next.minPrice, next.maxPrice, next.currency, next.inventory, next.availability,
      next.visibility, next.location, JSON.stringify(next.media), JSON.stringify(next.tags), listingId, userId]
  );
  if (result.rows.length === 0) {
    return { success: false, message: "Listing not found." };
  }

  const updatedListing = normalizeListing(result.rows[0]);
  await logMarketplaceAudit("listing_updated", { listingId: updatedListing.id, userId, businessId: updatedListing.businessId, outcome: "success" });
  return { success: true, listing: updatedListing, message: "Listing updated successfully." };
}

async function deleteListing(userId, listingId) {
  const result = await pool.query(
    `UPDATE marketplace_listings SET status = 'deleted', updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND user_id = $2 AND status <> 'deleted' RETURNING id, business_id`,
    [listingId, userId]
  );
  if (result.rows.length === 0) {
    return { success: false, message: "Listing not found." };
  }

  await logMarketplaceAudit("listing_deleted", { listingId, userId, businessId: result.rows[0].business_id, outcome: "success" });
  return { success: true, message: "Listing removed successfully." };
}

async function getMarketplaceListings(filters = {}) {
  const page = Number(filters.page || 1);
  const limit = Number(filters.limit || 10);
  const keyword = String(filters.keyword || "").trim().toLowerCase();
  const type = String(filters.type || "all").trim().toLowerCase();
  const category = String(filters.category || "").trim();
  const visibility = String(filters.visibility || "public").trim().toLowerCase();

  const values = [];
  const conditions = ["status <> 'deleted'"];
  if (visibility !== "all") {
    values.push(visibility);
    conditions.push(`visibility = $${values.length}`);
  }
  if (type && type !== "all") {
    values.push(type);
    conditions.push(`listing_type = $${values.length}`);
  }
  if (category) {
    values.push(`%${category}%`);
    conditions.push(`category ILIKE $${values.length}`);
  }
  if (keyword) {
    values.push(`%${keyword}%`);
    conditions.push(`(title ILIKE $${values.length} OR description ILIKE $${values.length} OR category ILIKE $${values.length} OR tags::text ILIKE $${values.length})`);
  }

  const countResult = await pool.query(`SELECT COUNT(*)::int AS total FROM marketplace_listings WHERE ${conditions.join(" AND ")}`, values);
  const total = countResult.rows[0].total;
  const totalPages = Math.max(1, Math.ceil(total / Math.max(limit, 1)));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  values.push(limit, (safePage - 1) * limit);
  const result = await pool.query(
    `SELECT * FROM marketplace_listings WHERE ${conditions.join(" AND ")} ORDER BY created_at DESC LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );
  return { listings: result.rows.map(normalizeListing), total, page: safePage, limit, totalPages };
}

async function getListingById(listingId) {
  const result = await pool.query(
    `SELECT marketplace_listings.*, business_accounts.owner_id AS seller_id
     FROM marketplace_listings
     JOIN business_accounts ON business_accounts.id = marketplace_listings.business_id
     WHERE marketplace_listings.id = $1 AND marketplace_listings.status <> 'deleted' LIMIT 1`,
    [listingId]
  );
  return result.rows.length ? normalizeListing(result.rows[0]) : null;
}

async function getBusinessListings(userId) {
  const result = await pool.query(
    `SELECT * FROM marketplace_listings
     WHERE (user_id = $1 OR business_id = $1) AND status <> 'deleted'
     ORDER BY created_at DESC`,
    [userId]
  );
  return result.rows.map(normalizeListing);
}

async function getListingAuditLog() {
  const result = await pool.query(
    `SELECT id, event_type, created_at, details
     FROM marketplace_audit_logs
     ORDER BY created_at DESC, id DESC`
  );
  return result.rows.map((entry) => ({
    id: entry.id,
    eventType: entry.event_type,
    timestamp: entry.created_at,
    details: entry.details || {},
  }));
}

module.exports = {
  createListing,
  updateListing,
  deleteListing,
  getMarketplaceListings,
  getListingById,
  getBusinessListings,
  validateMediaUpload,
  getListingAuditLog,
};
