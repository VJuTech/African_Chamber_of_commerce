const requirementsModel = require("../models/requirementsModel");

function currentUser(req) { return req.session && req.session.user ? req.session.user : null; }

async function requirementsPage(req, res, next) {
  try {
    const requirements = await requirementsModel.getRequirements({ category: req.query.category, coverage: req.query.coverage, search: req.query.search });
    const complete = requirements.filter((requirement) => requirement.coverage_status === "complete").length;
    return res.render("admin/requirements", { title: "Requirements traceability", user: currentUser(req), requirements, complete, filters: req.query, message: req.query.message || "", error: "" });
  } catch (error) { return next(error); }
}

async function requirementDetailPage(req, res, next) {
  try {
    const requirement = await requirementsModel.getRequirementById(req.params.id);
    if (!requirement) return res.status(404).render("error/404", { title: "Requirement not found", user: currentUser(req), message: "The requirement could not be found." });
    return res.render("admin/requirement-detail", { title: requirement.requirement_id, user: currentUser(req), requirement, coverageValues: requirementsModel.coverageValues, message: req.query.message || "", error: "" });
  } catch (error) { return next(error); }
}

async function createRequirement(req, res, next) {
  try {
    const result = await requirementsModel.createRequirement(currentUser(req).id, req.body);
    return res.redirect("/admin/requirements?message=" + encodeURIComponent(result.message));
  } catch (error) { return next(error); }
}

async function updateCoverage(req, res, next) {
  try {
    const result = await requirementsModel.updateCoverage(currentUser(req).id, req.params.id, req.body);
    return res.redirect(`/admin/requirements/${req.params.id}?message=${encodeURIComponent(result.message)}`);
  } catch (error) { return next(error); }
}

module.exports = { requirementsPage, requirementDetailPage, createRequirement, updateCoverage };
