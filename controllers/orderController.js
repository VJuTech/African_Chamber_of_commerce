/* ******************************************
 * orderController.js - Order management for ACC Chapter 18: checkout, tracking, status updates, refunds, and disputes.
 *******************************************/
const orderModel = require("../models/orderModel");
const marketplaceModel = require("../models/marketplaceModel");

async function orderDashboardPage(req, res, next) {
  try {
    const userId = req.session && req.session.user ? req.session.user.id : null;
    if (!userId) {
      return res.redirect("/login?message=" + encodeURIComponent("Please sign in to view your orders."));
    }

    const history = await orderModel.getOrderHistory(userId);
    const sellerOrders = await orderModel.getSellerOrders(userId);

    return res.render("orders/dashboard", {
      title: "Orders Dashboard",
      user: req.session && req.session.user ? req.session.user : null,
      buyerOrders: history || [],
      sellerOrders: sellerOrders || [],
      message: req.query.message || "",
      error: "",
    });
  } catch (error) {
    return next(error);
  }
}

async function orderHistoryPage(req, res, next) {
  try {
    const userId = req.session && req.session.user ? req.session.user.id : null;
    if (!userId) {
      return res.redirect("/login?message=" + encodeURIComponent("Please sign in to view your order history."));
    }

    const orders = await orderModel.getOrderHistory(userId);

    return res.render("orders/history", {
      title: "Order History",
      user: req.session && req.session.user ? req.session.user : null,
      orders: orders || [],
      message: req.query.message || "",
      error: "",
    });
  } catch (error) {
    return next(error);
  }
}

async function checkoutPage(req, res, next) {
  try {
    const listing = await marketplaceModel.getListingById(req.params.listingId);
    if (!listing) {
      return res.status(404).render("error/404", {
        title: "Listing not found",
        user: req.session && req.session.user ? req.session.user : null,
      });
    }

    return res.render("orders/checkout", {
      title: "Checkout",
      user: req.session && req.session.user ? req.session.user : null,
      listing,
      formData: {},
      error: "",
      message: req.query.message || "",
    });
  } catch (error) {
    return next(error);
  }
}

async function placeOrder(req, res, next) {
  try {
    const userId = req.session && req.session.user ? req.session.user.id : null;
    if (!userId) {
      return res.redirect("/login?message=" + encodeURIComponent("Please sign in to place an order."));
    }

    const result = await orderModel.createOrder(userId, {
      sellerId: Number(req.body.sellerId || 0),
      listingId: Number(req.body.listingId || 0),
      listingTitle: req.body.listingTitle,
      quantity: Number(req.body.quantity || 1),
      unitPrice: Number(req.body.unitPrice || 0),
      currency: req.body.currency || "USD",
      paymentMethod: req.body.paymentMethod || "card",
      shippingAddress: req.body.shippingAddress,
      deliveryMethod: req.body.deliveryMethod || "Courier",
      notes: req.body.notes,
    });

    if (!result.success) {
      return res.render("orders/checkout", {
        title: "Checkout",
        user: req.session && req.session.user ? req.session.user : null,
        listing: { id: req.body.listingId, title: req.body.listingTitle, price: req.body.unitPrice, currency: req.body.currency || "USD" },
        formData: req.body,
        error: result.message,
        message: "",
      });
    }

    return res.redirect("/orders/history?message=" + encodeURIComponent(result.message));
  } catch (error) {
    return next(error);
  }
}

async function orderDetailPage(req, res, next) {
  try {
    const order = await orderModel.getOrderById(req.params.id);
    if (!order) {
      return res.status(404).render("error/404", {
        title: "Order not found",
        user: req.session && req.session.user ? req.session.user : null,
      });
    }

    return res.render("orders/detail", {
      title: `Order #${order.id}`,
      user: req.session && req.session.user ? req.session.user : null,
      order,
      message: req.query.message || "",
      error: "",
    });
  } catch (error) {
    return next(error);
  }
}

async function orderTrackingPage(req, res, next) {
  try {
    const order = await orderModel.getOrderById(req.params.id);
    if (!order) {
      return res.status(404).render("error/404", {
        title: "Order not found",
        user: req.session && req.session.user ? req.session.user : null,
      });
    }

    return res.render("orders/tracking", {
      title: `Track Order #${order.id}`,
      user: req.session && req.session.user ? req.session.user : null,
      order,
      message: req.query.message || "",
      error: "",
    });
  } catch (error) {
    return next(error);
  }
}

async function confirmOrder(req, res, next) {
  try {
    const userId = req.session && req.session.user ? req.session.user.id : null;
    if (!userId) {
      return res.redirect("/login?message=" + encodeURIComponent("Please sign in to confirm an order."));
    }

    const result = await orderModel.confirmOrder(userId, req.params.id);
    return res.redirect("/orders/" + req.params.id + "?message=" + encodeURIComponent(result.message));
  } catch (error) {
    return next(error);
  }
}

async function updateOrderStatus(req, res, next) {
  try {
    const userId = req.session && req.session.user ? req.session.user.id : null;
    if (!userId) {
      return res.redirect("/login?message=" + encodeURIComponent("Please sign in to update an order."));
    }

    const result = await orderModel.updateOrderStatus(userId, req.params.id, req.body.status, req.body.trackingDetails || "");
    return res.redirect("/orders/" + req.params.id + "?message=" + encodeURIComponent(result.message));
  } catch (error) {
    return next(error);
  }
}

async function cancelOrder(req, res, next) {
  try {
    const userId = req.session && req.session.user ? req.session.user.id : null;
    if (!userId) {
      return res.redirect("/login?message=" + encodeURIComponent("Please sign in to cancel an order."));
    }

    const result = await orderModel.cancelOrder(userId, req.params.id, req.body.reason || "Order cancelled by buyer.");
    return res.redirect("/orders/" + req.params.id + "?message=" + encodeURIComponent(result.message));
  } catch (error) {
    return next(error);
  }
}

async function processRefund(req, res, next) {
  try {
    const userId = req.session && req.session.user ? req.session.user.id : null;
    if (!userId) {
      return res.redirect("/login?message=" + encodeURIComponent("Please sign in to process a refund."));
    }

    const result = await orderModel.processRefund(userId, req.params.id, req.body.reason || "Refund processed by admin.");
    return res.redirect("/orders/" + req.params.id + "?message=" + encodeURIComponent(result.message));
  } catch (error) {
    return next(error);
  }
}

async function raiseDispute(req, res, next) {
  try {
    const userId = req.session && req.session.user ? req.session.user.id : null;
    if (!userId) {
      return res.redirect("/login?message=" + encodeURIComponent("Please sign in to file a dispute."));
    }

    const result = await orderModel.raiseDispute(userId, req.params.id, req.body.reason || "Dispute raised.");
    return res.redirect("/orders/" + req.params.id + "?message=" + encodeURIComponent(result.message));
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  orderDashboardPage,
  orderHistoryPage,
  checkoutPage,
  placeOrder,
  orderDetailPage,
  orderTrackingPage,
  confirmOrder,
  updateOrderStatus,
  cancelOrder,
  processRefund,
  raiseDispute,
};
