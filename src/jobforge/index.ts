import {
  buildJobRequest,
  createJobBatch,
  type RequestBuilderOptions,
  type JobBatch,
} from '@autopilot/jobforge-client';
import type {
  TenantContext,
  JobRequest,
} from '@autopilot/contracts';
import {
  type AlertCorrelation,
  type Runbook,
  type ReliabilityReport,
  generateId,
} from '../contracts/index.js';

/**
 * JobForge Request Generators for Ops Autopilot
 * 
 * IMPORTANT: This module generates JobForge job requests but does NOT execute them.
 * All requests have:
 * - auto_execute: false (runnerless - no local execution)
 * - require_approval: true (human approval required)
 * - require_policy_token: true (policy enforcement)
 */

// ============================================================================
// Default Constraints (Runnerless Enforcement)
// ============================================================================

const DEFAULT_OPS_CONSTRAINTS: RequestBuilderOptions = {
  autoExecute: false,
  requireApproval: true,
  triggeredBy: 'ops-autopilot',
};

// ============================================================================
// Alert Correlation Job Requests
// ============================================================================

export interface AlertCorrelationJobPayload {
  alert_ids: string[];
  correlation_id?: string;
  time_window_minutes?: number;
  rules_override?: Array<{
    rule_id: string;
    enabled: boolean;
  }>;
  profile_id: string;
}

/**
 * Create a job request to correlate alerts
 */
export function createAlertCorrelationRequest(
  tenantContext: TenantContext,
  payload: AlertCorrelationJobPayload,
  options?: RequestBuilderOptions
): JobRequest {
  return buildJobRequest(
    tenantContext,
    'autopilot.ops.alert_correlate',
    payload,
    { ...DEFAULT_OPS_CONSTRAINTS, ...options }
  );
}

/**
 * Create job requests from an AlertCorrelation result
 */
export function createAlertCorrelationJobs(
  tenantContext: TenantContext,
  correlation: AlertCorrelation,
  options?: RequestBuilderOptions
): JobRequest[] {
  const jobs: JobRequest[] = [];
  
  // Create jobs for each correlated group that needs investigation
  for (const group of correlation.groups) {
    if (group.blast_radius.estimated_impact === 'high' || 
        group.blast_radius.estimated_impact === 'critical') {
      jobs.push(
        buildJobRequest(
          tenantContext,
          'autopilot.ops.alert_correlate',
          {
            correlation_group_id: group.group_id,
            alert_ids: group.alerts.map(a => a.alert_id),
            root_cause: group.root_cause_analysis.probable_cause,
            confidence: group.root_cause_analysis.confidence,
            services_affected: group.blast_radius.services_affected,
            action: 'investigate_and_notify',
            profile_id: correlation.profile_id,
          },
          {
            ...DEFAULT_OPS_CONSTRAINTS,
            ...options,
            priority: 'critical',
            notes: `High-impact alert correlation: ${group.root_cause_analysis.probable_cause}`,
          }
        )
      );
    }
  }
  
  return jobs;
}

// ============================================================================
// Runbook Generation Job Requests
// ============================================================================

export interface RunbookGenerationJobPayload {
  runbook_id?: string;
  alert_group_id: string;
  alert_ids: string[];
  root_cause: string;
  affected_services: string[];
  severity: string;
  include_rollback: boolean;
  include_automation: boolean;
  profile_id: string;
}

/**
 * Create a job request to generate a runbook
 */
export function createRunbookGenerationRequest(
  tenantContext: TenantContext,
  payload: RunbookGenerationJobPayload,
  options?: RequestBuilderOptions
): JobRequest {
  return buildJobRequest(
    tenantContext,
    'autopilot.ops.runbook_generate',
    {
      ...payload,
      runbook_id: payload.runbook_id ?? generateId(),
    },
    { ...DEFAULT_OPS_CONSTRAINTS, ...options }
  );
}

/**
 * Create job requests from a generated Runbook
 */
export function createRunbookJobs(
  tenantContext: TenantContext,
  runbook: Runbook,
  options?: RequestBuilderOptions
): JobRequest[] {
  const jobs: JobRequest[] = [];
  
  // Create jobs for automated steps in the runbook
  const automatedSteps = runbook.steps.filter(step => step.automated);
  
  if (automatedSteps.length > 0) {
    jobs.push(
      buildJobRequest(
        tenantContext,
        'autopilot.ops.runbook_generate',
        {
          runbook_id: runbook.runbook_id,
          action: 'execute_automated_steps',
          automated_step_numbers: automatedSteps.map(s => s.step_number),
          requires_approval_before_each: automatedSteps.some(s => s.requires_approval),
          estimated_duration_minutes: runbook.estimated_duration_minutes,
          profile_id: 'base',
        },
        {
          ...DEFAULT_OPS_CONSTRAINTS,
          ...options,
          priority: runbook.severity === 'critical' ? 'critical' : 'high',
          notes: `Execute automated steps for runbook: ${runbook.name}`,
        }
      )
    );
  }
  
  // Create approval jobs for manual steps if critical
  if (runbook.severity === 'critical') {
    jobs.push(
      buildJobRequest(
        tenantContext,
        'autopilot.ops.runbook_generate',
        {
          runbook_id: runbook.runbook_id,
          action: 'notify_oncall',
          severity: runbook.severity,
          steps_require_manual: runbook.steps.filter(s => !s.automated).length,
          profile_id: 'base',
        },
        {
          ...DEFAULT_OPS_CONSTRAINTS,
          ...options,
          priority: 'critical',
          notes: `Critical runbook requires manual intervention: ${runbook.name}`,
        }
      )
    );
  }
  
  return jobs;
}

// ============================================================================
// Reliability Report Job Requests
// ============================================================================

export interface ReliabilityReportJobPayload {
  report_id?: string;
  report_type: 'incident_postmortem' | 'health_check' | 'trend_analysis' | 'compliance';
  period_start: string;
  period_end: string;
  services?: string[];
  include_anomalies: boolean;
  include_recommendations: boolean;
  profile_id: string;
}

/**
 * Create a job request to generate a reliability report
 */
export function createReliabilityReportRequest(
  tenantContext: TenantContext,
  payload: ReliabilityReportJobPayload,
  options?: RequestBuilderOptions
): JobRequest {
  return buildJobRequest(
    tenantContext,
    'autopilot.ops.reliability_report',
    {
      ...payload,
      report_id: payload.report_id ?? generateId(),
    },
    { ...DEFAULT_OPS_CONSTRAINTS, ...options }
  );
}

/**
 * Create job requests from a ReliabilityReport result
 */
export function createReliabilityReportJobs(
  tenantContext: TenantContext,
  report: ReliabilityReport,
  options?: RequestBuilderOptions
): JobRequest[] {
  const jobs: JobRequest[] = [];
  
  // Create jobs for critical recommendations
  const criticalRecommendations = report.recommendations.filter(
    r => r.priority === 'critical'
  );
  
  for (const rec of criticalRecommendations) {
    jobs.push(
      buildJobRequest(
        tenantContext,
        'autopilot.ops.reliability_report',
        {
          report_id: report.report_id,
          action: 'implement_recommendation',
          recommendation_id: generateId(),
          priority: rec.priority,
          category: rec.category,
          description: rec.description,
          expected_impact: rec.expected_impact,
          implementation_effort: rec.implementation_effort,
          profile_id: report.profile_id,
        },
        {
          ...DEFAULT_OPS_CONSTRAINTS,
          ...options,
          priority: 'critical',
          notes: `Critical reliability recommendation: ${rec.category}`,
        }
      )
    );
  }
  
  // Create jobs for high-priority anomalies
  const criticalAnomalies = report.anomalies.filter(
    a => a.severity === 'critical'
  );
  
  for (const anomaly of criticalAnomalies) {
    jobs.push(
      buildJobRequest(
        tenantContext,
        'autopilot.ops.reliability_report',
        {
          report_id: report.report_id,
          action: 'investigate_anomaly',
          anomaly_id: anomaly.anomaly_id,
          service: anomaly.service,
          metric: anomaly.metric,
          severity: anomaly.severity,
          deviation_percent: anomaly.deviation_percent,
          profile_id: report.profile_id,
        },
        {
          ...DEFAULT_OPS_CONSTRAINTS,
          ...options,
          priority: 'critical',
          notes: `Investigate critical anomaly in ${anomaly.service}:${anomaly.metric}`,
        }
      )
    );
  }
  
  return jobs;
}

// ============================================================================
// Batch Operations
// ============================================================================

/**
 * Create a batch of all ops jobs from a complete analysis
 */
export function createOpsJobBatch(
  tenantContext: TenantContext,
  correlation?: AlertCorrelation,
  runbooks?: Runbook[],
  report?: ReliabilityReport,
  options?: RequestBuilderOptions
): JobBatch {
  const allJobs: JobRequest[] = [];
  
  if (correlation) {
    allJobs.push(...createAlertCorrelationJobs(tenantContext, correlation, options));
  }
  
  if (runbooks) {
    for (const runbook of runbooks) {
      allJobs.push(...createRunbookJobs(tenantContext, runbook, options));
    }
  }
  
  if (report) {
    allJobs.push(...createReliabilityReportJobs(tenantContext, report, options));
  }
  
  return createJobBatch(allJobs, tenantContext);
}

// ============================================================================
// Re-exports
// ============================================================================

export {
  type RequestBuilderOptions,
  type JobBatch,
  createJobBatch,
  groupJobsByType,
  serializeJobRequest,
  serializeJobBatch,
  serializeJobsAsJsonLines,
  validateJobRequest,
} from '@autopilot/jobforge-client';
