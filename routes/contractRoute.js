/*
 * contractRoute.js - ACC Chapter 23 authenticated contract routes.
 * Document downloads remain protected by the same contract-party authorization.
 */
const express = require("express");
const { ensureAuthenticated, ensureVerifiedAccount } = require("../controllers/accountController");
const { contractDocumentUpload } = require("../utility/contractDocumentStorage");
const { contractsDashboardPage, createContractPage, contractDetailPage, signContractPage, createContract, generateTemplate, shareContract, signContract, modifyContract, uploadDocument, downloadDocument, terminateContract } = require("../controllers/contractController");

// Create the isolated route collection for contract lifecycle operations.
const router = express.Router();

// Render authorized contract workspaces and detail/signing pages.
router.get("/contracts", ensureAuthenticated, contractsDashboardPage);
router.get("/contracts/create", ensureAuthenticated, ensureVerifiedAccount, createContractPage);
router.get("/contracts/:id", ensureAuthenticated, contractDetailPage);
router.get("/contracts/:id/sign", ensureAuthenticated, ensureVerifiedAccount, signContractPage);
router.get("/contracts/:id/documents/:documentId", ensureAuthenticated, downloadDocument);

// Persist contract lifecycle and document actions for verified parties.
router.post("/contracts/create", ensureAuthenticated, ensureVerifiedAccount, createContract);
router.post("/contracts/:id/template", ensureAuthenticated, ensureVerifiedAccount, generateTemplate);
router.post("/contracts/:id/share", ensureAuthenticated, ensureVerifiedAccount, shareContract);
router.post("/contracts/:id/sign", ensureAuthenticated, ensureVerifiedAccount, signContract);
router.post("/contracts/:id/modify", ensureAuthenticated, ensureVerifiedAccount, modifyContract);
router.post("/contracts/:id/documents", ensureAuthenticated, ensureVerifiedAccount, contractDocumentUpload.single("contractDocument"), uploadDocument);
router.post("/contracts/:id/terminate", ensureAuthenticated, ensureVerifiedAccount, terminateContract);

// Export the Chapter 23 route collection for server registration.
module.exports = router;
