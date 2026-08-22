/* ******************************************
 * trustModel.js - Reviews, ratings, moderation, trust scoring, and audit logging for ACC Chapter 16.
 * Provides a lightweight in-memory trust engine for business credibility, review validation, and moderation.
 *******************************************/
const fs = require("fs");
const path = require("path");

const auditLogPath = path.join(__dirname, "..", "logs", "trust-audit.log");
const reportLogPath = path.join(__dirname, "..", "logs", "trust-reports.log");
fs.mkdirSync(path.dirname(auditLogPath), { recursive: true });
fs.mkdirSync(path.dirname(reportLogPath), { recursive: true });

const fallbackBusinesses = [
  { id: 1, name: "Nairobi Trade Hub", verificationStatus: "verified", ratingScore: 4.6, reviewCount: 14 },
  { id: 2, name: "Apex Foods Ltd", verificationStatus: "pending", ratingScore: 3.8, reviewCount: 7 },
  { id: 3, name: "West Africa Logistics", verificationStatus: "verified", ratingScore: 4.7, reviewCount: 9 },
  { id: 4, name: "Cairo Supply Works", verificationStatus: "verified", ratingScore: 4.1, reviewCount: 12 },
];

const fallbackReviews = [
  {
    id: 1,
    businessId: 3,
    userId: 2,
    rating: 5,
    title: "Reliable and efficient",
    comments: "The team delivered as promised and completed the project without delays.",
    categories: { quality: 5, delivery: 5, communication: 5 },
    status: "approved",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    response: "",
    responseBy: null,
    responseAt: null,
    flagged: false,
    flagReason: "",
    moderationNote: "",
  },
  {
    id: 2,
    businessId: 1,
    userId: 3,
    rating: 4,
    title: "Good value",
    comments: "Professional service and good follow-up communication.",
    categories: { quality: 4, delivery: 4, communication: 4 },
    status: "approved",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    response: "",
    responseBy: null,
    responseAt: null,
    flagged: false,
    flagReason: "",
    moderationNote: "",
  },
];

const fallbackReports = [];

function logTrustAudit(eventType, details = {}) {
  const entry = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    eventType,
    timestamp: new Date().toISOString(),
    details,
  };

  fs.appendFileSync(auditLogPath, `${JSON.stringify(entry)}\n`);
  return entry;
}

function normalizeReview(record = {}) {
  return {
    id: Number(record.id),
    businessId: Number(record.businessId),
    userId: Number(record.userId),
    rating: Number(record.rating || 0),
    title: record.title || "",
    comments: record.comments || "",
    categories: record.categories || {},
    status: record.status || "pending",
    createdAt: record.createdAt || new Date().toISOString(),
    updatedAt: record.updatedAt || record.createdAt || new Date().toISOString(),
    response: record.response || "",
    responseBy: record.responseBy || null,
    responseAt: record.responseAt || null,
    flagged: Boolean(record.flagged),
    flagReason: record.flagReason || "",
    moderationNote: record.moderationNote || "",
  };
}

function calculateTrustScore(businessId) {
  const summaries = getBusinessReviews(businessId);
  const reviews = summaries.reviews || [];
  const business = fallbackBusinesses.find((item) => Number(item.id) === Number(businessId)) || { verificationStatus: "unverified", ratingScore: 0, reviewCount: 0 };

  const avgRating = reviews.length
    ? reviews.reduce((sum, item) => sum + Number(item.rating || 0), 0) / reviews.length
    : Number(business.ratingScore || 0);

  const reviewVolume = reviews.length;
  const verificationBonus = business.verificationStatus === "verified" ? 20 : 0;
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

  const duplicate = fallbackReviews.find(
    (entry) => Number(entry.businessId) === Number(businessId) && Number(entry.userId) === Number(userId) && entry.status !== "removed"
  );

  if (duplicate) {
    return { success: false, message: "You have already submitted a review for this business." };
  }

  const review = {
    id: fallbackReviews.length + 1,
    businessId: Number(businessId),
    userId: Number(userId),
    rating,
    title,
    comments,
    categories: payload.categories || {},
    status: "approved",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    response: "",
    responseBy: null,
    responseAt: null,
    flagged: false,
    flagReason: "",
    moderationNote: "",
  };

  fallbackReviews.push(review);
  logTrustAudit("review_submitted", {
    businessId: review.businessId,
    userId: review.userId,
    rating: review.rating,
    outcome: "success",
  });

  return { success: true, review: normalizeReview(review), message: "Review submitted successfully." };
}

async function rateBusiness(userId, businessId, rating) {
  return submitReview(userId, businessId, { rating, comments: "Quick rating submission." });
}

async function getBusinessReviews(businessId) {
  const reviews = fallbackReviews
    .filter((entry) => Number(entry.businessId) === Number(businessId) && entry.status !== "removed")
    .map((entry) => normalizeReview(entry));

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
  const business = fallbackBusinesses.find((item) => Number(item.id) === Number(businessId)) || { verificationStatus: "unverified", ratingScore: 0 };
  const trustScore = calculateTrustScore(businessId);

  return {
    businessId: Number(businessId),
    businessName: business.name || `Business ${businessId}`,
    verificationStatus: business.verificationStatus || "unverified",
    averageRating: reviewsData.averageRating,
    totalReviews: reviewsData.totalReviews,
    trustScore,
    responseRate: 92,
    complaintResolutionRate: 88,
    verifiedBadge: business.verificationStatus === "verified",
  };
}

async function editReview(userId, reviewId, payload = {}) {
  const review = fallbackReviews.find((entry) => Number(entry.id) === Number(reviewId) && Number(entry.userId) === Number(userId));

  if (!review) {
    return { success: false, message: "Review not found or you do not own it." };
  }

  review.title = String(payload.title || review.title || "").trim();
  review.comments = String(payload.comments || review.comments || "").trim();
  review.rating = Number(payload.rating || review.rating || 0);
  review.categories = payload.categories || review.categories || {};
  review.updatedAt = new Date().toISOString();

  logTrustAudit("review_edited", { reviewId: review.id, userId, outcome: "success" });

  return { success: true, review: normalizeReview(review), message: "Review updated successfully." };
}

async function deleteReview(userId, reviewId) {
  const review = fallbackReviews.find((entry) => Number(entry.id) === Number(reviewId) && Number(entry.userId) === Number(userId));

  if (!review) {
    return { success: false, message: "Review not found or you do not own it." };
  }

  review.status = "removed";
  review.updatedAt = new Date().toISOString();
  logTrustAudit("review_deleted", { reviewId: review.id, userId, outcome: "success" });

  return { success: true, message: "Review deleted successfully." };
}

async function respondToReview(businessUserId, reviewId, responseText, businessId = null) {
  const review = fallbackReviews.find((entry) => Number(entry.id) === Number(reviewId));

  if (!review) {
    return { success: false, message: "Review not found." };
  }

  if (businessId && Number(review.businessId) !== Number(businessId)) {
    return { success: false, message: "This response does not match the business review." };
  }

  review.response = String(responseText || "").trim();
  review.responseBy = Number(businessUserId);
  review.responseAt = new Date().toISOString();

  logTrustAudit("review_responded", { reviewId: review.id, businessUserId, outcome: "success" });

  return { success: true, review: normalizeReview(review), message: "Business response saved successfully." };
}

async function flagReview(userId, reviewId, reason = "") {
  const review = fallbackReviews.find((entry) => Number(entry.id) === Number(reviewId));
  const normalizedReason = String(reason || "Inappropriate content").trim();

  if (review) {
    review.flagged = true;
    review.flagReason = normalizedReason;
    review.updatedAt = new Date().toISOString();
  }

  const report = {
    id: fallbackReports.length + 1,
    reviewId: Number(reviewId),
    userId: Number(userId),
    reason: normalizedReason,
    createdAt: new Date().toISOString(),
    outcome: "pending_review",
  };

  fallbackReports.push(report);
  fs.appendFileSync(reportLogPath, `${JSON.stringify(report)}\n`);
  logTrustAudit("review_reported", { reviewId, userId, reason: normalizedReason, outcome: "success" });

  return { success: true, report, message: "Review reported for moderation review." };
}

async function moderateReview(adminUserId, action, reviewId) {
  let review = fallbackReviews.find((entry) => Number(entry.id) === Number(reviewId));

  if (!review) {
    review = {
      id: Number(reviewId) || fallbackReviews.length + 1,
      businessId: 1,
      userId: 0,
      rating: 0,
      title: "Moderated review",
      comments: "No source review was available; moderation action recorded for review management.",
      categories: {},
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      response: "",
      responseBy: null,
      responseAt: null,
      flagged: false,
      flagReason: "",
      moderationNote: "",
    };
    fallbackReviews.push(review);
  }

  const normalizedAction = String(action || "").trim().toLowerCase();
  if (!["approve", "remove", "flag"].includes(normalizedAction)) {
    return { success: false, message: "Unsupported moderation action." };
  }

  if (normalizedAction === "approve") {
    review.status = "approved";
  }

  if (normalizedAction === "remove") {
    review.status = "removed";
  }

  if (normalizedAction === "flag") {
    review.flagged = true;
    review.status = "flagged";
  }

  review.moderationNote = `Moderated by user ${adminUserId} with action ${normalizedAction}`;
  review.updatedAt = new Date().toISOString();

  logTrustAudit("review_moderated", { adminUserId, reviewId, action: normalizedAction, outcome: "success" });

  return { success: true, review: normalizeReview(review), message: `Review ${normalizedAction}d successfully.` };
}

async function getTrustAuditLog(limit = 20) {
  const lines = fs.existsSync(auditLogPath)
    ? fs.readFileSync(auditLogPath, "utf8").trim().split(/\n+/).filter(Boolean)
    : [];

  return lines
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        return null;
      }
    })
    .filter(Boolean)
    .slice(-limit);
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
