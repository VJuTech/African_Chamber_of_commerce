const express = require("express");
const { ensureAuthenticated } = require("../controllers/accountController");
const { workspacePage } = require("../controllers/workspaceController");

const router = express.Router();

router.get("/workspace", ensureAuthenticated, workspacePage);

module.exports = router;
