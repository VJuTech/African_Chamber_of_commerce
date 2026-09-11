const crypto = require("crypto");
const apiModel = require("../models/apiModel");
const rbacModel = require("../models/rbacModel");

function requestId(req) {
  return req.get("x-request-id") || crypto.randomUUID();
}

function respond(res, status, message, details = {}) {
  return res.status(status).json({ success: false, message, ...details });
}

function apiKeyFromRequest(req) {
  const header = req.get("x-api-key") || "";
  if (header) return header.trim();
  const authorization = req.get("authorization") || "";
  return authorization.startsWith("ApiKey ") ? authorization.slice(7).trim() : "";
}

function apiGateway(resource, requiredScope = `api.${resource}.read`) {
  return async (req, res, next) => {
    const startedAt = Date.now();
    req.apiRequestId = requestId(req);
    res.setHeader("x-request-id", req.apiRequestId);

    const record = (statusCode, errorCode = null) => apiModel.recordRequest({
      clientId: req.apiClient && req.apiClient.clientId,
      apiKeyId: req.apiClient && req.apiClient.apiKeyId,
      userId: req.apiClient && req.apiClient.ownerId,
      method: req.method,
      path: req.originalUrl || req.path,
      version: req.apiVersion || "v1",
      statusCode,
      latencyMs: Date.now() - startedAt,
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
      requestId: req.apiRequestId,
      errorCode,
    }).catch((error) => console.error("API request audit failed:", error.message));

    res.on("finish", () => record(res.statusCode, res.statusCode >= 400 ? `HTTP_${res.statusCode}` : null));

    try {
      const client = await apiModel.authenticateKey(apiKeyFromRequest(req));
      if (!client) return respond(res, 401, "A valid API key is required.", { requestId: req.apiRequestId });
      req.apiClient = client;
      req.apiVersion = req.params.version || "v1";
      if (req.apiVersion !== "v1") return respond(res, 404, "This API version is not available.", { requestId: req.apiRequestId });

      const rate = await apiModel.consumeRateLimit(client.clientId, client.rateLimitPerMinute);
      res.setHeader("x-ratelimit-limit", rate.limit);
      res.setHeader("x-ratelimit-remaining", Math.max(0, rate.limit - rate.count));
      res.setHeader("x-ratelimit-reset", rate.resetAt.toISOString());
      if (!rate.allowed) return respond(res, 429, "API rate limit exceeded.", { requestId: req.apiRequestId, retryAfterSeconds: 60 });

      if (!client.scopes.includes(requiredScope)) {
        return respond(res, 403, "This API key is not scoped for the requested resource.", { requestId: req.apiRequestId });
      }

      req.apiAccess = await rbacModel.getUserAccessContext(client.ownerId);
      const hasPermission = req.apiAccess.permissions.includes(requiredScope);
      const isPlatformOperator = req.apiAccess.roles.some((role) => ["platform_admin", "system_admin", "acc_management_admin", "super_admin"].includes(role.key));
      if (!hasPermission && !isPlatformOperator) {
        return respond(res, 403, "The API client owner is not authorized for this resource.", { requestId: req.apiRequestId });
      }
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

module.exports = { apiGateway };
