const assert = require("assert");
const requirementsModel = require("../models/requirementsModel");

assert.deepStrictEqual(requirementsModel.priorityValues, ["critical", "high", "medium", "low"]);
assert.deepStrictEqual(requirementsModel.categoryValues, ["functional", "non_functional", "security", "performance"]);
assert.deepStrictEqual(requirementsModel.coverageValues, ["complete", "partial", "missing", "blocked"]);
assert.equal(typeof requirementsModel.getRequirements, "function");
assert.equal(typeof requirementsModel.getRequirementById, "function");
assert.equal(typeof requirementsModel.createRequirement, "function");
assert.equal(typeof requirementsModel.updateCoverage, "function");

console.log("Chapter 5 requirements model contract: PASS");
