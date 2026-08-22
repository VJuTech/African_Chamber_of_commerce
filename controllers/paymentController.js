/* ******************************************
 * paymentController.js - Payment processing actions for ACC Chapter 19.
 *******************************************/
const paymentModel = require("../models/paymentModel");

async function paymentDashboardPage(req, res, next) {
  try {
    const userId = req.session && req.session.user ? req.session.user.id : null;
    if (!userId) {
      return res.redirect("/login?message=" + encodeURIComponent("Please sign in to view payments."));
    }

    const payments = await paymentModel.getUserPayments(userId);

    return res.render("payments/dashboard", {
      title: "Payment Dashboard",
      user: req.session && req.session.user ? req.session.user : null,
      payments: payments || [],
      message: req.query.message || "",
      error: "",
    });
  } catch (error) {
    return next(error);
  }
}

async function paymentHistoryPage(req, res, next) {
  try {
    const userId = req.session && req.session.user ? req.session.user.id : null;
    if (!userId) {
      return res.redirect("/login?message=" + encodeURIComponent("Please sign in to view payment history."));
    }

    const payments = await paymentModel.getUserPayments(userId);

    return res.render("payments/history", {
      title: "Payment History",
      user: req.session && req.session.user ? req.session.user : null,
      payments: payments || [],
      message: req.query.message || "",
      error: "",
    });
  } catch (error) {
    return next(error);
  }
}

async function initiatePayment(req, res, next) {
  try {
    const userId = req.session && req.session.user ? req.session.user.id : null;
    if (!userId) {
      return res.redirect("/login?message=" + encodeURIComponent("Please sign in to make a payment."));
    }

    const result = await paymentModel.initiatePayment(userId, {
      orderId: Number(req.body.orderId || 0),
      sellerId: Number(req.body.sellerId || 0),
      amount: Number(req.body.amount || 0),
      currency: req.body.currency || "USD",
      paymentMethod: req.body.paymentMethod || "card",
      provider: req.body.provider || "paystack",
      paymentReference: req.body.paymentReference || "",
      orderNumber: req.body.orderNumber || "",
    });

    if (!result.success) {
      return res.status(400).json({ success: false, message: result.message });
    }

    return res.status(200).json({ success: true, payment: result.payment, message: result.message });
  } catch (error) {
    return next(error);
  }
}

async function processPaymentGateway(req, res, next) {
  try {
    const result = await paymentModel.processGatewayPayment(req.body.provider, req.body.paymentId, {
      status: req.body.status || "success",
      gatewayReference: req.body.gatewayReference || "",
      reason: req.body.reason || "",
    });

    if (!result.success) {
      return res.status(400).json({ success: false, message: result.message });
    }

    return res.status(200).json({ success: true, payment: result.payment, message: result.message });
  } catch (error) {
    return next(error);
  }
}

async function updatePaymentStatus(req, res, next) {
  try {
    const result = await paymentModel.updatePaymentStatus(req.params.id, req.body.status || "successful", {
      reason: req.body.reason || "",
    });

    return res.redirect("/payments/" + req.params.id + "?message=" + encodeURIComponent(result.message));
  } catch (error) {
    return next(error);
  }
}

async function refundPayment(req, res, next) {
  try {
    const userId = req.session && req.session.user ? req.session.user.id : null;
    if (!userId) {
      return res.redirect("/login?message=" + encodeURIComponent("Please sign in to request a refund."));
    }

    const result = await paymentModel.refundPayment(userId, req.params.id, req.body.reason || "Refund processed");
    return res.redirect("/payments/" + req.params.id + "?message=" + encodeURIComponent(result.message));
  } catch (error) {
    return next(error);
  }
}

async function paymentDetailPage(req, res, next) {
  try {
    const payment = await paymentModel.getPaymentById(req.params.id);
    if (!payment) {
      return res.status(404).render("error/404", {
        title: "Payment not found",
        user: req.session && req.session.user ? req.session.user : null,
      });
    }

    return res.render("payments/detail", {
      title: `Payment #${payment.id}`,
      user: req.session && req.session.user ? req.session.user : null,
      payment,
      message: req.query.message || "",
      error: "",
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  paymentDashboardPage,
  paymentHistoryPage,
  initiatePayment,
  processPaymentGateway,
  updatePaymentStatus,
  refundPayment,
  paymentDetailPage,
};
