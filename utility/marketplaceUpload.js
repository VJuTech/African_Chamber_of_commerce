/* marketplaceUpload.js - Secure image storage for marketplace listings. */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

// Store public listing images separately from private user uploads.
const marketplaceUploadDirectory = path.join(__dirname, "..", "public", "uploads", "marketplace");
fs.mkdirSync(marketplaceUploadDirectory, { recursive: true });

// Generate opaque filenames so user-supplied names cannot overwrite another asset.
const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, marketplaceUploadDirectory),
  filename: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    callback(null, `${Date.now()}-${crypto.randomBytes(12).toString("hex")}${extension}`);
  },
});

// Accept only the image types supported by the marketplace media contract.
function imageFileFilter(_req, file, callback) {
  const allowedMimeTypes = ["image/jpeg", "image/png"];
  const allowedExtensions = [".jpg", ".jpeg", ".png"];
  const extension = path.extname(file.originalname || "").toLowerCase();

  if (!allowedMimeTypes.includes(file.mimetype) || !allowedExtensions.includes(extension)) {
    const validationError = new Error("Please upload a JPEG or PNG image.");
    validationError.code = "INVALID_MARKETPLACE_IMAGE";
    return callback(validationError);
  }

  return callback(null, true);
}

// Limit uploads to one 2 MB product image per listing request.
const marketplaceImageUpload = multer({
  storage,
  fileFilter: imageFileFilter,
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
});

// Convert an uploaded disk file into the public URL stored in listing.media.
function publicImagePath(file) {
  return file ? `/uploads/marketplace/${file.filename}` : "";
}

// Remove an uploaded asset when listing persistence fails after the file is written.
function removeUploadedImage(file) {
  if (!file || !file.path) return;
  fs.unlink(file.path, () => {});
}

module.exports = { marketplaceImageUpload, publicImagePath, removeUploadedImage };