const express = require("express");
const { ensureAuthenticated, ensureVerifiedAccount } = require("../controllers/accountController");
const {
  networkDashboard,
  sendConnection,
  acceptConnection,
  rejectConnection,
  blockConnection,
  reportConnection,
} = require("../controllers/businessNetworkingController");

const router = express.Router();

router.get("/network", ensureAuthenticated, networkDashboard);
router.post("/network/connect", ensureAuthenticated, ensureVerifiedAccount, sendConnection);
router.post("/network/:id/accept", ensureAuthenticated, ensureVerifiedAccount, acceptConnection);
router.post("/network/:id/reject", ensureAuthenticated, ensureVerifiedAccount, rejectConnection);
router.post("/network/:id/block", ensureAuthenticated, ensureVerifiedAccount, blockConnection);
router.post("/network/report", ensureAuthenticated, ensureVerifiedAccount, reportConnection);

module.exports = router;
