/*
 * contractModel.js - ACC Chapter 23 contract lifecycle and audit service.
 * The service keeps the repository's lightweight operational pattern while
 * exposing durable identifiers for procurement, orders, and payment records.
 */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

// Keep contract audit and notification records in the shared application log directory.
const auditLogPath = path.join(__dirname, "..", "logs", "contracts-audit.log");
const notificationLogPath = path.join(__dirname, "..", "logs", "contracts-notifications.log");
fs.mkdirSync(path.dirname(auditLogPath), { recursive: true });

// Define the controlled vocabulary used by the contract UI and lifecycle rules.
const contractStatuses = ["draft", "pending_signature", "active", "completed", "terminated", "expired"];
const signatureStatuses = ["pending", "signed", "declined"];
const contractTemplates = {
  procurement: { name: "Procurement supply agreement", scope: "Supply of goods or services described in the sourcing request." },
  service: { name: "Business services agreement", scope: "Professional services delivered by the supplier to the buyer." },
  nda: { name: "Mutual confidentiality agreement", scope: "Confidential information shared between the contracting parties." },
};

// Keep workflow records and append-only audit/notification records in memory for this module.
const contracts = [];
const contractVersions = [];
const contractDocuments = [];
const auditEntries = [];
const notificationEntries = [];

// Generate readable identifiers suitable for legal and operational references.
function generateReference(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

// Record every contract mutation for legal traceability.
function logAudit(eventType, userId, details = {}) {
  const entry = { id: generateReference("AUD"), eventType, userId: Number(userId || 0), details, createdAt: new Date().toISOString() };
  auditEntries.push(entry);
  fs.appendFileSync(auditLogPath, `${JSON.stringify(entry)}\n`);
  return entry;
}

// Record notification intent for a future email, SMS, or push delivery service.
function logNotification(type, recipientId, details = {}) {
  const entry = { id: generateReference("NOT"), type, recipientId: Number(recipientId || 0), details, createdAt: new Date().toISOString() };
  notificationEntries.push(entry);
  fs.appendFileSync(notificationLogPath, `${JSON.stringify(entry)}\n`);
  return entry;
}

// Hash signature evidence so verification does not depend on storing raw signature input.
function createSignatureHash(contractId, signerId, signatureText, version) {
  return crypto.createHash("sha256").update(`${contractId}:${signerId}:${version}:${signatureText}`).digest("hex");
}

// Normalize a contract while keeping party and integration identifiers numeric.
function normalizeContract(contract) {
  return { ...contract, id: Number(contract.id), partyIds: [...contract.partyIds].map(Number), procurementOrderId: contract.procurementOrderId ? Number(contract.procurementOrderId) : null, orderId: contract.orderId ? Number(contract.orderId) : null, paymentId: contract.paymentId ? Number(contract.paymentId) : null, version: Number(contract.version) };
}

// Normalize signature records for templates and API consumers.
function normalizeSignature(signature) {
  return { ...signature, id: Number(signature.id), contractId: Number(signature.contractId), signerId: Number(signature.signerId) };
}

// Normalize private document metadata without exposing storage paths.
function normalizeDocument(document) {
  return { id: Number(document.id), contractId: Number(document.contractId), fileName: document.fileName, documentType: document.documentType, uploadedBy: Number(document.uploadedBy), version: Number(document.version), createdAt: document.createdAt };
}

// Validate the parties, dates, and optional Chapter 22/18/19 references before creating a draft.
async function createContract(creatorId, payload = {}) {
  const partyIds = String(payload.partyIds || "").split(",").map((value) => Number(value.trim())).filter(Boolean);
  const counterpartyId = Number(payload.counterpartyId || 0);
  if (counterpartyId && !partyIds.includes(counterpartyId)) partyIds.push(counterpartyId);
  const title = String(payload.title || "").trim();
  const description = String(payload.description || "").trim();
  const effectiveDate = String(payload.effectiveDate || "").trim();
  const expirationDate = String(payload.expirationDate || "").trim();
  const templateType = String(payload.templateType || "procurement").trim().toLowerCase();
  if (!creatorId || !partyIds.length || !title || !description || !effectiveDate || !expirationDate) return { success: false, message: "Parties, title, description, effective date, and expiration date are required." };
  if (!contractTemplates[templateType]) return { success: false, message: "Select a supported contract template." };
  if (new Date(effectiveDate).getTime() > new Date(expirationDate).getTime()) return { success: false, message: "Expiration date must be after the effective date." };
  if (partyIds.includes(Number(creatorId)) === false) partyIds.push(Number(creatorId));

  const contract = {
    id: contracts.length + 1,
    reference: generateReference("CON"),
    creatorId: Number(creatorId),
    partyIds,
    title,
    description,
    effectiveDate,
    expirationDate,
    scopeOfWork: String(payload.scopeOfWork || contractTemplates[templateType].scope).trim(),
    paymentTerms: String(payload.paymentTerms || "As agreed by the parties.").trim(),
    deliveryObligations: String(payload.deliveryObligations || "As agreed by the parties.").trim(),
    penaltiesConditions: String(payload.penaltiesConditions || "Subject to the signed agreement.").trim(),
    templateType,
    content: String(payload.content || "").trim(),
    status: "draft",
    version: 1,
    procurementOrderId: Number(payload.procurementOrderId || 0) || null,
    orderId: Number(payload.orderId || 0) || null,
    paymentId: Number(payload.paymentId || 0) || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    terminatedAt: null,
  };
  contracts.push(contract);
  contractVersions.push({ id: contractVersions.length + 1, contractId: contract.id, version: 1, content: contract.content, createdBy: Number(creatorId), createdAt: contract.createdAt });
  logAudit("contract_created", creatorId, { contractId: contract.id, reference: contract.reference, status: contract.status });
  logNotification("contract_created", creatorId, { contractId: contract.id });
  return { success: true, contract: normalizeContract(contract), message: "Contract created as a draft." };
}

// Generate a contract body from a supported template without changing lifecycle state.
async function generateFromTemplate(userId, contractId, templateType) {
  const contract = contracts.find((entry) => Number(entry.id) === Number(contractId));
  const template = contractTemplates[String(templateType || "").trim().toLowerCase()];
  if (!contract || !template) return { success: false, message: "Contract or template not found." };
  if (!contract.partyIds.includes(Number(userId))) return { success: false, message: "You do not have access to this contract." };
  if (contract.status !== "draft") return { success: false, message: "Only draft contracts can use a template." };
  contract.templateType = String(templateType).trim().toLowerCase();
  contract.content = `${template.name}\n\nScope: ${contract.scopeOfWork}\nPayment terms: ${contract.paymentTerms}\nDelivery obligations: ${contract.deliveryObligations}\nPenalties and conditions: ${contract.penaltiesConditions}`;
  contract.updatedAt = new Date().toISOString();
  contractVersions.push({ id: contractVersions.length + 1, contractId: contract.id, version: contract.version, content: contract.content, createdBy: Number(userId), createdAt: contract.updatedAt });
  logAudit("contract_modified", userId, { contractId: contract.id, change: "template_generated", templateType: contract.templateType });
  return { success: true, contract: normalizeContract(contract), message: "Contract generated from template." };
}

// Return contracts visible only to one of their parties.
async function getContractsForUser(userId) {
  return contracts.filter((contract) => contract.partyIds.includes(Number(userId))).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).map(normalizeContract);
}

// Resolve a contract while enforcing party-level access control.
async function getContractById(contractId, userId) {
  const contract = contracts.find((entry) => Number(entry.id) === Number(contractId));
  return contract && contract.partyIds.includes(Number(userId)) ? normalizeContract(contract) : null;
}

// Return signature records only to a contract party.
async function getSignatures(contractId, userId) {
  const contract = contracts.find((entry) => Number(entry.id) === Number(contractId));
  if (!contract || !contract.partyIds.includes(Number(userId))) return [];
  return (contract.signatures || []).map(normalizeSignature);
}

// Share a draft with all parties and move it into the signature stage.
async function shareContract(userId, contractId) {
  const contract = contracts.find((entry) => Number(entry.id) === Number(contractId));
  if (!contract || !contract.partyIds.includes(Number(userId))) return { success: false, message: "You do not have access to this contract." };
  if (contract.status !== "draft") return { success: false, message: "Only draft contracts can be shared." };
  contract.status = "pending_signature";
  contract.signatures = contract.partyIds.map((signerId, index) => ({ id: index + 1, contractId: contract.id, signerId, signedAt: null, signatureHash: null, status: "pending", version: contract.version }));
  contract.updatedAt = new Date().toISOString();
  logAudit("signature_requested", userId, { contractId: contract.id, partyIds: contract.partyIds });
  contract.partyIds.forEach((partyId) => logNotification("signature_requested", partyId, { contractId: contract.id, reference: contract.reference }));
  return { success: true, contract: normalizeContract(contract), message: "Contract shared and signatures requested." };
}

// Record a verifiable electronic signature and activate the contract after all parties sign.
async function signContract(signerId, contractId, signatureText) {
  const contract = contracts.find((entry) => Number(entry.id) === Number(contractId));
  if (!contract || !contract.partyIds.includes(Number(signerId))) return { success: false, message: "You do not have access to this contract." };
  if (contract.status !== "pending_signature") return { success: false, message: "This contract is not awaiting signatures." };
  const signature = (contract.signatures || []).find((entry) => Number(entry.signerId) === Number(signerId));
  if (!signature) return { success: false, message: "Signature record not found." };
  if (!String(signatureText || "").trim()) return { success: false, message: "A signature confirmation is required." };
  signature.status = "signed";
  signature.signedAt = new Date().toISOString();
  signature.signatureHash = createSignatureHash(contract.id, signerId, String(signatureText).trim(), contract.version);
  logAudit("contract_signed", signerId, { contractId: contract.id, signatureId: signature.id, signatureHash: signature.signatureHash });
  logNotification("contract_signed", contract.creatorId, { contractId: contract.id, signerId });
  if (contract.signatures.every((entry) => entry.status === "signed")) {
    contract.status = "active";
    logAudit("contract_activated", signerId, { contractId: contract.id });
    contract.partyIds.forEach((partyId) => logNotification("contract_active", partyId, { contractId: contract.id }));
  }
  contract.updatedAt = new Date().toISOString();
  return { success: true, contract: normalizeContract(contract), signature: normalizeSignature(signature), message: contract.status === "active" ? "All parties signed; contract is active." : "Signature recorded successfully." };
}

// Modify a contract only before execution and retain a new immutable version record.
async function modifyContract(userId, contractId, payload = {}) {
  const contract = contracts.find((entry) => Number(entry.id) === Number(contractId));
  if (!contract || !contract.partyIds.includes(Number(userId))) return { success: false, message: "You do not have access to this contract." };
  if (!["draft", "pending_signature"].includes(contract.status)) return { success: false, message: "Only unsigned contracts can be modified." };
  contract.title = String(payload.title || contract.title).trim();
  contract.description = String(payload.description || contract.description).trim();
  contract.content = String(payload.content || contract.content).trim();
  contract.version += 1;
  contract.updatedAt = new Date().toISOString();
  contractVersions.push({ id: contractVersions.length + 1, contractId: contract.id, version: contract.version, content: contract.content, createdBy: Number(userId), createdAt: contract.updatedAt });
  if (contract.status === "pending_signature") contract.status = "draft";
  logAudit("contract_modified", userId, { contractId: contract.id, version: contract.version });
  return { success: true, contract: normalizeContract(contract), message: "Contract changes saved as a new version." };
}

// Attach private document metadata to an authorized contract without exposing storage paths.
async function addDocument(userId, contractId, document = {}) {
  const contract = contracts.find((entry) => Number(entry.id) === Number(contractId));
  if (!contract || !contract.partyIds.includes(Number(userId))) return { success: false, message: "You do not have access to this contract." };
  const record = { id: contractDocuments.length + 1, contractId: contract.id, fileName: String(document.fileName || "document").trim(), storageName: String(document.storageName || "").trim(), documentType: String(document.documentType || "attachment").trim(), uploadedBy: Number(userId), version: contract.version, createdAt: new Date().toISOString() };
  contractDocuments.push(record);
  logAudit("contract_document_stored", userId, { contractId: contract.id, documentId: record.id, documentType: record.documentType, version: record.version });
  return { success: true, document: normalizeDocument(record), message: "Contract document stored securely." };
}

// Terminate an active contract and preserve the legal event in its audit trail.
async function terminateContract(userId, contractId, reason = "") {
  const contract = contracts.find((entry) => Number(entry.id) === Number(contractId));
  if (!contract || !contract.partyIds.includes(Number(userId))) return { success: false, message: "You do not have access to this contract." };
  if (!["active", "pending_signature"].includes(contract.status)) return { success: false, message: "This contract cannot be terminated in its current state." };
  contract.status = "terminated";
  contract.terminatedAt = new Date().toISOString();
  contract.updatedAt = contract.terminatedAt;
  logAudit("contract_terminated", userId, { contractId: contract.id, reason: String(reason || "").trim() });
  contract.partyIds.forEach((partyId) => logNotification("contract_terminated", partyId, { contractId: contract.id }));
  return { success: true, contract: normalizeContract(contract), message: "Contract terminated and recorded." };
}

// Expose audit, notification, and document metadata snapshots for tests and administrators.
async function getAuditLog() { return [...auditEntries]; }
async function getNotificationLog() { return [...notificationEntries]; }
async function getDocuments(contractId, userId) { const contract = contracts.find((entry) => Number(entry.id) === Number(contractId)); return contract && contract.partyIds.includes(Number(userId)) ? contractDocuments.filter((document) => Number(document.contractId) === Number(contractId)).map(normalizeDocument) : []; }

// Export the complete Chapter 23 service surface for controllers and acceptance tests.
module.exports = { contractStatuses, signatureStatuses, contractTemplates, createContract, generateFromTemplate, getContractsForUser, getContractById, getSignatures, shareContract, signContract, modifyContract, addDocument, terminateContract, getAuditLog, getNotificationLog, getDocuments, contracts, contractVersions, contractDocuments };
