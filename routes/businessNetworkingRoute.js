const express = require("express");
const { ensureAuthenticated } = require("../controllers/accountController");
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
router.post("/network/connect", ensureAuthenticated, sendConnection);
router.post("/network/:id/accept", ensureAuthenticated, acceptConnection);
router.post("/network/:id/reject", ensureAuthenticated, rejectConnection);
router.post("/network/:id/block", ensureAuthenticated, blockConnection);
router.post("/network/report", ensureAuthenticated, reportConnection);

module.exports = router;
