const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const uploadDirectory = path.join(__dirname, "..", "public", "uploads", "business");
fs.mkdirSync(uploadDirectory, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, uploadDirectory),
  filename: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    callback(null, `${Date.now()}-${crypto.randomBytes(12).toString("hex")}${extension}`);
  },
});

function logoFileFilter(_req, file, callback) {
  const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];
  const allowedExtensions = [".jpg", ".jpeg", ".png", ".webp"];
  const extension = path.extname(file.originalname || "").toLowerCase();

  if (!allowedMimeTypes.includes(file.mimetype) || !allowedExtensions.includes(extension)) {
    const error = new Error("Please upload a JPEG, PNG, or WebP logo image.");
    error.code = "INVALID_BUSINESS_LOGO";
    return callback(error);
  }

  return callback(null, true);
}

const businessLogoUpload = multer({
  storage,
  fileFilter: logoFileFilter,
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
});

function publicLogoPath(file) {
  return file ? `/uploads/business/${file.filename}` : "";
}

function removeUploadedLogo(file) {
  if (!file || !file.path) return;
  fs.unlink(file.path, () => {});
}

module.exports = { businessLogoUpload, publicLogoPath, removeUploadedLogo };
