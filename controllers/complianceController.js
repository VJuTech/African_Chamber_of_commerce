const complianceModel = require("../models/complianceModel");

function currentUser(req) {
  return req.session && req.session.user ? req.session.user : null;
}

async function memberPage(req, res, next) {
  try {
    return res.render("compliance/member", {
      title: "Compliance centre",
      user: currentUser(req),
      policies: await complianceModel.getActivePolicies(),
      compliance: await complianceModel.getUserCompliance(req.session.user.id),
      message: req.query.message || "",
      error: req.query.error || "",
    });
  } catch (error) { return next(error); }
}

async function submitKyc(req, res, next) {
  try {
    const documents = (req.files || []).map((file, index) => ({
      documentType: String((req.body.documentType || "identity")).split(",")[index] || "identity",
      storagePath: file.path,
      originalName: file.originalname,
      mimeType: file.mimetype,
      fileSize: file.size,
    }));
    if (!documents.length) return res.redirect("/compliance?error=" + encodeURIComponent("Please attach at least one identity document."));
    await complianceModel.submitKyc(req.session.user.id, documents);
    return res.redirect("/compliance?message=" + encodeURIComponent("KYC documents submitted for review."));
  } catch (error) { return next(error); }
}

async function adminPage(req, res, next) {
  try {
    return res.render("admin/compliance", {
      title: "Compliance operations",
      user: currentUser(req),
      summary: await complianceModel.getDashboardSummary(),
      data: await complianceModel.getComplianceAdminData(),
      message: req.query.message || "",
    });
  } catch (error) { return next(error); }
}

async function reviewKyc(req, res, next) {
  try {
    await complianceModel.reviewKyc(req.session.user.id, req.params.id, req.body.status, { notes: req.body.notes });
    return res.redirect("/admin/compliance?message=" + encodeURIComponent("KYC decision recorded and audited."));
  } catch (error) { return next(error); }
}

module.exports = { memberPage, submitKyc, adminPage, reviewKyc };
