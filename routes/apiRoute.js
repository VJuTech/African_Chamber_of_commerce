const express = require("express");
const { apiGateway } = require("../middleware/apiGateway");
const apiController = require("../controllers/apiController");

const router = express.Router();

router.get("/api/docs", apiController.documentation);
router.get("/api/:version/users", apiGateway("users"), apiController.listUsers);
router.get("/api/:version/businesses", apiGateway("businesses"), apiController.listBusinesses);
router.get("/api/:version/listings", apiGateway("listings"), apiController.listListings);
router.get("/api/:version/orders", apiGateway("orders"), apiController.listOrders);
router.get("/api/:version/payments", apiGateway("payments"), apiController.listPayments);

module.exports = router;
