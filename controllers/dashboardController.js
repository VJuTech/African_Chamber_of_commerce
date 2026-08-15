const dashboardModel = require("../models/dashboardModel");

function dashboardPage(req, res) {
  res.render("dashboard", dashboardModel.getDashboardSummary(req.session.user));
}

module.exports = {
  dashboardPage,
};
