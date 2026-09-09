const rbacModel = require("./rbacModel");
const requirementsModel = require("./requirementsModel");
const systemOverviewModel = require("./systemOverviewModel");

async function getDashboardData() {
  const [access, requirements, overview] = await Promise.all([
    rbacModel.getAdminOverview(),
    requirementsModel.getRequirements(),
    systemOverviewModel.getOverview(),
  ]);

  const completeRequirements = requirements.filter((requirement) => requirement.coverage_status === "complete").length;
  const healthyIntegrations = overview.integrations.filter((integration) => integration.status === "healthy").length;

  return {
    access,
    requirements,
    overview,
    metrics: {
      users: access.users.length,
      roles: access.roles.length,
      requirements: requirements.length,
      completeRequirements,
      integrations: overview.integrations.length,
      healthyIntegrations,
    },
  };
}

module.exports = { getDashboardData };
