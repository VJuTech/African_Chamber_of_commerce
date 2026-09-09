/* ******************************************
 * orderController.js - Order management for ACC Chapter 18: checkout, tracking, status updates, refunds, and disputes.
 *******************************************/
const orderModel = require("../models/orderModel");
const marketplaceModel = require("../models/marketplaceModel");
const cartModel = require("../models/cartModel");
const paymentModel = require("../models/paymentModel");

async function cartCheckoutPage(req, res, next) {
  try {
    const userId = req.session && req.session.user ? req.session.user.id : null;
    const cart = await cartModel.getCart(userId);
    if (!cart.items.length) return res.redirect("/cart?message=" + encodeURIComponent("Your cart is empty."));
    return res.render("orders/cart-checkout", {
      title: "Cart checkout",
      user: req.session.user,
      cart,
      formData: {},
      message: req.query.message || "",
      error: "",
    });
  } catch (error) { return next(error); }
}

async function placeCartOrder(req, res, next) {
  try {
    const userId = req.session && req.session.user ? req.session.user.id : null;
    const cart = await cartModel.getCart(userId);
    const shippingAddress = String(req.body.shippingAddress || "").trim();
    if (!shippingAddress || !cart.items.length) {
      return res.redirect("/cart/checkout?message=" + encodeURIComponent("Add delivery details before completing checkout."));
    }

    const createdOrders = [];
    for (const item of cart.items) {
      const orderResult = await orderModel.createOrder(userId, {
        sellerId: item.sellerId,
        listingId: item.listingId,
        listingTitle: item.title,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        currency: item.currency,
        paymentMethod: req.body.paymentMethod || "card",
        shippingAddress,
        deliveryMethod: req.body.deliveryMethod || "standard",
        notes: req.body.notes || "",
      });
      if (!orderResult.success) {
        return res.redirect("/cart/checkout?message=" + encodeURIComponent(orderResult.message));
      }
      const paymentResult = await paymentModel.initiatePayment(userId, {
        orderId: orderResult.order.id,
        sellerId: item.sellerId,
        amount: orderResult.order.totalPrice,
        currency: item.currency,
        paymentMethod: req.body.paymentMethod || "card",
        orderNumber: `ORD-${orderResult.order.id}`,
      });
      createdOrders.push({ order: orderResult.order, payment: paymentResult.payment });
    }

    await cartModel.clearCart(userId);
    return res.redirect("/payments/history?message=" + encodeURIComponent(`${createdOrders.length} order(s) created and payment initiated.`));
  } catch (error) { return next(error); }
}

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

    const paymentResult = await paymentModel.initiatePayment(userId, {
      orderId: result.order.id,
      sellerId: result.order.sellerId,
      amount: result.order.totalPrice,
      currency: result.order.currency,
      paymentMethod: result.order.paymentMethod,
      orderNumber: `ORD-${result.order.id}`,
    });
    const message = paymentResult.success
      ? "Order created and payment initiated."
      : `${result.message} Payment could not be initiated: ${paymentResult.message}`;
    return res.redirect("/payments/history?message=" + encodeURIComponent(message));
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
  cartCheckoutPage,
  placeCartOrder,
  placeOrder,
  orderDetailPage,
  orderTrackingPage,
  confirmOrder,
  updateOrderStatus,
  cancelOrder,
  processRefund,
  raiseDispute,
};
