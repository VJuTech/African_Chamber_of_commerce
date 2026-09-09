const dashboardModel = require("../models/accManagementDashboardModel");

function currentUser(req) {
  return req.session && req.session.user ? req.session.user : null;
}

async function managementDashboard(req, res, next) {
  try {
    const data = await dashboardModel.getDashboardData();
    return res.render("admin/dashboard", {
      title: "ACC Management Dashboard",
      user: currentUser(req),
      ...data,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  managementDashboard,
};
