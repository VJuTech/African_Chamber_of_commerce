const businessNetworkingModel = require("../models/businessNetworkingModel");

async function networkDashboard(req, res, next) {
  try {
    const userId = req.session && req.session.user ? req.session.user.id : null;
    if (!userId) return res.redirect("/login?message=Please sign in to view your network.");

    const requests = await businessNetworkingModel.getConnectionRequests(userId);
    const connections = await businessNetworkingModel.getConnections(userId);
    const suggestions = await businessNetworkingModel.getConnectionSuggestions(userId);

    return res.render("business/networking", {
      title: "Business Networking",
      user: req.session && req.session.user ? req.session.user : null,
      requests,
      connections,
      suggestions,
      message: req.query.message || "",
      error: "",
    });
  } catch (error) {
    return next(error);
  }
}

async function sendConnection(req, res, next) {
  try {
    const senderId = req.session && req.session.user ? req.session.user.id : null;
    if (!senderId) return res.redirect("/login?message=Please sign in to connect.");

    const targetId = req.body.targetId || req.params.targetId;
    const result = await businessNetworkingModel.sendConnectionRequest(senderId, targetId, req.body || {});
    return res.redirect("/network?message=" + encodeURIComponent(result.message));
  } catch (error) {
    return next(error);
  }
}

async function acceptConnection(req, res, next) {
  try {
    const userId = req.session && req.session.user ? req.session.user.id : null;
    if (!userId) return res.redirect("/login?message=Please sign in to manage network requests.");

    const connectionId = req.params.id || req.body.connectionId;
    const result = await businessNetworkingModel.acceptConnectionRequest(userId, connectionId);
    return res.redirect("/network?message=" + encodeURIComponent(result.message));
  } catch (error) {
    return next(error);
  }
}

async function rejectConnection(req, res, next) {
  try {
    const userId = req.session && req.session.user ? req.session.user.id : null;
    if (!userId) return res.redirect("/login?message=Please sign in to manage network requests.");

    const connectionId = req.params.id || req.body.connectionId;
    const result = await businessNetworkingModel.rejectConnectionRequest(userId, connectionId);
    return res.redirect("/network?message=" + encodeURIComponent(result.message));
  } catch (error) {
    return next(error);
  }
}

async function blockConnection(req, res, next) {
  try {
    const userId = req.session && req.session.user ? req.session.user.id : null;
    if (!userId) return res.redirect("/login?message=Please sign in to block a connection.");

    const targetId = req.params.id || req.body.targetId;
    const result = await businessNetworkingModel.blockConnectionTarget(userId, targetId, req.body.reason || "");
    return res.redirect("/network?message=" + encodeURIComponent(result.message));
  } catch (error) {
    return next(error);
  }
}

async function reportConnection(req, res, next) {
  try {
    const userId = req.session && req.session.user ? req.session.user.id : null;
    if (!userId) return res.redirect("/login?message=Please sign in to report an issue.");

    const targetId = req.body.targetId || req.params.targetId;
    const result = await businessNetworkingModel.reportConnectionIssue(userId, targetId, req.body.reportType || "misconduct", req.body.details || "");
    return res.redirect("/network?message=" + encodeURIComponent(result.message));
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  networkDashboard,
  sendConnection,
  acceptConnection,
  rejectConnection,
  blockConnection,
  reportConnection,
};
