const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const uploadDirectory = path.join(__dirname, "..", "public", "uploads", "mobile");
fs.mkdirSync(uploadDirectory, { recursive: true });
const allowed = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const storage = multer.diskStorage({ destination: (_req, _file, cb) => cb(null, uploadDirectory), filename: (_req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(12).toString("hex")}${path.extname(file.originalname).toLowerCase()}`) });
const mobileUpload = multer({ storage, limits: { fileSize: 8 * 1024 * 1024, files: 1 }, fileFilter: (_req, file, cb) => cb(null, allowed.has(file.mimetype)) });
module.exports = { mobileUpload };
