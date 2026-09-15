const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const performanceModel = require(path.join(root, "models", "performanceModel"));

for (const method of ["ensureSchema", "requestMiddleware", "getDashboard", "updateProfile", "runPeakLoadCheck", "createOptimization", "recordRequest", "getCached", "setCached"]) {
  assert.equal(typeof performanceModel[method], "function", `Missing performance model method: ${method}`);
}

const rebuildSql = fs.readFileSync(path.join(root, "database", "rebuild.sql"), "utf8");
for (let index = 1; index <= 10; index += 1) {
  const requirementId = `ACC-FRS-PERF-${String(index).padStart(3, "0")}`;
  assert.ok(rebuildSql.includes(requirementId), `Missing Chapter 36 requirement: ${requirementId}`);
}
for (const table of ["performance_request_metrics", "performance_capacity_profiles", "performance_cache_entries", "performance_peak_load_checks", "performance_optimization_actions"]) {
  assert.ok(rebuildSql.includes(table), `Missing Chapter 36 table: ${table}`);
}
assert.ok(rebuildSql.includes("admin.performance.read"));
assert.ok(rebuildSql.includes("admin.performance.manage"));
assert.ok(fs.readFileSync(path.join(root, "models", "performanceModel.js"), "utf8").includes("require(\"../database/connection\")"));
assert.ok(fs.existsSync(path.join(root, "views", "admin", "performance.ejs")));
assert.ok(fs.existsSync(path.join(root, "public", "styles", "performance.css")));
console.log("Chapter 36 performance contract: PASS");
