/**
 * Ops Autopilot - Runnerless Reliability Autopilot
 * 
 * A runnerless module that:
 * - Consumes events, manifests, and log summaries
 * - Detects infrastructure anomalies
 * - Produces diagnoses and recommendations
 * - Outputs JobForge job requests (without owning execution)
 * 
 * All job requests enforce:
 * - auto_execute: false (no local execution)
 * - require_approval: true (human approval required)
 * - require_policy_token: true (policy enforcement)
 */

// ============================================================================
// Contract Exports
// ============================================================================

export {
  // Base schemas
  TenantIdSchema,
  ProjectIdSchema,
  EventIdSchema,
  TimestampSchema,
  HashSchema,
  SeveritySchema,
  EvidenceLinkSchema,
  FindingSchema,
  JobRequestSchema,
  type TenantContext,
  type Severity,
  type EvidenceLink,
  type Finding,
  type JobRequest,
  
  // Alert schemas
  AlertSchema,
  AlertSourceSchema,
  AlertStatusSchema,
  CorrelationRuleSchema,
  CorrelatedAlertGroupSchema,
  AlertCorrelationSchema,
  type Alert,
  type AlertSource,
  type AlertStatus,
  type CorrelationRule,
  type CorrelatedAlertGroup,
  type AlertCorrelation,
  
  // Runbook schemas
  RunbookSchema,
  RunbookStepSchema,
  type Runbook,
  type RunbookStep,
  
  // Report schemas
  ReliabilityMetricSchema,
  InfrastructureHealthSchema,
  AnomalyDetectionSchema,
  ReliabilityReportSchema,
  type ReliabilityMetric,
  type InfrastructureHealth,
  type AnomalyDetection,
  type ReliabilityReport,
  
  // Input schemas
  IngestInputSchema,
  CorrelationInputSchema,
  RunbookInputSchema,
  ReportInputSchema,
  type IngestInput,
  type CorrelationInput,
  type RunbookInput,
  type ReportInput,
  
  // Utilities
  generateId,
  computeHash,
} from './contracts/index.js';

// ============================================================================
// Alert Correlation Exports
// ============================================================================

export {
  // Core functions
  correlateAlerts,
  createAlertCorrelation,
  filterAlerts,
  validateAlert,
  validateAlerts,
  sortAlertsBySeverity,
  getCriticalAlerts,
  getAlertsByService,
  calculateAlertMetrics,
  groupAlertsByService,
  groupAlertsBySource,
  
  // Constants
  defaultCorrelationRules,
  
  // Types
  type AlertFilter,
  type CorrelationResult,
} from './alerts/index.js';

// ============================================================================
// Runbook Generation Exports
// ============================================================================

export {
  // Core functions
  generateRunbook,
  validateRunbook,
  getAutomatedSteps,
  getManualSteps,
  getStepsRequiringApproval,
  calculateRunbookProgress,
  serializeRunbook,
} from './runbooks/index.js';

// ============================================================================
// JobForge Request Exports
// ============================================================================

export {
  // Request generators
  createAlertCorrelationRequest,
  createAlertCorrelationJobs,
  createRunbookGenerationRequest,
  createRunbookJobs,
  createReliabilityReportRequest,
  createReliabilityReportJobs,
  createOpsJobBatch,
  
  // Types
  type AlertCorrelationJobPayload,
  type RunbookGenerationJobPayload,
  type ReliabilityReportJobPayload,
  type RequestBuilderOptions,
  type JobBatch,
} from './jobforge/index.js';

export {
  analyze,
  validateBundle,
  validateReportBundle,
  renderReport,
  writeReportMarkdown,
  serializeBundle,
  serializeReport,
  type AnalyzeInput,
  type AnalyzeOptions,
} from './jobforge/integration.js';

// ============================================================================
// Profile Exports
// ============================================================================

export {
  // Profile functions
  getOpsProfile,
  listOpsProfiles,
  createOpsBaseProfile,
  createJobforgeOpsProfile,
  createSettlerOpsProfile,
  createReadyLayerOpsProfile,
  createAIASOpsProfile,
  createKeysOpsProfile,
  getOpsThreshold,
  checkOpsThreshold,
  
  // Re-exports from profiles
  type Profile,
  type ProfileConfig,
  type Threshold,
  baseProfile,
  getProfile,
  listProfiles,
  mergeProfileWithOverlay,
  validateProfile,
  serializeProfile,
} from './profiles/index.js';

// ============================================================================
// Version
// ============================================================================

export const VERSION = '0.1.0';
