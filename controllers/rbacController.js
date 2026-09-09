const rbacModel = require("../models/rbacModel");

async function accessControlPage(req, res, next) {
  try {
    const overview = await rbacModel.getAdminOverview();
    return res.render("admin/access-control", {
      title: "Access control",
      user: req.session.user,
      ...overview,
      message: req.query.message || "",
      error: "",
    });
  } catch (error) {
    return next(error);
  }
}

async function assignRole(req, res, next) {
  try {
    const result = await rbacModel.assignPlatformRole(
      req.session.user.id,
      req.body.userId,
      req.body.roleKey
    );
    const message = result.message || "Role update completed.";
    return res.redirect(`/admin/access-control?message=${encodeURIComponent(message)}`);
  } catch (error) {
    return next(error);
  }
}

module.exports = { accessControlPage, assignRole };
