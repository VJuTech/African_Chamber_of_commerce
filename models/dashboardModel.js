function getDashboardSummary(user) {
  return {
    title: "Dashboard",
    user,
    summary: {
      status: user && user.status ? user.status : "Active",
      role: user && user.role ? user.role : "Member",
      email: user && user.email ? user.email : "Not available",
    },
  };
}

module.exports = {
  getDashboardSummary,
};
