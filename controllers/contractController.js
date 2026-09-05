/*
 * contractController.js - ACC Chapter 23 contract request handlers.
 * Controllers enforce HTTP access and delegate lifecycle rules to contractModel.
 */
const contractModel = require("../models/contractModel");
const procurementModel = require("../models/procurementModel");
const { getPrivateDocumentPath, removePrivateDocument, generateContractPdf } = require("../utility/contractDocumentStorage");

// Resolve the authenticated member id used by every contract action.
function currentUserId(req) { return req.session && req.session.user ? req.session.user.id : null; }

// Render contracts visible to the current member.
async function contractsDashboardPage(req, res, next) {
  try { const contracts = await contractModel.getContractsForUser(currentUserId(req)); return res.render("contracts/dashboard", { title: "Contracts", user: req.session.user, contracts, message: req.query.message || "", error: "" }); } catch (error) { return next(error); }
}

// Render the contract creation form and optionally prefill a procurement hand-off.
async function createContractPage(req, res, next) {
  try {
    const procurementOrders = await procurementModel.getProcurementOrdersForUser(currentUserId(req));
    const selectedOrder = procurementOrders.find((order) => Number(order.id) === Number(req.query.procurementOrderId)) || null;
    return res.render("contracts/create", { title: "Create contract", user: req.session.user, templates: contractModel.contractTemplates, selectedOrder, message: req.query.message || "", error: "" });
  } catch (error) { return next(error); }
}

// Render one authorized contract with signatures, versions, and private documents.
async function contractDetailPage(req, res, next) {
  try {
    const userId = currentUserId(req);
    const contract = await contractModel.getContractById(req.params.id, userId);
    if (!contract) return res.status(404).render("error/404", { title: "Contract not found", user: req.session.user });
    const [signatures, documents] = await Promise.all([contractModel.getSignatures(contract.id, userId), contractModel.getDocuments(contract.id, userId)]);
    return res.render("contracts/detail", { title: contract.title, user: req.session.user, contract, signatures, documents, message: req.query.message || "", error: "" });
  } catch (error) { return next(error); }
}

// Render a focused signing page for the current party.
async function signContractPage(req, res, next) {
  try {
    const contract = await contractModel.getContractById(req.params.id, currentUserId(req));
    if (!contract) return res.status(404).render("error/404", { title: "Contract not found", user: req.session.user });
    return res.render("contracts/sign", { title: `Sign ${contract.title}`, user: req.session.user, contract, message: req.query.message || "", error: "" });
  } catch (error) { return next(error); }
}

// Create a validated draft contract and return to its detail view.
async function createContract(req, res, next) {
  try { const result = await contractModel.createContract(currentUserId(req), req.body); if (!result.success) return res.redirect("/contracts/create?message=" + encodeURIComponent(result.message)); return res.redirect(`/contracts/${result.contract.id}?message=${encodeURIComponent(result.message)}`); } catch (error) { return next(error); }
}

// Generate a contract body from the selected template.
async function generateTemplate(req, res, next) {
  try {
    const result = await contractModel.generateFromTemplate(currentUserId(req), req.params.id, req.body.templateType);
    if (result.success) {
      const generatedFile = await generateContractPdf(result.contract);
      await contractModel.addDocument(currentUserId(req), result.contract.id, { fileName: generatedFile.fileName, storageName: generatedFile.storageName, documentType: "main" });
    }
    return res.redirect(`/contracts/${req.params.id}?message=${encodeURIComponent(result.success ? "Contract generated and PDF stored securely." : result.message)}`);
  } catch (error) { return next(error); }
}

// Share a draft and create signature records for every party.
async function shareContract(req, res, next) {
  try { const result = await contractModel.shareContract(currentUserId(req), req.params.id); return res.redirect(`/contracts/${req.params.id}?message=${encodeURIComponent(result.message)}`); } catch (error) { return next(error); }
}

// Record a verifiable electronic signature submitted by the current party.
async function signContract(req, res, next) {
  try { const result = await contractModel.signContract(currentUserId(req), req.params.id, req.body.signatureText); return res.redirect(`/contracts/${req.params.id}?message=${encodeURIComponent(result.message)}`); } catch (error) { return next(error); }
}

// Save a new pre-signature contract version.
async function modifyContract(req, res, next) {
  try { const result = await contractModel.modifyContract(currentUserId(req), req.params.id, req.body); return res.redirect(`/contracts/${req.params.id}?message=${encodeURIComponent(result.message)}`); } catch (error) { return next(error); }
}

// Store a private supporting document and retain only safe metadata in the model.
async function uploadDocument(req, res, next) {
  try {
    if (!req.file) return res.redirect(`/contracts/${req.params.id}?message=${encodeURIComponent("Select a supported document to upload.")}`);
    const result = await contractModel.addDocument(currentUserId(req), req.params.id, { fileName: req.file.originalname, storageName: req.file.filename, documentType: req.body.documentType || "attachment" });
    if (!result.success) removePrivateDocument(req.file.filename);
    return res.redirect(`/contracts/${req.params.id}?message=${encodeURIComponent(result.message)}`);
  } catch (error) { if (req.file) removePrivateDocument(req.file.filename); return next(error); }
}

// Stream an authorized private document without exposing the storage directory.
async function downloadDocument(req, res, next) {
  try {
    const contract = await contractModel.getContractById(req.params.id, currentUserId(req));
    const documents = await contractModel.getDocuments(req.params.id, currentUserId(req));
    const document = documents.find((entry) => Number(entry.id) === Number(req.params.documentId));
    if (!contract || !document) return res.status(404).render("error/404", { title: "Document not found", user: req.session.user });
    const storedDocument = contractModel.contractDocuments.find((entry) => Number(entry.id) === Number(document.id));
    const filePath = getPrivateDocumentPath(storedDocument && storedDocument.storageName);
    if (!filePath) return res.status(404).render("error/404", { title: "Document not found", user: req.session.user });
    return res.download(filePath, document.fileName);
  } catch (error) { return next(error); }
}

// Terminate an active or unsigned contract with an auditable reason.
async function terminateContract(req, res, next) {
  try { const result = await contractModel.terminateContract(currentUserId(req), req.params.id, req.body.reason); return res.redirect(`/contracts/${req.params.id}?message=${encodeURIComponent(result.message)}`); } catch (error) { return next(error); }
}

// Export handlers for the contract route collection.
module.exports = { contractsDashboardPage, createContractPage, contractDetailPage, signContractPage, createContract, generateTemplate, shareContract, signContract, modifyContract, uploadDocument, downloadDocument, terminateContract };
