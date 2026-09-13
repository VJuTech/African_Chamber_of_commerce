function workspacePage(req, res) {
  const user = req.session && req.session.user ? req.session.user : {};
  const hasManagementAccess = Array.isArray(user.roles)
    && user.roles.some((role) => [
      "acc_management_admin",
      "system_admin",
      "platform_admin",
      "super_admin",
      "moderator",
      "support_staff",
      "compliance_officer",
    ].includes(role));

  return res.render("workspace", {
    title: "ACC Workspace",
    user,
    hasManagementAccess,
  });
}

module.exports = { workspacePage };
