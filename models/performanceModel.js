const os = require("os");
const { performance } = require("perf_hooks");
const pool = require("../database/connection");

const PERFORMANCE_REQUIREMENTS = [
  ["ACC-FRS-PERF-001", "Fast response time", "Pages target 3000 ms and APIs target 500 ms average response time.", "critical"],
  ["ACC-FRS-PERF-002", "Concurrent user support", "The platform measures concurrent request activity and capacity posture.", "critical"],
  ["ACC-FRS-PERF-003", "Load balancing", "Traffic distribution and proxy posture are recorded for operations review.", "high"],
  ["ACC-FRS-PERF-004", "Horizontal scaling", "Environment instance ranges support adding application servers without downtime.", "critical"],
  ["ACC-FRS-PERF-005", "Vertical scaling", "CPU and memory capacity targets are recorded for resource upgrades.", "high"],
  ["ACC-FRS-PERF-006", "Caching mechanism", "Frequently accessed data can use a PostgreSQL-backed cache with TTL and hit tracking.", "high"],
  ["ACC-FRS-PERF-007", "CDN integration", "Static asset delivery posture and cache policy are visible to operators.", "medium"],
  ["ACC-FRS-PERF-008", "Performance monitoring", "Response time, error rate, throughput, and resource metrics are persisted.", "critical"],
  ["ACC-FRS-PERF-009", "Peak load handling", "Peak-load checks record capacity results and findings.", "critical"],
  ["ACC-FRS-PERF-010", "Performance optimization", "Optimization actions are tracked with measured before and after evidence.", "high"],
];

async function ensureSchema() {
  await pool.query(`
    ALTER TABLE requirements DROP CONSTRAINT IF EXISTS requirements_requirement_id_check;
    ALTER TABLE requirements ADD CONSTRAINT requirements_requirement_id_check CHECK (requirement_id ~ '^(FR-[A-Z0-9]+|ACC-FRS-PERF)-[0-9]{3}$');
    CREATE TABLE IF NOT EXISTS performance_request_metrics (
      id BIGSERIAL PRIMARY KEY,
      request_id VARCHAR(120),
      method VARCHAR(10) NOT NULL,
      path VARCHAR(500) NOT NULL,
      status_code INTEGER NOT NULL,
      response_time_ms INTEGER NOT NULL CHECK (response_time_ms >= 0),
      is_api BOOLEAN NOT NULL DEFAULT FALSE,
      error BOOLEAN NOT NULL DEFAULT FALSE,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      environment_key VARCHAR(30) NOT NULL DEFAULT 'development',
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS performance_capacity_profiles (
      id BIGSERIAL PRIMARY KEY,
      environment_key VARCHAR(30) NOT NULL UNIQUE,
      load_balancer_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      horizontal_scaling_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      vertical_scaling_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      cdn_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      cache_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      target_concurrency INTEGER NOT NULL DEFAULT 100 CHECK (target_concurrency > 0),
      cpu_limit_percent NUMERIC(5,2) NOT NULL DEFAULT 80 CHECK (cpu_limit_percent > 0 AND cpu_limit_percent <= 100),
      memory_limit_percent NUMERIC(5,2) NOT NULL DEFAULT 80 CHECK (memory_limit_percent > 0 AND memory_limit_percent <= 100),
      cache_provider VARCHAR(80) NOT NULL DEFAULT 'PostgreSQL shared cache',
      cdn_provider VARCHAR(120),
      updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS performance_cache_entries (
      cache_key VARCHAR(240) PRIMARY KEY,
      payload JSONB NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      hit_count INTEGER NOT NULL DEFAULT 0 CHECK (hit_count >= 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS performance_peak_load_checks (
      id BIGSERIAL PRIMARY KEY,
      environment_key VARCHAR(30) NOT NULL,
      requested_concurrency INTEGER NOT NULL CHECK (requested_concurrency > 0),
      observed_requests INTEGER NOT NULL DEFAULT 0,
      average_response_time_ms INTEGER,
      error_rate NUMERIC(7,4),
      status VARCHAR(30) NOT NULL CHECK (status IN ('passed','warning','failed')),
      findings JSONB NOT NULL DEFAULT '{}'::jsonb,
      checked_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      checked_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS performance_optimization_actions (
      id BIGSERIAL PRIMARY KEY,
      title VARCHAR(200) NOT NULL,
      area VARCHAR(80) NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','in_progress','completed','rejected')),
      baseline_response_time_ms INTEGER,
      measured_response_time_ms INTEGER,
      notes TEXT,
      owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      completed_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS performance_metrics_created_idx ON performance_request_metrics(created_at DESC);
    CREATE INDEX IF NOT EXISTS performance_metrics_path_idx ON performance_request_metrics(path, created_at DESC);
    CREATE INDEX IF NOT EXISTS performance_metrics_api_idx ON performance_request_metrics(is_api, created_at DESC);
    CREATE INDEX IF NOT EXISTS performance_peak_checks_created_idx ON performance_peak_load_checks(checked_at DESC);
    INSERT INTO performance_capacity_profiles (environment_key, load_balancer_enabled, horizontal_scaling_enabled, vertical_scaling_enabled, cdn_enabled, cache_enabled, target_concurrency, cache_provider, cdn_provider)
    VALUES ('development', FALSE, TRUE, TRUE, FALSE, TRUE, 50, 'PostgreSQL shared cache', NULL), ('staging', TRUE, TRUE, TRUE, TRUE, TRUE, 500, 'PostgreSQL shared cache', 'Configured deployment CDN'), ('production', TRUE, TRUE, TRUE, TRUE, TRUE, 2000, 'PostgreSQL shared cache', 'Configured deployment CDN')
    ON CONFLICT (environment_key) DO NOTHING;
  `);
  await pool.query(`INSERT INTO permissions (permission_key, resource, action, description) VALUES ('admin.performance.read','admin_performance','read','View performance telemetry, capacity, scaling, caching, CDN, and optimization evidence.'), ('admin.performance.manage','admin_performance','manage','Manage performance profiles, peak-load checks, and optimization actions.') ON CONFLICT (permission_key) DO NOTHING`);
  await pool.query(`INSERT INTO role_permissions (role_id, permission_id) SELECT r.id, p.id FROM roles r CROSS JOIN permissions p WHERE r.role_key IN ('compliance_officer','platform_admin','system_admin','acc_management_admin','super_admin') AND p.permission_key IN ('admin.performance.read','admin.performance.manage') ON CONFLICT DO NOTHING`);
  for (const [requirementId, name, description, priority] of PERFORMANCE_REQUIREMENTS) {
    await pool.query(`INSERT INTO requirements (requirement_id, name, description, actor, preconditions, postconditions, priority, category, dependencies) VALUES ($1,$2,$3,'Operations administrator','PostgreSQL and application telemetry are available.','Performance evidence is persisted and reviewable.',$4,'non_functional',ARRAY['performance_request_metrics','performance_capacity_profiles']) ON CONFLICT (requirement_id) DO NOTHING`, [requirementId, name, description, priority]);
  }
}

function requestId(req) {
  return req.headers["x-request-id"] || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function recordRequest(input = {}) {
  await pool.query(`INSERT INTO performance_request_metrics (request_id, method, path, status_code, response_time_ms, is_api, error, user_id, environment_key) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [input.requestId || null, input.method || "GET", String(input.path || "/").slice(0, 500), Number(input.statusCode || 0), Math.max(0, Math.round(Number(input.responseTimeMs) || 0)), Boolean(input.isApi), Number.isInteger(Number(input.userId)) ? Number(input.userId) : null, process.env.DEPLOYMENT_ENV || "development"]);
}

async function getCached(cacheKey) {
  const result = await pool.query(`UPDATE performance_cache_entries SET hit_count = hit_count + 1, updated_at = CURRENT_TIMESTAMP WHERE cache_key = $1 AND expires_at > CURRENT_TIMESTAMP RETURNING payload`, [cacheKey]);
  return result.rows[0] ? result.rows[0].payload : null;
}

async function setCached(cacheKey, payload, ttlSeconds = 60) {
  await pool.query(`INSERT INTO performance_cache_entries (cache_key, payload, expires_at) VALUES ($1, $2, CURRENT_TIMESTAMP + ($3 * INTERVAL '1 second')) ON CONFLICT (cache_key) DO UPDATE SET payload = EXCLUDED.payload, expires_at = EXCLUDED.expires_at, updated_at = CURRENT_TIMESTAMP`, [cacheKey, payload, Math.max(1, Number(ttlSeconds) || 60)]);
  return payload;
}

function requestMiddleware() {
  return (req, res, next) => {
    const startedAt = performance.now();
    const id = requestId(req);
    res.setHeader("X-Request-ID", id);
    res.once("finish", () => {
      recordRequest({ requestId: id, method: req.method, path: req.originalUrl || req.path, statusCode: res.statusCode, responseTimeMs: performance.now() - startedAt, isApi: (req.originalUrl || req.path).startsWith("/api/"), userId: req.session && req.session.user ? req.session.user.id : null }).catch((error) => console.error("Performance metric capture failed:", error.message));
    });
    next();
  };
}

async function getDashboard() {
  await pool.query("DELETE FROM performance_cache_entries WHERE expires_at <= CURRENT_TIMESTAMP");
  const [summary, recent, profiles, peakChecks, optimizations, cache] = await Promise.all([
    getCached("performance:summary:24h").then((cached) => cached ? { rows: [cached] } : pool.query(`SELECT COUNT(*)::integer AS requests, COUNT(*) FILTER (WHERE error)::integer AS errors, COALESCE(ROUND(AVG(response_time_ms) FILTER (WHERE is_api)),0)::integer AS api_latency, COALESCE(ROUND(AVG(response_time_ms)),0)::integer AS page_latency, COUNT(DISTINCT user_id)::integer AS concurrent_users FROM performance_request_metrics WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'`).then(async (result) => { await setCached("performance:summary:24h", result.rows[0], 15); return result; })),
    pool.query(`SELECT method, path, status_code AS "statusCode", response_time_ms AS "responseTimeMs", is_api AS "isApi", error, environment_key AS "environmentKey", created_at AS "createdAt" FROM performance_request_metrics ORDER BY created_at DESC LIMIT 30`),
    pool.query(`SELECT environment_key AS "environmentKey", load_balancer_enabled AS "loadBalancerEnabled", horizontal_scaling_enabled AS "horizontalScalingEnabled", vertical_scaling_enabled AS "verticalScalingEnabled", cdn_enabled AS "cdnEnabled", cache_enabled AS "cacheEnabled", target_concurrency AS "targetConcurrency", cpu_limit_percent AS "cpuLimitPercent", memory_limit_percent AS "memoryLimitPercent", cache_provider AS "cacheProvider", cdn_provider AS "cdnProvider", updated_at AS "updatedAt" FROM performance_capacity_profiles ORDER BY environment_key`),
    pool.query(`SELECT id, environment_key AS "environmentKey", requested_concurrency AS "requestedConcurrency", observed_requests AS "observedRequests", average_response_time_ms AS "averageResponseTimeMs", error_rate AS "errorRate", status, findings, checked_at AS "checkedAt" FROM performance_peak_load_checks ORDER BY checked_at DESC LIMIT 20`),
    pool.query(`SELECT id, title, area, status, baseline_response_time_ms AS "baselineResponseTimeMs", measured_response_time_ms AS "measuredResponseTimeMs", notes, created_at AS "createdAt", completed_at AS "completedAt" FROM performance_optimization_actions ORDER BY created_at DESC LIMIT 20`),
    pool.query(`SELECT COUNT(*)::integer AS entries, COALESCE(SUM(hit_count),0)::integer AS hits FROM performance_cache_entries WHERE expires_at > CURRENT_TIMESTAMP`),
  ]);
  const row = summary.rows[0];
  return { summary: { ...row, errorRate: row.requests ? Number(((Number(row.errors) / Number(row.requests)) * 100).toFixed(2)) : 0 }, recent: recent.rows, profiles: profiles.rows, peakChecks: peakChecks.rows, optimizations: optimizations.rows, cache: cache.rows[0] };
}

async function updateProfile(actorId, environmentKey, input = {}) {
  const result = await pool.query(`UPDATE performance_capacity_profiles SET load_balancer_enabled=$1, horizontal_scaling_enabled=$2, vertical_scaling_enabled=$3, cdn_enabled=$4, cache_enabled=$5, target_concurrency=$6, cpu_limit_percent=$7, memory_limit_percent=$8, cache_provider=$9, cdn_provider=$10, updated_by=$11, updated_at=CURRENT_TIMESTAMP WHERE environment_key=$12 RETURNING environment_key`, [input.loadBalancerEnabled === "on", input.horizontalScalingEnabled === "on", input.verticalScalingEnabled === "on", input.cdnEnabled === "on", input.cacheEnabled === "on", Math.max(1, Number(input.targetConcurrency) || 100), Math.min(100, Math.max(1, Number(input.cpuLimitPercent) || 80)), Math.min(100, Math.max(1, Number(input.memoryLimitPercent) || 80)), String(input.cacheProvider || "PostgreSQL shared cache").slice(0, 80), String(input.cdnProvider || "").slice(0, 120) || null, actorId, environmentKey]);
  return result.rows[0];
}

async function runPeakLoadCheck(actorId, environmentKey, requestedConcurrency) {
  const result = await pool.query(`SELECT COUNT(*)::integer AS observed, COALESCE(ROUND(AVG(response_time_ms)),0)::integer AS latency, COALESCE(ROUND((COUNT(*) FILTER (WHERE error)::numeric / NULLIF(COUNT(*),0))*100,2),0) AS error_rate FROM performance_request_metrics WHERE environment_key=$1 AND created_at >= CURRENT_TIMESTAMP - INTERVAL '15 minutes'`, [environmentKey]);
  const row = result.rows[0];
  const profile = await pool.query(`SELECT target_concurrency FROM performance_capacity_profiles WHERE environment_key=$1`, [environmentKey]);
  const target = Number(profile.rows[0] ? profile.rows[0].target_concurrency : 100);
  const status = Number(row.latency) <= 3000 && Number(row.error_rate) < 5 && Number(requestedConcurrency) <= target ? "passed" : Number(row.error_rate) < 10 ? "warning" : "failed";
  return pool.query(`INSERT INTO performance_peak_load_checks (environment_key, requested_concurrency, observed_requests, average_response_time_ms, error_rate, status, findings, checked_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`, [environmentKey, Number(requestedConcurrency), Number(row.observed), Number(row.latency), Number(row.error_rate), status, { targetConcurrency: target, responseTargetMs: 3000 }, actorId]);
}

async function createOptimization(actorId, input = {}) {
  return pool.query(`INSERT INTO performance_optimization_actions (title, area, status, baseline_response_time_ms, measured_response_time_ms, notes, owner_id) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`, [String(input.title || "").trim().slice(0, 200), String(input.area || "query").slice(0, 80), ["planned", "in_progress", "completed", "rejected"].includes(input.status) ? input.status : "planned", input.baselineResponseTimeMs ? Number(input.baselineResponseTimeMs) : null, input.measuredResponseTimeMs ? Number(input.measuredResponseTimeMs) : null, String(input.notes || "").trim(), actorId]);
}

module.exports = { ensureSchema, requestMiddleware, getDashboard, updateProfile, runPeakLoadCheck, createOptimization, recordRequest, getCached, setCached };
