const assert = require("node:assert/strict");
const path = require("node:path");
const { publicImagePath } = require("../utility/marketplaceUpload");
const marketplaceModel = require("../models/marketplaceModel");

// Verify that upload metadata becomes a safe public URL and invalid media remains rejected.
assert.match(publicImagePath({ filename: "listing-image.png" }), /^\/uploads\/marketplace\/listing-image\.png$/);
assert.equal(publicImagePath(null), "");

const invalidMedia = marketplaceModel.validateMediaUpload([{ originalname: "listing-image.gif", size: 100 }]);
assert.equal(invalidMedia.success, false);

const oversizedMedia = marketplaceModel.validateMediaUpload([{ originalname: "listing-image.jpg", size: 2 * 1024 * 1024 + 1 }]);
assert.equal(oversizedMedia.success, false);

const validMedia = marketplaceModel.validateMediaUpload([{ originalname: "/uploads/marketplace/listing-image.jpg", size: 100 }]);
assert.equal(validMedia.success, true);
assert.deepEqual(validMedia.media, ["/uploads/marketplace/listing-image.jpg"]);

console.log("Marketplace upload test: PASS");