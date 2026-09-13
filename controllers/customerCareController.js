const supportModel = require("../models/assistantSupportModel");

function currentUser(req) { return req.session && req.session.user ? req.session.user : null; }

async function page(req, res, next) {
  try {
    return res.render("admin/customer-care", {
      title: "Customer care",
      user: currentUser(req),
      requests: await supportModel.listRequests(req.query.status || "open"),
      selectedStatus: req.query.status || "open",
      message: req.query.message || "",
    });
  } catch (error) { return next(error); }
}

async function detail(req, res, next) {
  try {
    return res.render("admin/customer-care-detail", { title: "Customer-care handoff", user: currentUser(req), ...await supportModel.getRequest(req.params.id), message: req.query.message || "" });
  } catch (error) { return next(error); }
}

async function action(req, res, next) {
  try {
    await supportModel.updateRequest(req.session.user.id, req.params.id, req.body.action, req.body.message || "");
    return res.redirect(`/admin/customer-care/${req.params.id}?message=${encodeURIComponent("Customer-care request updated.")}`);
  } catch (error) { return next(error); }
}

module.exports = { page, detail, action };
