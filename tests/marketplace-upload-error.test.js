const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// Confirm that invalid media no longer uses Multer's misleading unexpected-field error.
const uploadSource = fs.readFileSync(path.join(__dirname, "..", "utility", "marketplaceUpload.js"), "utf8");
assert.match(uploadSource, /Please upload a JPEG or PNG image/);
assert.doesNotMatch(uploadSource, /new multer\.MulterError\("LIMIT_UNEXPECTED_FILE", "image"\)/);

// Confirm that both marketplace mutation routes use the friendly upload wrapper.
const routeSource = fs.readFileSync(path.join(__dirname, "..", "routes", "marketplaceRoute.js"), "utf8");
assert.equal((routeSource.match(/handleMarketplaceImageUpload/g) || []).length, 3);

console.log("Marketplace upload error handling test: PASS");