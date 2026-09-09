const systemOverviewModel = require("../models/systemOverviewModel");

function currentUser(req) { return req.session && req.session.user ? req.session.user : null; }

async function overviewPage(req, res, next) {
  try {
    const overview = await systemOverviewModel.getOverview();
    return res.render("admin/system-overview", { title: "System overview", user: currentUser(req), ...overview, message: req.query.message || "", error: "" });
  } catch (error) { return next(error); }
}

async function updateIntegration(req, res, next) {
  try {
    const result = await systemOverviewModel.updateIntegrationStatus(currentUser(req).id, req.params.id, req.body);
    return res.redirect(`/admin/system-overview?message=${encodeURIComponent(result.message)}`);
  } catch (error) { return next(error); }
}

module.exports = { overviewPage, updateIntegration };
