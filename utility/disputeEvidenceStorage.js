/*
 * disputeEvidenceStorage.js - Private evidence storage for ACC Chapter 24.
 * Evidence remains outside public/ and is served only after case authorization.
 */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

// Create the private evidence directory during startup.
const disputeEvidenceDirectory = path.join(__dirname, "..", "storage", "disputes", "evidence");
fs.mkdirSync(disputeEvidenceDirectory, { recursive: true });

// Generate opaque filenames that cannot expose user-controlled paths.
const storage = multer.diskStorage({
  destination: (req, file, callback) => callback(null, disputeEvidenceDirectory),
  filename: (req, file, callback) => callback(null, `${Date.now()}-${crypto.randomBytes(12).toString("hex")}${path.extname(file.originalname).toLowerCase()}`),
});

// Accept evidence documents and images within the 10 MB case-file limit.
function evidenceFileFilter(req, file, callback) {
  const allowedExtensions = [".pdf", ".doc", ".docx", ".png", ".jpg", ".jpeg", ".txt"];
  if (!allowedExtensions.includes(path.extname(file.originalname).toLowerCase())) return callback(new Error("Only PDF, DOC, DOCX, TXT, JPG, JPEG, and PNG evidence is supported."));
  return callback(null, true);
}

// Restrict uploads before they reach the dispute model.
const disputeEvidenceUpload = multer({ storage, fileFilter: evidenceFileFilter, limits: { fileSize: 10 * 1024 * 1024 } });

// Guard against path traversal when resolving a private evidence file.
function getPrivateEvidencePath(storageName) {
  const safeName = path.basename(String(storageName || ""));
  if (!safeName || safeName !== String(storageName || "")) return null;
  return path.join(disputeEvidenceDirectory, safeName);
}

// Remove files when a later evidence operation fails.
function removePrivateEvidence(storageName) {
  const filePath = getPrivateEvidencePath(storageName);
  if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

// Export guarded storage helpers and upload middleware.
module.exports = { disputeEvidenceUpload, getPrivateEvidencePath, removePrivateEvidence, disputeEvidenceDirectory };
