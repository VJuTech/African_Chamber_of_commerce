const fs = require("fs");
const path = require("path");
const multer = require("multer");

const directory = path.join(__dirname, "..", "storage", "compliance");
fs.mkdirSync(directory, { recursive: true });

const allowedTypes = new Set(["application/pdf", "image/jpeg", "image/png"]);

const storage = multer.diskStorage({
  destination: directory,
  filename: (req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    callback(null, `kyc-${req.session.user.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${extension}`);
  },
});

const kycUpload = multer({
  storage,
  limits: { files: 4, fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, callback) => callback(null, allowedTypes.has(file.mimetype)),
});

module.exports = { kycUpload };
