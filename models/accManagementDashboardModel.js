const rbacModel = require("./rbacModel");
const requirementsModel = require("./requirementsModel");
const systemOverviewModel = require("./systemOverviewModel");
const complianceModel = require("./complianceModel");
const dataManagementModel = require("./dataManagementModel");
const performanceModel = require("./performanceModel");

async function getDashboardData() {
  const [access, requirements, overview, compliance, dataManagement, performance] = await Promise.all([
    rbacModel.getAdminOverview(),
    requirementsModel.getRequirements(),
    systemOverviewModel.getOverview(),
    complianceModel.getDashboardSummary(),
    dataManagementModel.getDashboard(),
    performanceModel.getDashboard(),
  ]);

  const completeRequirements = requirements.filter((requirement) => requirement.coverage_status === "complete").length;
  const healthyIntegrations = overview.integrations.filter((integration) => integration.status === "healthy").length;

  return {
    access,
    requirements,
    overview,
    compliance,
    dataManagement,
    performance,
    metrics: {
      users: access.users.length,
      roles: access.roles.length,
      requirements: requirements.length,
      completeRequirements,
      integrations: overview.integrations.length,
      healthyIntegrations,
      pendingKyc: compliance.pending_kyc,
      pendingBusiness: compliance.pending_business,
      openComplianceFlags: compliance.open_flags,
      integrityWarnings: dataManagement.integrity.filter((check) => check.status !== "passed").length,
      archivedRecords: dataManagement.archives.length,
      recoveryRequests: dataManagement.recovery.filter((item) => item.status !== "completed").length,
      performanceRequests: performance.summary.requests,
      performanceErrorRate: performance.summary.errorRate,
      performanceApiLatency: performance.summary.api_latency,
    },
  };
}

module.exports = { getDashboardData };
