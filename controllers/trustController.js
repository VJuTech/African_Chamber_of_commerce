/* ******************************************
 * trustController.js - Trust system actions for reviews, ratings, moderation, and reputation management.
 *******************************************/
const trustModel = require("../models/trustModel");

async function trustDashboardPage(req, res, next) {
  try {
    const businessId = Number(req.query.businessId || 3);
    const summary = await trustModel.getBusinessTrustSummary(businessId);
    const reviewsData = await trustModel.getBusinessReviews(businessId);

    return res.render("trust/dashboard", {
      title: "Trust Dashboard",
      user: req.session && req.session.user ? req.session.user : null,
      businessId,
      summary,
      reviews: reviewsData.reviews || [],
      message: req.query.message || "",
      error: "",
    });
  } catch (error) {
    return next(error);
  }
}

async function businessTrustPage(req, res, next) {
  try {
    const businessId = Number(req.params.id || req.query.businessId || 3);
    const summary = await trustModel.getBusinessTrustSummary(businessId);
    const reviewsData = await trustModel.getBusinessReviews(businessId);

    return res.render("trust/business", {
      title: `${summary.businessName || "Business"} Trust Profile`,
      user: req.session && req.session.user ? req.session.user : null,
      businessId,
      summary,
      reviews: reviewsData.reviews || [],
      message: req.query.message || "",
      error: "",
    });
  } catch (error) {
    return next(error);
  }
}

async function submitReview(req, res, next) {
  try {
    const userId = req.session && req.session.user ? req.session.user.id : null;
    if (!userId) {
      return res.redirect("/login?message=" + encodeURIComponent("Please sign in to submit a review."));
    }

    const businessId = Number(req.body.businessId || req.params.id || 3);
    const result = await trustModel.submitReview(userId, businessId, {
      rating: req.body.rating,
      title: req.body.title,
      comments: req.body.comments,
      categories: {
        quality: Number(req.body.quality || 0),
        delivery: Number(req.body.delivery || 0),
        communication: Number(req.body.communication || 0),
      },
    });

    const redirectUrl = `/trust/business/${businessId}?message=${encodeURIComponent(result.message)}`;
    return res.redirect(redirectUrl);
  } catch (error) {
    return next(error);
  }
}

async function submitRating(req, res, next) {
  try {
    const userId = req.session && req.session.user ? req.session.user.id : null;
    if (!userId) {
      return res.redirect("/login?message=" + encodeURIComponent("Please sign in to rate a business."));
    }

    const businessId = Number(req.body.businessId || req.params.id || 3);
    const rating = Number(req.body.rating || 0);
    const result = await trustModel.rateBusiness(userId, businessId, rating);

    return res.redirect(`/trust/business/${businessId}?message=${encodeURIComponent(result.message)}`);
  } catch (error) {
    return next(error);
  }
}

async function editReview(req, res, next) {
  try {
    const userId = req.session && req.session.user ? req.session.user.id : null;
    if (!userId) {
      return res.redirect("/login?message=" + encodeURIComponent("Please sign in to edit a review."));
    }

    const reviewId = req.params.id || req.body.reviewId;
    const result = await trustModel.editReview(userId, reviewId, {
      rating: req.body.rating,
      title: req.body.title,
      comments: req.body.comments,
    });

    return res.redirect(`/trust/dashboard?message=${encodeURIComponent(result.message)}`);
  } catch (error) {
    return next(error);
  }
}

async function deleteReview(req, res, next) {
  try {
    const userId = req.session && req.session.user ? req.session.user.id : null;
    if (!userId) {
      return res.redirect("/login?message=" + encodeURIComponent("Please sign in to delete a review."));
    }

    const reviewId = req.params.id || req.body.reviewId;
    const result = await trustModel.deleteReview(userId, reviewId);

    return res.redirect(`/trust/dashboard?message=${encodeURIComponent(result.message)}`);
  } catch (error) {
    return next(error);
  }
}

async function respondToReview(req, res, next) {
  try {
    const userId = req.session && req.session.user ? req.session.user.id : null;
    if (!userId) {
      return res.redirect("/login?message=" + encodeURIComponent("Please sign in to respond to reviews."));
    }

    const reviewId = req.params.id || req.body.reviewId;
    const result = await trustModel.respondToReview(userId, reviewId, req.body.response, Number(req.body.businessId || 3));
    return res.redirect(`/trust/business/${req.body.businessId || 3}?message=${encodeURIComponent(result.message)}`);
  } catch (error) {
    return next(error);
  }
}

async function reportReview(req, res, next) {
  try {
    const userId = req.session && req.session.user ? req.session.user.id : null;
    if (!userId) {
      return res.redirect("/login?message=" + encodeURIComponent("Please sign in to report a review."));
    }

    const reviewId = req.body.reviewId || req.params.id;
    const result = await trustModel.flagReview(userId, reviewId, req.body.reason || "Inappropriate review");
    return res.redirect(`/trust/business/${req.body.businessId || 3}?message=${encodeURIComponent(result.message)}`);
  } catch (error) {
    return next(error);
  }
}

async function moderateReview(req, res, next) {
  try {
    const userId = req.session && req.session.user ? req.session.user.id : null;
    if (!userId) {
      return res.redirect("/login?message=" + encodeURIComponent("Please sign in to moderate reviews."));
    }

    const reviewId = req.body.reviewId || req.params.id;
    const action = req.body.action || "approve";
    const result = await trustModel.moderateReview(userId, action, reviewId);

    return res.redirect(`/trust/dashboard?message=${encodeURIComponent(result.message)}`);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  trustDashboardPage,
  businessTrustPage,
  submitReview,
  submitRating,
  editReview,
  deleteReview,
  respondToReview,
  reportReview,
  moderateReview,
};
