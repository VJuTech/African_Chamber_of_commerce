/* ******************************************
 * marketplaceModel.js - Marketplace listing lifecycle, pricing, visibility, and audit support for ACC Chapter 17.
 * Provides a lightweight in-memory marketplace engine for product and service listings.
 *******************************************/
const fs = require("fs");
const path = require("path");
const pool = require("../database/connection");

const auditLogPath = path.join(__dirname, "..", "logs", "marketplace-audit.log");
fs.mkdirSync(path.dirname(auditLogPath), { recursive: true });

const fallbackListings = [
  {
    id: 1,
    businessId: 1,
    userId: 1,
    title: "Organic Coffee Beans",
    description: "Premium roasted coffee beans for cafés, hotels, and wholesale buyers across East Africa.",
    category: "Agriculture",
    type: "product",
    pricingModel: "fixed",
    price: 24.5,
    minPrice: 0,
    maxPrice: 0,
    currency: "USD",
    inventory: 120,
    availability: "in_stock",
    visibility: "public",
    location: "Nairobi, Kenya",
    media: ["coffee-hero.png"],
    tags: ["coffee", "organic", "wholesale"],
    status: "active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 2,
    businessId: 2,
    userId: 2,
    title: "Cross-Border Freight Consultancy",
    description: "Strategic logistics advisory for SMEs exporting goods across regional ports and borders.",
    category: "Logistics",
    type: "service",
    pricingModel: "negotiable",
    price: 0,
    minPrice: 350,
    maxPrice: 1200,
    currency: "USD",
    inventory: 0,
    availability: "available",
    visibility: "public",
    location: "Lagos, Nigeria",
    media: ["logistics-consulting.png"],
    tags: ["logistics", "consulting"],
    status: "active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const fallbackAuditLog = [];

function logMarketplaceAudit(eventType, details = {}) {
  const entry = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    eventType,
    timestamp: new Date().toISOString(),
    details,
  };

  fallbackAuditLog.push(entry);
  fs.appendFileSync(auditLogPath, `${JSON.stringify(entry)}\n`);
  return entry;
}

function normalizeListing(record = {}) {
  return {
    id: Number(record.id),
    businessId: Number(record.businessId || record.business_id || 0),
    userId: Number(record.userId || record.user_id || 0),
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
  const businessId = Number(payload.businessId || userId || 1);

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

  const listing = {
    id: fallbackListings.length + 1,
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

  try {
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
    logMarketplaceAudit("listing_created", { listingId: persistedListing.id, userId, businessId, title, visibility, outcome: "success" });
    return { success: true, listing: persistedListing, message: "Listing created successfully." };
  } catch (error) {
    // Keep the local fallback for development environments without PostgreSQL.
    fallbackListings.push(listing);
    logMarketplaceAudit("listing_created", { listingId: listing.id, userId, businessId, title, visibility, outcome: "fallback" });
    return { success: true, listing: normalizeListing(listing), message: "Listing created successfully in fallback mode." };
  }
}

async function updateListing(userId, listingId, payload = {}) {
  try {
    const existingResult = await pool.query(
      "SELECT * FROM marketplace_listings WHERE id = $1 AND status <> 'deleted' LIMIT 1",
      [listingId]
    );
    if (existingResult.rows.length === 0) return { success: false, message: "Listing not found." };

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
    const updatedListing = normalizeListing(result.rows[0]);
    logMarketplaceAudit("listing_updated", { listingId: updatedListing.id, userId, businessId: updatedListing.businessId, outcome: "success" });
    return { success: true, listing: updatedListing, message: "Listing updated successfully." };
  } catch (error) {
    // Use the existing local implementation when PostgreSQL is unavailable.
  }

  const listing = fallbackListings.find((entry) => Number(entry.id) === Number(listingId));

  if (!listing) {
    return { success: false, message: "Listing not found." };
  }

  if (Number(listing.userId) !== Number(userId)) {
    return { success: false, message: "You can only update your own listings." };
  }

  const nextTitle = typeof payload.title !== "undefined" ? String(payload.title || "").trim() : listing.title;
  const nextDescription = typeof payload.description !== "undefined" ? String(payload.description || "").trim() : listing.description;
  const nextCategory = typeof payload.category !== "undefined" ? String(payload.category || "").trim() : listing.category;
  const nextType = typeof payload.type !== "undefined" ? String(payload.type || "product").trim().toLowerCase() : listing.type;

  if (!nextTitle || !nextDescription || !nextCategory) {
    return { success: false, message: "Title, description, and category are required." };
  }

  listing.title = nextTitle;
  listing.description = nextDescription;
  listing.category = nextCategory;
  listing.type = nextType;
  listing.pricingModel = typeof payload.pricingModel !== "undefined" ? String(payload.pricingModel || "fixed").trim().toLowerCase() : listing.pricingModel;
  listing.price = typeof payload.price !== "undefined" ? Number(payload.price || 0) : listing.price;
  listing.minPrice = typeof payload.minPrice !== "undefined" ? Number(payload.minPrice || 0) : listing.minPrice;
  listing.maxPrice = typeof payload.maxPrice !== "undefined" ? Number(payload.maxPrice || 0) : listing.maxPrice;
  listing.currency = typeof payload.currency !== "undefined" ? String(payload.currency || "USD").trim().toUpperCase() : listing.currency;
  listing.inventory = typeof payload.inventory !== "undefined" ? Number(payload.inventory || 0) : listing.inventory;
  listing.availability = typeof payload.availability !== "undefined" ? String(payload.availability || "available").trim().toLowerCase() : listing.availability;
  listing.visibility = typeof payload.visibility !== "undefined" ? String(payload.visibility || "public").trim().toLowerCase() : listing.visibility;
  listing.location = typeof payload.location !== "undefined" ? String(payload.location || "").trim() : listing.location;
  listing.tags = typeof payload.tags !== "undefined" && Array.isArray(payload.tags) ? payload.tags : listing.tags;
  listing.media = typeof payload.media !== "undefined" ? (Array.isArray(payload.media) ? payload.media : [payload.media]) : listing.media;
  listing.updatedAt = new Date().toISOString();

  logMarketplaceAudit("listing_updated", { listingId: listing.id, userId, businessId: listing.businessId, outcome: "success" });

  return {
    success: true,
    listing: normalizeListing(listing),
    message: "Listing updated successfully.",
  };
}

async function deleteListing(userId, listingId) {
  try {
    const result = await pool.query(
      `UPDATE marketplace_listings SET status = 'deleted', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND user_id = $2 AND status <> 'deleted' RETURNING id, business_id`,
      [listingId, userId]
    );
    if (result.rows.length === 0) return { success: false, message: "Listing not found or you do not have permission to delete it." };
    logMarketplaceAudit("listing_deleted", { listingId, userId, businessId: result.rows[0].business_id, outcome: "success" });
    return { success: true, message: "Listing removed successfully." };
  } catch (error) {
    // Use the existing local implementation when PostgreSQL is unavailable.
  }

  const listing = fallbackListings.find((entry) => Number(entry.id) === Number(listingId));

  if (!listing) {
    return { success: false, message: "Listing not found." };
  }

  if (Number(listing.userId) !== Number(userId)) {
    return { success: false, message: "You can only delete your own listings." };
  }

  listing.status = "deleted";
  listing.updatedAt = new Date().toISOString();

  logMarketplaceAudit("listing_deleted", { listingId: listing.id, userId, businessId: listing.businessId, outcome: "success" });

  return {
    success: true,
    message: "Listing removed successfully.",
  };
}

async function getMarketplaceListings(filters = {}) {
  const page = Number(filters.page || 1);
  const limit = Number(filters.limit || 10);
  const keyword = String(filters.keyword || "").trim().toLowerCase();
  const type = String(filters.type || "all").trim().toLowerCase();
  const category = String(filters.category || "").trim();
  const visibility = String(filters.visibility || "public").trim().toLowerCase();

  try {
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
    if (total > 0) {
      return { listings: result.rows.map(normalizeListing), total, page: safePage, limit, totalPages };
    }
    // Preserve the existing demo fallback only when PostgreSQL has no matching rows.
    // Persisted records remain authoritative whenever they exist.
  } catch (error) {
    // Use the existing local implementation when PostgreSQL is unavailable.
  }

  let records = fallbackListings.filter((entry) => entry.status !== "deleted" && (visibility === "all" || entry.visibility === visibility));

  if (type && type !== "all") {
    records = records.filter((entry) => (entry.type || "product").toLowerCase() === type);
  }

  if (category) {
    records = records.filter((entry) => (entry.category || "").toLowerCase().includes(category.toLowerCase()));
  }

  if (keyword) {
    records = records.filter((entry) => {
      const haystack = `${entry.title} ${entry.description} ${entry.category} ${entry.tags.join(" ")}`.toLowerCase();
      return haystack.includes(keyword);
    });
  }

  const total = records.length;
  const totalPages = Math.max(1, Math.ceil(total / Math.max(limit, 1)));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const startIndex = (safePage - 1) * limit;
  const listings = records.slice(startIndex, startIndex + limit).map((record) => normalizeListing(record));

  return {
    listings,
    total,
    page: safePage,
    limit,
    totalPages,
  };
}

async function getListingById(listingId) {
  try {
    const result = await pool.query(
      "SELECT * FROM marketplace_listings WHERE id = $1 AND status <> 'deleted' LIMIT 1",
      [listingId]
    );
    return result.rows.length ? normalizeListing(result.rows[0]) : null;
  } catch (error) {
    // Use the existing local implementation when PostgreSQL is unavailable.
  }

  const listing = fallbackListings.find((entry) => Number(entry.id) === Number(listingId) && entry.status !== "deleted");
  return listing ? normalizeListing(listing) : null;
}

async function getBusinessListings(businessId) {
  try {
    const result = await pool.query(
      "SELECT * FROM marketplace_listings WHERE business_id = $1 AND status <> 'deleted' ORDER BY created_at DESC",
      [businessId]
    );
    return result.rows.map(normalizeListing);
  } catch (error) {
    // Use the existing local implementation when PostgreSQL is unavailable.
  }

  const records = fallbackListings.filter(
    (entry) => Number(entry.businessId) === Number(businessId) && entry.status !== "deleted"
  );

  return records.map((entry) => normalizeListing(entry));
}

async function getListingAuditLog() {
  return [...fallbackAuditLog];
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
  fallbackListings,
};
