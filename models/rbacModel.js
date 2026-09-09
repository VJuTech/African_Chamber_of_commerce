const pool = require("../database/connection");

const LEGACY_ROLE_MAP = {
  member: "registered_user",
  admin: "platform_admin",
  super_admin: "super_admin",
};

const ROLE_KEYS = [
  "registered_user",
  "verified_user",
  "business_member",
  "business_admin",
  "moderator",
  "compliance_officer",
  "platform_admin",
  "acc_management_admin",
  "super_admin",
];

function normalizeRoleKey(role) {
  const value = String(role || "").trim().toLowerCase();
  return LEGACY_ROLE_MAP[value] || value;
}

async function assignRole(userId, roleKey, options = {}) {
  const normalizedRole = normalizeRoleKey(roleKey);
  if (!userId || !ROLE_KEYS.includes(normalizedRole)) {
    return { success: false, message: "Invalid user or role." };
  }

  const result = await pool.query(
    `INSERT INTO user_roles (user_id, role_id, business_id, assigned_by)
     SELECT $1, r.id, $3, $4
     FROM roles r WHERE r.role_key = $2
     ON CONFLICT (user_id, role_id, business_id) DO NOTHING
     RETURNING id`,
    [Number(userId), normalizedRole, options.businessId || null, options.assignedBy || null]
  );

  return { success: true, assigned: result.rowCount > 0, roleKey: normalizedRole };
}

async function getUserAccessContext(userId) {
  if (!userId) return { roles: [], permissions: [], businesses: [] };

  const result = await pool.query(
    `SELECT r.role_key, r.display_name, r.hierarchy_level,
            p.permission_key, ur.business_id
     FROM user_roles ur
     JOIN roles r ON r.id = ur.role_id
     LEFT JOIN role_permissions rp ON rp.role_id = r.id
     LEFT JOIN permissions p ON p.id = rp.permission_id
     WHERE ur.user_id = $1
     ORDER BY r.hierarchy_level DESC, p.permission_key`,
    [Number(userId)]
  );

  const roles = new Map();
  const permissions = new Set();
  const businesses = new Set();
  for (const row of result.rows) {
    roles.set(row.role_key, {
      key: row.role_key,
      displayName: row.display_name,
      hierarchyLevel: row.hierarchy_level,
    });
    if (row.permission_key) permissions.add(row.permission_key);
    if (row.business_id) businesses.add(Number(row.business_id));
  }

  return {
    roles: [...roles.values()],
    permissions: [...permissions],
    businesses: [...businesses],
  };
}

async function ensureRegisteredUserRole(userId) {
  return assignRole(userId, "registered_user");
}

async function ensureVerifiedUserRole(userId) {
  await ensureRegisteredUserRole(userId);
  return assignRole(userId, "verified_user");
}

async function assignBusinessRoles(userId, businessId, assignedBy = null) {
  await ensureVerifiedUserRole(userId);
  await assignRole(userId, "business_member", { businessId, assignedBy });
  return assignRole(userId, "business_admin", { businessId, assignedBy });
}

async function getRoleOptions() {
  const result = await pool.query(
    `SELECT role_key, display_name, hierarchy_level, description
     FROM roles ORDER BY hierarchy_level`
  );
  return result.rows;
}

async function getAdminOverview() {
  const [usersResult, rolesResult, auditResult] = await Promise.all([
    pool.query(
      `SELECT u.id, u.name, u.email, u.status, u.role, u.email_verified,
              u.created_at, COALESCE(string_agg(DISTINCT r.display_name, ', ' ORDER BY r.display_name), '') AS assigned_roles
       FROM users u
       LEFT JOIN user_roles ur ON ur.user_id = u.id
       LEFT JOIN roles r ON r.id = ur.role_id
       GROUP BY u.id ORDER BY u.created_at DESC LIMIT 100`
    ),
    getRoleOptions(),
    pool.query(
      `SELECT id, event_type, user_id, outcome, details, created_at
       FROM audit_logs ORDER BY created_at DESC LIMIT 30`
    ),
  ]);

  return { users: usersResult.rows, roles: rolesResult, auditLogs: auditResult.rows };
}

async function assignPlatformRole(actorId, userId, roleKey) {
  const normalizedRole = normalizeRoleKey(roleKey);
  if (!ROLE_KEYS.includes(normalizedRole)) {
    return { success: false, message: "Unsupported role." };
  }

  const result = await assignRole(userId, normalizedRole, { assignedBy: actorId });
  if (normalizedRole === "platform_admin" || normalizedRole === "super_admin") {
    await pool.query("UPDATE users SET role = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2", [normalizedRole === "platform_admin" ? "admin" : "super_admin", Number(userId)]);
  }
  await pool.query(
    `INSERT INTO audit_logs (event_type, user_id, outcome, details)
     VALUES ('role_assigned', $1, $2, $3)`,
    [Number(userId), result.assigned ? "success" : "unchanged", JSON.stringify({ actorId, roleKey: normalizedRole })]
  );
  return { ...result, message: result.assigned ? "Role assigned successfully." : "User already has this role." };
}

module.exports = {
  ROLE_KEYS,
  normalizeRoleKey,
  assignRole,
  ensureRegisteredUserRole,
  ensureVerifiedUserRole,
  assignBusinessRoles,
  getUserAccessContext,
  getRoleOptions,
  getAdminOverview,
  assignPlatformRole,
};
