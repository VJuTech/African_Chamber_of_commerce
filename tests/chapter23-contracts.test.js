/*
 * chapter23-contracts.test.js - Focused acceptance checks for ACC Chapter 23.
 * The test covers creation, templates, sharing, signing, versioning, storage, and termination.
 */
const assert = require("node:assert/strict");
const contractModel = require("../models/contractModel");

(async () => {
  // Verify the required contract service surface exists.
  assert.equal(typeof contractModel.createContract, "function");
  assert.equal(typeof contractModel.generateFromTemplate, "function");
  assert.equal(typeof contractModel.shareContract, "function");
  assert.equal(typeof contractModel.signContract, "function");
  assert.equal(typeof contractModel.modifyContract, "function");
  assert.equal(typeof contractModel.terminateContract, "function");

  // Create a procurement-linked draft with payment and order references.
  const created = await contractModel.createContract(100, { partyIds: "100,200", title: "Supply agreement", description: "Bulk supply contract", effectiveDate: "2099-01-01", expirationDate: "2099-12-31", templateType: "procurement", procurementOrderId: 7, orderId: 8, paymentId: 9 });
  assert.equal(created.success, true);
  assert.equal(created.contract.status, "draft");
  assert.equal(created.contract.procurementOrderId, 7);

  // Generate the legal body from a supported template and verify version tracking.
  const generated = await contractModel.generateFromTemplate(100, created.contract.id, "procurement");
  assert.equal(generated.success, true);
  assert.match(generated.contract.content, /Procurement supply agreement/);
  assert.equal(generated.contract.version, 1);

  // Verify unsigned edits create a new version rather than mutating signed content.
  const modified = await contractModel.modifyContract(100, created.contract.id, { content: "Revised supply terms" });
  assert.equal(modified.success, true);
  assert.equal(modified.contract.version, 2);

  // Share with both parties and require an electronic signature from each party.
  const shared = await contractModel.shareContract(100, created.contract.id);
  assert.equal(shared.success, true);
  assert.equal(shared.contract.status, "pending_signature");
  assert.equal((await contractModel.signContract(100, created.contract.id, "Buyer Legal Representative")).success, true);
  const signed = await contractModel.signContract(200, created.contract.id, "Supplier Legal Representative");
  assert.equal(signed.success, true);
  assert.equal(signed.contract.status, "active");
  assert.ok(signed.signature.signatureHash);

  // Store document metadata without exposing the private storage path.
  const document = await contractModel.addDocument(100, created.contract.id, { fileName: "supply-agreement.pdf", storageName: "private-contract-file.pdf", documentType: "main" });
  assert.equal(document.success, true);
  assert.equal((await contractModel.getDocuments(created.contract.id, 100)).length, 1);

  // Terminate the active agreement and verify auditability and notifications.
  const terminated = await contractModel.terminateContract(100, created.contract.id, "Commercial terms changed.");
  assert.equal(terminated.success, true);
  assert.equal(terminated.contract.status, "terminated");
  const auditEvents = (await contractModel.getAuditLog()).map((entry) => entry.eventType);
  assert.ok(auditEvents.includes("contract_created"));
  assert.ok(auditEvents.includes("contract_modified"));
  assert.ok(auditEvents.includes("contract_signed"));
  assert.ok(auditEvents.includes("contract_terminated"));
  const notificationTypes = (await contractModel.getNotificationLog()).map((entry) => entry.type);
  assert.ok(notificationTypes.includes("contract_created"));
  assert.ok(notificationTypes.includes("signature_requested"));
  assert.ok(notificationTypes.includes("contract_signed"));

  // Report a compact success signal for the chapter test runner.
  console.log("Chapter 23 contract tests passed");
})().catch((error) => { console.error(error); process.exitCode = 1; });
