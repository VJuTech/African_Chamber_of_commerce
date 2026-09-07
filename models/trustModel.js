/* ******************************************
 * trustModel.js - Reviews, ratings, moderation, trust scoring, and audit logging for ACC Chapter 16.
 * Uses PostgreSQL for business credibility, review validation, moderation, and audit records.
 *******************************************/
const pool = require("../database/connection");

async function logTrustAudit(eventType, details = {}) {
  const result = await pool.query(`INSERT INTO trust_audit_logs (business_id, user_id, event_type, outcome, details) VALUES ($1, $2, $3, $4, $5) RETURNING *`, [details.businessId || null, details.userId || details.adminUserId || details.businessUserId || null, eventType, details.outcome || "success", details]);
  return result.rows[0];
}

function normalizeReview(record = {}) {
  return {
    id: Number(record.id),
    businessId: Number(record.business_id || record.businessId),
    userId: Number(record.user_id || record.userId),
    rating: Number(record.rating || 0),
    title: record.title || "",
    comments: record.comments || "",
    categories: record.categories || {},
    status: record.status || "pending",
    createdAt: record.created_at || record.createdAt || null,
    updatedAt: record.updated_at || record.updatedAt || null,
    response: record.response || "",
    responseBy: record.response_by || record.responseBy || null,
    responseAt: record.response_at || record.responseAt || null,
    flagged: Boolean(record.flagged),
    flagReason: record.flag_reason || record.flagReason || "",
    moderationNote: record.moderation_note || record.moderationNote || "",
  };
}

function calculateTrustScore(reviews, verificationStatus = "unverified") {
  const avgRating = reviews.length ? reviews.reduce((sum, item) => sum + Number(item.rating || 0), 0) / reviews.length : 0;
  const reviewVolume = reviews.length;
  const verificationBonus = verificationStatus === "verified" ? 20 : 0;
  const complaintResolution = 75;
  const baseScore = (avgRating / 5) * 65 + (Math.min(reviewVolume, 25) / 25) * 15 + (complaintResolution / 100) * 20 + verificationBonus / 100 * 20;

  return Math.min(100, Math.max(0, Number(baseScore.toFixed(1))));
}

async function submitReview(userId, businessId, payload = {}) {
  if (!userId || !businessId) {
    return { success: false, message: "User and business are required." };
  }

  const rating = Number(payload.rating || 0);
  const title = String(payload.title || "").trim();
  const comments = String(payload.comments || "").trim();

  if (!rating || rating < 1 || rating > 5) {
    return { success: false, message: "A rating from 1 to 5 stars is required." };
  }

  if (!comments && !title) {
    return { success: false, message: "Please provide a title or review comment." };
  }

  const result = await pool.query(`INSERT INTO business_reviews (business_id, user_id, rating, title, comments, categories) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`, [businessId, userId, rating, title, comments, payload.categories || {}]);
  const review = normalizeReview(result.rows[0]);
  await logTrustAudit("review_submitted", { businessId: review.businessId, userId: review.userId, rating: review.rating, outcome: "success" });
  return { success: true, review, message: "Review submitted successfully." };
}

async function rateBusiness(userId, businessId, rating) {
  return submitReview(userId, businessId, { rating, comments: "Quick rating submission." });
}

async function getBusinessReviews(businessId) {
  const result = await pool.query(`SELECT * FROM business_reviews WHERE business_id = $1 AND status <> 'removed' ORDER BY created_at DESC`, [businessId]);
  const reviews = result.rows.map(normalizeReview);

  const averageRating = reviews.length
    ? reviews.reduce((sum, item) => sum + Number(item.rating || 0), 0) / reviews.length
    : 0;

  return {
    businessId: Number(businessId),
    totalReviews: reviews.length,
    averageRating: Number(averageRating.toFixed(1)),
    reviews,
  };
}

async function getBusinessTrustSummary(businessId) {
  const reviewsData = await getBusinessReviews(businessId);
  const businessResult = await pool.query(`SELECT business_name, verification_status FROM business_accounts WHERE id = $1`, [businessId]);
  const business = businessResult.rows[0] || {};
  const trustScore = calculateTrustScore(reviewsData.reviews, business.verification_status || "unverified");

  return {
    businessId: Number(businessId),
    businessName: business.business_name || `Business ${businessId}`,
    verificationStatus: business.verification_status || "unverified",
    averageRating: reviewsData.averageRating,
    totalReviews: reviewsData.totalReviews,
    trustScore,
    responseRate: 92,
    complaintResolutionRate: 88,
    verifiedBadge: business.verification_status === "verified",
  };
}

async function editReview(userId, reviewId, payload = {}) {
  const result = await pool.query(`UPDATE business_reviews SET title = COALESCE($1, title), comments = COALESCE($2, comments), rating = COALESCE($3, rating), categories = COALESCE($4, categories), updated_at = CURRENT_TIMESTAMP WHERE id = $5 AND user_id = $6 RETURNING *`, [payload.title === undefined ? null : String(payload.title).trim(), payload.comments === undefined ? null : String(payload.comments).trim(), payload.rating === undefined ? null : Number(payload.rating), payload.categories || null, reviewId, userId]);
  if (!result.rows.length) return { success: false, message: "Review not found or you do not own it." };
  const review = normalizeReview(result.rows[0]);
  await logTrustAudit("review_edited", { reviewId: review.id, userId, businessId: review.businessId, outcome: "success" });
  return { success: true, review, message: "Review updated successfully." };
}

async function deleteReview(userId, reviewId) {
  const result = await pool.query(`UPDATE business_reviews SET status = 'removed', updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND user_id = $2 RETURNING business_id`, [reviewId, userId]);
  if (!result.rows.length) return { success: false, message: "Review not found or you do not own it." };
  await logTrustAudit("review_deleted", { reviewId, userId, businessId: result.rows[0].business_id, outcome: "success" });
  return { success: true, message: "Review deleted successfully." };
}

async function respondToReview(businessUserId, reviewId, responseText, businessId = null) {
  const result = await pool.query(`UPDATE business_reviews SET response = $1, response_by = $2, response_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $3 AND ($4::integer IS NULL OR business_id = $4) RETURNING *`, [String(responseText || "").trim(), businessUserId, reviewId, businessId]);
  if (!result.rows.length) return { success: false, message: businessId ? "This response does not match the business review." : "Review not found." };
  const review = normalizeReview(result.rows[0]);
  await logTrustAudit("review_responded", { reviewId: review.id, businessUserId, businessId: review.businessId, outcome: "success" });
  return { success: true, review, message: "Business response saved successfully." };
}

async function flagReview(userId, reviewId, reason = "") {
  const normalizedReason = String(reason || "Inappropriate content").trim();
  const reviewResult = await pool.query(`UPDATE business_reviews SET flagged = TRUE, flag_reason = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING business_id`, [normalizedReason, reviewId]);
  if (!reviewResult.rows.length) return { success: false, message: "Review not found." };
  const reportResult = await pool.query(`INSERT INTO review_reports (review_id, user_id, report_type, details) VALUES ($1, $2, $3, $4) RETURNING *`, [reviewId, userId, "user_report", normalizedReason]);
  const report = { id: reportResult.rows[0].id, reviewId: Number(reportResult.rows[0].review_id), userId: Number(reportResult.rows[0].user_id), reason: reportResult.rows[0].details || normalizedReason, createdAt: reportResult.rows[0].created_at, outcome: "pending_review" };
  await logTrustAudit("review_reported", { reviewId, userId, businessId: reviewResult.rows[0].business_id, reason: normalizedReason, outcome: "success" });
  return { success: true, report, message: "Review reported for moderation review." };
}

async function moderateReview(adminUserId, action, reviewId) {
  const normalizedAction = String(action || "").trim().toLowerCase();
  if (!["approve", "remove", "flag"].includes(normalizedAction)) {
    return { success: false, message: "Unsupported moderation action." };
  }

  const status = normalizedAction === "remove" ? "removed" : normalizedAction === "flag" ? "flagged" : "approved";
  const result = await pool.query(`UPDATE business_reviews SET status = $1, flagged = CASE WHEN $2 = 'flagged' THEN TRUE ELSE flagged END, moderation_note = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4 RETURNING *`, [status, status, `Moderated by user ${adminUserId} with action ${normalizedAction}`, reviewId]);
  if (!result.rows.length) return { success: false, message: "Review not found." };
  const review = normalizeReview(result.rows[0]);
  await logTrustAudit("review_moderated", { adminUserId, reviewId, businessId: review.businessId, action: normalizedAction, outcome: "success" });
  return { success: true, review, message: `Review ${normalizedAction}d successfully.` };
}

async function getTrustAuditLog(limit = 20) {
  const result = await pool.query(`SELECT * FROM trust_audit_logs ORDER BY created_at DESC LIMIT $1`, [limit]);
  return result.rows;
}

module.exports = {
  submitReview,
  rateBusiness,
  getBusinessReviews,
  getBusinessTrustSummary,
  editReview,
  deleteReview,
  respondToReview,
  flagReview,
  moderateReview,
  getTrustAuditLog,
  logTrustAudit,
};
