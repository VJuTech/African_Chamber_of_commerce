const pool = require("../database/connection");
async function logDirectoryActivity(eventType, details = {}) {
  const result = await pool.query(
    "INSERT INTO business_audit_logs (user_id, business_id, event_type, outcome, details) VALUES ($1, $2, $3, $4, $5) RETURNING id, event_type, outcome, details, created_at",
    [details.userId || null, details.businessId || null, eventType, details.outcome || "success", details]
  );
  const row = result.rows[0];
  return { id: String(row.id), eventType: row.event_type, outcome: row.outcome, timestamp: new Date(row.created_at).toISOString(), details: row.details || {} };
}

async function logSearchAnalytics(details = {}) {
  const result = await pool.query(
    "INSERT INTO business_directory_search_logs(user_id, keyword, filters, results_count) VALUES($1,$2,$3,$4) RETURNING id, created_at",
    [details.userId || null, details.keyword || null, details.filters || {}, details.resultsCount || 0]
  );
  return { id: String(result.rows[0].id), timestamp: new Date(result.rows[0].created_at).toISOString(), details };
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
    throw error;
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

  await logSearchAnalytics({
    keyword: normalizedKeyword,
    filters,
    resultsCount: directory.total,
    sort: options.sort || "relevance",
  });

  if (directory.listings.length === 0) {
    await logDirectoryActivity("search_no_results", { keyword: normalizedKeyword, filters, outcome: "empty" });
    return {
      success: true,
      message: "No results found. Try expanding your search or adjusting your filters.",
      ...directory,
      listings: [],
    };
  }

  await logDirectoryActivity("search_results_returned", { keyword: normalizedKeyword, filters, resultsCount: directory.total, outcome: "success" });
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
      await logDirectoryActivity("directory_profile_viewed", { businessId, outcome: "success" });
      return listing;
    }
  } catch (error) {
    throw error;
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
