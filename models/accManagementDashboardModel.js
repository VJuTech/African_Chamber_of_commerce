const rbacModel = require("./rbacModel");
const requirementsModel = require("./requirementsModel");
const systemOverviewModel = require("./systemOverviewModel");
const complianceModel = require("./complianceModel");
const dataManagementModel = require("./dataManagementModel");
const performanceModel = require("./performanceModel");
const availabilityModel = require("./availabilityModel");
const supportModel = require("./supportModel");
const loggingModel = require("./loggingModel");
const qaModel = require("./qaModel");
const releaseModel = require("./releaseModel");
const onboardingModel = require("./onboardingModel");
const aiModel = require("./aiModel");
const partnershipModel = require("./partnershipModel");
const roadmapModel = require("./roadmapModel");

async function getDashboardData() {
  const [access, requirements, overview, compliance, dataManagement, performance, availability, support, logging, qa, release, onboarding, ai, partnerships, roadmap] = await Promise.all([
    rbacModel.getAdminOverview(),
    requirementsModel.getRequirements(),
    systemOverviewModel.getOverview(),
    complianceModel.getDashboardSummary(),
    dataManagementModel.getDashboard(),
    performanceModel.getDashboard(),
    availabilityModel.getDashboard(),
    supportModel.getDashboard(),
    loggingModel.getDashboard(),
    qaModel.getDashboard(),
    releaseModel.getDashboard(),
    onboardingModel.getDashboard(),
    aiModel.getAdminDashboard(),
    partnershipModel.getDashboard(),
    roadmapModel.getAdminDashboard(),
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
    availability,
    support,
    logging,
    qa,
    release,
    onboarding,
    ai,
    partnerships,
    roadmap,
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
      availabilityRate: availability.uptime.rate,
      availabilityIncidents: availability.incidents.filter((item) => item.status !== "resolved").length,
      availabilityHealthyServices: availability.services.filter((item) => item.lastStatus === "healthy").length,
      availabilityServices: availability.services.length,
      supportOpenTickets: Number(support.metrics.open),
      supportCriticalTickets: Number(support.metrics.critical),
      supportTotalTickets: Number(support.metrics.total),
      loggingFailures: Number(logging.counts.failures),
      loggingCriticalEvents: Number(logging.counts.critical),
      loggingOpenAlerts: logging.alerts.filter((alert) => alert.status === "open").length,
      qaCases: qa.counts.totalCases,
      qaFailedRuns: qa.counts.failed,
      qaOpenBugs: qa.counts.openBugs,
      qaCriticalBugs: qa.counts.criticalBugs,
      releasePlanned: release.counts.planned,
      releaseMonitoring: release.counts.activeMonitoring,
      releaseCompatibility: release.counts.openCompatibility,
      onboardingActiveJobs: onboarding.counts.activeJobs,
      onboardingErrors: onboarding.counts.errors,
      onboardingImported: onboarding.counts.imported,
      onboardingAssistance: onboarding.counts.assistance,
      aiOpenCases: ai.metrics.openCases,
      aiUnreadAlerts: ai.metrics.unreadAlerts,
      aiRecommendations: ai.metrics.recommendations,
      aiSearches: ai.metrics.searches,
      partners: Number(partnerships.metrics.total),
      activePartners: Number(partnerships.metrics.active),
      partnerOnboarding: Number(partnerships.metrics.onboarding),
      partnerExchanges: Number(partnerships.metrics.exchanges_24h),
      roadmapFeatures: Number(roadmap.metrics.features),
      roadmapActiveFeatures: Number(roadmap.metrics.active_features),
      roadmapReleasedFeatures: Number(roadmap.metrics.released_features),
      roadmapNewFeedback: Number(roadmap.metrics.new_feedback),
      roadmapActiveInnovations: Number(roadmap.metrics.active_innovations),
      roadmapOpenEvaluations: Number(roadmap.metrics.open_evaluations),
      roadmapScalabilityAttention: roadmap.scalability.filter((item) => ["planned", "blocked"].includes(item.status)).length,
    },
  };
}

module.exports = { getDashboardData };
