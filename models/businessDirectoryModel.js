const fs = require("fs");
const path = require("path");
const pool = require("../database/connection");

const directoryAuditLogPath = path.join(__dirname, "..", "logs", "business-directory-audit.log");
const directoryAnalyticsLogPath = path.join(__dirname, "..", "logs", "business-directory-analytics.log");
fs.mkdirSync(path.dirname(directoryAuditLogPath), { recursive: true });
fs.mkdirSync(path.dirname(directoryAnalyticsLogPath), { recursive: true });

const fallbackDirectory = [
  {
    id: 1,
    businessName: "ACC Demo Holding",
    industryCategory: "Trade Facilitation",
    countryOfRegistration: "Nigeria",
    stateRegion: "Lagos",
    businessType: "Limited Liability Company (LLC)",
    verificationStatus: "verified",
    logo: "",
    businessDescription: "A regional trade facilitation business supporting commerce and market access across Africa.",
    membershipLevel: "Enterprise",
    viewCount: 245,
    updatedAt: new Date().toISOString(),
    active: true,
  },
  {
    id: 2,
    businessName: "Nile Agro Export",
    industryCategory: "Agribusiness",
    countryOfRegistration: "Kenya",
    stateRegion: "Nairobi",
    businessType: "Sole Proprietorship",
    verificationStatus: "pending",
    logo: "",
    businessDescription: "Agricultural export business focused on fresh produce and regional supply chains.",
    membershipLevel: "Premium",
    viewCount: 96,
    updatedAt: new Date().toISOString(),
    active: true,
  },
  {
    id: 3,
    businessName: "Sahara Logistics Group",
    industryCategory: "Logistics",
    countryOfRegistration: "Ghana",
    stateRegion: "Accra",
    businessType: "Partnership",
    verificationStatus: "verified",
    logo: "",
    businessDescription: "Regional logistics and warehousing provider serving industrial clients across West Africa.",
    membershipLevel: "Enterprise",
    viewCount: 174,
    updatedAt: new Date().toISOString(),
    active: true,
  },
];

function logDirectoryActivity(eventType, details = {}) {
  const entry = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    eventType,
    timestamp: new Date().toISOString(),
    details,
  };

  fs.appendFileSync(directoryAuditLogPath, `${JSON.stringify(entry)}\n`);
  return entry;
}

function logSearchAnalytics(details = {}) {
  const entry = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    timestamp: new Date().toISOString(),
    details,
  };

  fs.appendFileSync(directoryAnalyticsLogPath, `${JSON.stringify(entry)}\n`);
  return entry;
}

function normalizeListing(record = {}) {
  return {
    id: record.id,
    businessName: record.business_name || record.businessName || "",
    industryCategory: record.industry_category || record.industryCategory || "",
    countryOfRegistration: record.country_of_registration || record.countryOfRegistration || "",
    stateRegion: record.state_region || record.stateRegion || "",
    businessType: record.business_type || record.businessType || "",
    verificationStatus: record.verification_status || record.verificationStatus || "pending",
    logo: record.logo || "",
    businessDescription: record.business_description || record.businessDescription || "",
    membershipLevel: record.membership_level || record.membershipLevel || "Basic",
    viewCount: Number(record.view_count || record.viewCount || 0),
    updatedAt: record.updated_at || record.updatedAt || new Date().toISOString(),
    isVerified: Boolean(record.is_verified ?? (record.verification_status === "verified" || record.verificationStatus === "verified")),
    active: record.active !== false,
  };
}

function buildSearchQuery(filters = {}, keyword = "") {
  const conditions = [];
  const values = [];
  let index = 1;

  if (keyword && String(keyword).trim()) {
    conditions.push(`(
      lower(COALESCE(b.business_name, '')) LIKE $${index} OR
      lower(COALESCE(b.business_description, '')) LIKE $${index} OR
      lower(COALESCE(b.industry_category, '')) LIKE $${index} OR
      lower(COALESCE(b.business_type, '')) LIKE $${index}
    )`);
    values.push(`%${String(keyword).trim().toLowerCase()}%`);
    index += 1;
  }

  if (filters.country) {
    conditions.push(`lower(COALESCE(b.country_of_registration, '')) = lower($${index})`);
    values.push(String(filters.country).trim());
    index += 1;
  }

  if (filters.industry) {
    conditions.push(`lower(COALESCE(b.industry_category, '')) = lower($${index})`);
    values.push(String(filters.industry).trim());
    index += 1;
  }

  if (filters.businessType) {
    conditions.push(`lower(COALESCE(b.business_type, '')) = lower($${index})`);
    values.push(String(filters.businessType).trim());
    index += 1;
  }

  if (filters.verificationStatus) {
    conditions.push(`lower(COALESCE(b.verification_status, '')) = lower($${index})`);
    values.push(String(filters.verificationStatus).trim());
    index += 1;
  }

  return {
    whereClause: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "",
    values,
  };
}

async function getDirectoryListings(options = {}) {
  const page = Number(options.page || 1);
  const limit = Number(options.limit || 10);
  const offset = (page - 1) * limit;
  const keyword = options.keyword || "";
  const filters = options.filters || {};
  const sort = options.sort || "relevance";

  try {
    const { whereClause, values } = buildSearchQuery(filters, keyword);
    const sortClause =
      sort === "alphabetical"
        ? "ORDER BY b.business_name ASC"
        : sort === "most_recent"
          ? "ORDER BY b.updated_at DESC"
          : sort === "most_viewed"
            ? "ORDER BY COALESCE(b.view_count, 0) DESC"
            : "ORDER BY CASE WHEN b.verification_status = 'verified' THEN 0 ELSE 1 END, COALESCE(b.view_count, 0) DESC, b.updated_at DESC";

    const countQuery = `SELECT COUNT(*)::int AS total FROM business_accounts b ${whereClause}`;
    const countResult = await pool.query(countQuery, values);

    const query = `
      SELECT b.*
      FROM business_accounts b
      ${whereClause}
      ${sortClause}
      LIMIT $${values.length + 1} OFFSET $${values.length + 2}
    `;

    const dataResult = await pool.query(query, [...values, limit, offset]);
    const listings = dataResult.rows.map(normalizeListing);

    return {
      listings,
      total: countResult.rows[0]?.total || 0,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil((countResult.rows[0]?.total || 0) / limit)),
    };
  } catch (error) {
    const filtered = fallbackDirectory.filter((item) => {
      const haystack = `${item.businessName} ${item.businessDescription} ${item.industryCategory} ${item.businessType}`.toLowerCase();
      const keywordMatch = !keyword || haystack.includes(String(keyword).toLowerCase());
      const countryMatch = !filters.country || item.countryOfRegistration.toLowerCase() === String(filters.country).toLowerCase();
      const industryMatch = !filters.industry || item.industryCategory.toLowerCase() === String(filters.industry).toLowerCase();
      const typeMatch = !filters.businessType || item.businessType.toLowerCase() === String(filters.businessType).toLowerCase();
      const verificationMatch = !filters.verificationStatus || item.verificationStatus.toLowerCase() === String(filters.verificationStatus).toLowerCase();
      return keywordMatch && countryMatch && industryMatch && typeMatch && verificationMatch;
    });

    const sortedListings = [...filtered].sort((a, b) => {
      if (sort === "alphabetical") return a.businessName.localeCompare(b.businessName);
      if (sort === "most_recent") return new Date(b.updatedAt) - new Date(a.updatedAt);
      if (sort === "most_viewed") return (b.viewCount || 0) - (a.viewCount || 0);
      return (b.isVerified ? 1 : 0) - (a.isVerified ? 1 : 0) || (b.viewCount || 0) - (a.viewCount || 0);
    });

    const sliced = sortedListings.slice(offset, offset + limit);
    return {
      listings: sliced.map(normalizeListing),
      total: filtered.length,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(filtered.length / limit)),
    };
  }
}

async function searchBusinesses(keyword, filters = {}, options = {}) {
  const normalizedKeyword = String(keyword || "").trim();
  const directory = await getDirectoryListings({
    keyword: normalizedKeyword,
    filters,
    page: options.page || 1,
    limit: options.limit || 10,
    sort: options.sort || "relevance",
  });

  logSearchAnalytics({
    keyword: normalizedKeyword,
    filters,
    resultsCount: directory.total,
    sort: options.sort || "relevance",
  });

  if (directory.listings.length === 0) {
    logDirectoryActivity("search_no_results", { keyword: normalizedKeyword, filters, outcome: "empty" });
    return {
      success: true,
      message: "No results found. Try expanding your search or adjusting your filters.",
      ...directory,
      listings: [],
    };
  }

  logDirectoryActivity("search_results_returned", { keyword: normalizedKeyword, filters, resultsCount: directory.total, outcome: "success" });
  return {
    success: true,
    ...directory,
  };
}

async function getBusinessDirectoryEntry(businessId) {
  if (!businessId) return null;

  try {
    const result = await pool.query(`SELECT * FROM business_accounts WHERE id = $1 LIMIT 1`, [businessId]);
    if (result.rows.length > 0) {
      const listing = normalizeListing(result.rows[0]);
      logDirectoryActivity("directory_profile_viewed", { businessId, outcome: "success" });
      return listing;
    }
  } catch (error) {
    // Fallback below.
  }

  const listing = fallbackDirectory.find((item) => Number(item.id) === Number(businessId));
  if (listing) {
    logDirectoryActivity("directory_profile_viewed", { businessId, outcome: "fallback" });
    return normalizeListing(listing);
  }

  return null;
}

module.exports = {
  getDirectoryListings,
  searchBusinesses,
  getBusinessDirectoryEntry,
  logDirectoryActivity,
  logSearchAnalytics,
};
