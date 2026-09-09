const cartModel = require("../models/cartModel");

function currentUserId(req) {
  return req.session && req.session.user ? req.session.user.id : null;
}

async function cartPage(req, res, next) {
  try {
    const cart = await cartModel.getCart(currentUserId(req));
    return res.render("cart/index", {
      title: "Your cart",
      user: req.session.user,
      cart,
      message: req.query.message || "",
      error: "",
    });
  } catch (error) {
    return next(error);
  }
}

async function addItem(req, res, next) {
  try {
    const result = await cartModel.addItem(currentUserId(req), req.body.listingId, req.body.quantity || 1);
    return res.redirect("/cart?message=" + encodeURIComponent(result.message));
  } catch (error) {
    return next(error);
  }
}

async function updateItem(req, res, next) {
  try {
    const result = await cartModel.updateItem(currentUserId(req), req.params.listingId, req.body.quantity);
    return res.redirect("/cart?message=" + encodeURIComponent(result.message));
  } catch (error) {
    return next(error);
  }
}

async function removeItem(req, res, next) {
  try {
    const result = await cartModel.removeItem(currentUserId(req), req.params.listingId);
    return res.redirect("/cart?message=" + encodeURIComponent(result.message));
  } catch (error) {
    return next(error);
  }
}

module.exports = { cartPage, addItem, updateItem, removeItem };
