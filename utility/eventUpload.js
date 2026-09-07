const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const uploadDirectory = path.join(__dirname, "..", "public", "uploads", "events");
fs.mkdirSync(uploadDirectory, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, uploadDirectory),
  filename: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    callback(null, `${Date.now()}-${crypto.randomBytes(12).toString("hex")}${extension}`);
  },
});

function flyerFileFilter(_req, file, callback) {
  const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
  const allowedExtensions = [".jpg", ".jpeg", ".png", ".webp", ".pdf"];
  const extension = path.extname(file.originalname || "").toLowerCase();

  if (!allowedMimeTypes.includes(file.mimetype) || !allowedExtensions.includes(extension)) {
    const error = new Error("Please upload a JPEG, PNG, WebP, or PDF flyer.");
    error.code = "INVALID_EVENT_FLYER";
    return callback(error);
  }

  return callback(null, true);
}

const eventFlyerUpload = multer({
  storage,
  fileFilter: flyerFileFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});

function publicFlyerPath(file) {
  return file ? `/uploads/events/${file.filename}` : "";
}

function removeUploadedFlyer(file) {
  if (!file || !file.path) return;
  fs.unlink(file.path, () => {});
}

module.exports = { eventFlyerUpload, publicFlyerPath, removeUploadedFlyer };
