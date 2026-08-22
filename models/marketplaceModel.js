/* ******************************************
 * marketplaceModel.js - Marketplace listing lifecycle, pricing, visibility, and audit support for ACC Chapter 17.
 * Provides a lightweight in-memory marketplace engine for product and service listings.
 *******************************************/
const fs = require("fs");
const path = require("path");

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
    minPrice: Number(record.minPrice || 0),
    maxPrice: Number(record.maxPrice || 0),
    currency: record.currency || "USD",
    inventory: Number(record.inventory || 0),
    availability: record.availability || (record.type === "product" ? "in_stock" : "available"),
    visibility: (record.visibility || "public").toLowerCase(),
    location: record.location || "",
    media: Array.isArray(record.media) ? record.media : [],
    tags: Array.isArray(record.tags) ? record.tags : [],
    status: (record.status || "active").toLowerCase(),
    createdAt: record.createdAt || new Date().toISOString(),
    updatedAt: record.updatedAt || record.createdAt || new Date().toISOString(),
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

  fallbackListings.push(listing);
  logMarketplaceAudit("listing_created", { listingId: listing.id, userId, businessId, title, visibility, outcome: "success" });

  return {
    success: true,
    listing: normalizeListing(listing),
    message: "Listing created successfully.",
  };
}

async function updateListing(userId, listingId, payload = {}) {
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
  const listing = fallbackListings.find((entry) => Number(entry.id) === Number(listingId) && entry.status !== "deleted");
  return listing ? normalizeListing(listing) : null;
}

async function getBusinessListings(businessId) {
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
