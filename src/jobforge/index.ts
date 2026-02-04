import {
  JobRequestSchema,
  batchJobRequests,
  serializeJobBatch,
  serializeJobRequest,
  type JobRequest,
  type TenantContext,
} from '@autopilot/contracts';
import { validateBatch, validateRequest } from '@autopilot/jobforge-client';
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
 * All requests enforce:
 * - requires_approval: true (human approval required)
 * - requires_policy_token: true (policy enforcement)
 * - runnerless metadata for JobForge gating
 */

export interface RunnerlessRequestOptions {
  priority?: 'low' | 'normal' | 'high' | 'critical';
  requestedAt?: string;
  expiresAt?: string;
  traceId?: string;
  evidenceLinks?: Array<{ type: string; id: string; description: string }>;
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  finops?: FinOpsMetadata;
}

export type RequestBuilderOptions = RunnerlessRequestOptions;

export type JobBatch = ReturnType<typeof batchJobRequests>;

export interface FinOpsMetadata {
  cost_center: string;
  budget_usd: number;
  max_cost_usd: number;
  estimated_cost_usd: number;
  owner: string;
}

export const DEFAULT_FINOPS_METADATA: FinOpsMetadata = {
  cost_center: 'ops-reliability',
  budget_usd: 50,
  max_cost_usd: 2,
  estimated_cost_usd: 0.5,
  owner: 'ops-finops',
};

export const MAX_JOB_REQUESTS_PER_BATCH = 25;

function buildRunnerlessJobRequest(
  tenantContext: TenantContext,
  job_type: JobRequest['job_type'],
  payload: Record<string, unknown>,
  options: RunnerlessRequestOptions = {}
): JobRequest {
  const metadata: Record<string, unknown> = {
    runnerless: true,
    triggered_by: 'ops-autopilot',
  };

  if (options.traceId) {
    metadata.trace_id = options.traceId;
  }

  metadata.finops = options.finops ?? DEFAULT_FINOPS_METADATA;

  return JobRequestSchema.parse({
    version: '1.0.0',
    job_type,
    tenant_context: tenantContext,
    priority: options.priority ?? 'normal',
    requested_at: options.requestedAt ?? new Date().toISOString(),
    expires_at: options.expiresAt,
    payload,
    evidence_links: options.evidenceLinks ?? [],
    policy: {
      requires_policy_token: true,
      requires_approval: true,
      risk_level: options.riskLevel ?? 'high',
      required_scopes: [],
      compliance_tags: [],
    },
    metadata,
  });
}

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

export function createAlertCorrelationRequest(
  tenantContext: TenantContext,
  payload: AlertCorrelationJobPayload,
  options?: RunnerlessRequestOptions
): JobRequest {
  return buildRunnerlessJobRequest(
    tenantContext,
    'autopilot.ops.alert_correlate',
    payload as unknown as Record<string, unknown>,
    options
  );
}

export function createAlertCorrelationJobs(
  tenantContext: TenantContext,
  correlation: AlertCorrelation,
  options?: RunnerlessRequestOptions
): JobRequest[] {
  const jobs: JobRequest[] = [];

  for (const group of correlation.groups) {
    if (
      group.blast_radius.estimated_impact === 'high' ||
      group.blast_radius.estimated_impact === 'critical'
    ) {
      jobs.push(
        buildRunnerlessJobRequest(
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
            ...options,
            priority: 'critical',
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

export function createRunbookGenerationRequest(
  tenantContext: TenantContext,
  payload: RunbookGenerationJobPayload,
  options?: RunnerlessRequestOptions
): JobRequest {
  return buildRunnerlessJobRequest(
    tenantContext,
    'autopilot.ops.runbook_generate',
    {
      ...payload,
      runbook_id: payload.runbook_id ?? generateId(),
    } as unknown as Record<string, unknown>,
    options
  );
}

export function createRunbookJobs(
  tenantContext: TenantContext,
  runbook: Runbook,
  options?: RunnerlessRequestOptions
): JobRequest[] {
  const jobs: JobRequest[] = [];
  const automatedSteps = runbook.steps.filter(step => step.automated);

  if (automatedSteps.length > 0) {
    jobs.push(
      buildRunnerlessJobRequest(
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
          ...options,
          priority: runbook.severity === 'critical' ? 'critical' : 'high',
        }
      )
    );
  }

  if (runbook.severity === 'critical') {
    jobs.push(
      buildRunnerlessJobRequest(
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
          ...options,
          priority: 'critical',
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

export function createReliabilityReportRequest(
  tenantContext: TenantContext,
  payload: ReliabilityReportJobPayload,
  options?: RunnerlessRequestOptions
): JobRequest {
  return buildRunnerlessJobRequest(
    tenantContext,
    'autopilot.ops.reliability_report',
    {
      ...payload,
      report_id: payload.report_id ?? generateId(),
    } as unknown as Record<string, unknown>,
    options
  );
}

export function createReliabilityReportJobs(
  tenantContext: TenantContext,
  report: ReliabilityReport,
  options?: RunnerlessRequestOptions
): JobRequest[] {
  const jobs: JobRequest[] = [];

  const criticalRecommendations = report.recommendations.filter(r => r.priority === 'critical');

  for (const rec of criticalRecommendations) {
    jobs.push(
      buildRunnerlessJobRequest(
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
          ...options,
          priority: 'critical',
        }
      )
    );
  }

  const criticalAnomalies = report.anomalies.filter(a => a.severity === 'critical');

  for (const anomaly of criticalAnomalies) {
    jobs.push(
      buildRunnerlessJobRequest(
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
          ...options,
          priority: 'critical',
        }
      )
    );
  }

  return jobs;
}

// ============================================================================
// Batch Operations
// ============================================================================

export function createOpsJobBatch(
  tenantContext: TenantContext,
  correlation?: AlertCorrelation,
  runbooks?: Runbook[],
  report?: ReliabilityReport,
  options?: RunnerlessRequestOptions
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

  const boundedJobs = allJobs.slice(0, MAX_JOB_REQUESTS_PER_BATCH);
  return batchJobRequests(boundedJobs);
}

export function createJobBatch(requests: JobRequest[]): JobBatch {
  return batchJobRequests(requests);
}

export function groupJobsByType(requests: JobRequest[]): Record<string, JobRequest[]> {
  return requests.reduce<Record<string, JobRequest[]>>((acc, request) => {
    const jobType = String((request as { job_type?: unknown }).job_type ?? 'unknown');
    if (!acc[jobType]) {
      acc[jobType] = [];
    }
    acc[jobType].push(request);
    return acc;
  }, {});
}

export function serializeJobsAsJsonLines(requests: JobRequest[]): string {
  return requests.map(request => JSON.stringify(request)).join('\n');
}

// ============================================================================
// Validation + Serialization
// ============================================================================

export function validateJobRequest(request: unknown): ReturnType<typeof validateRequest> {
  return validateRequest(request);
}

export function validateJobBatch(batch: unknown): ReturnType<typeof validateBatch> {
  return validateBatch(batch);
}

export { serializeJobRequest, serializeJobBatch };
