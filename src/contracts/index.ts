import { createHash, randomUUID } from 'crypto';
import { z } from 'zod';
import {
  SeveritySchema,
  JobRequestSchema,
  type TenantContext,
  type Severity,
  type JobRequest,
} from '@autopilot/contracts';
import {
  TenantIdSchema,
  ProjectIdSchema,
  EventIdSchema,
  TimestampSchema,
  HashSchema,
  EvidenceLinkSchema,
  FindingSchema,
  CapabilityMetadataSchema,
  HealthAuditInputSchema,
  HealthAuditOutputSchema,
  HealthAuditCapabilityMetadata,
  type EvidenceLink,
  type Finding,
  type CapabilityMetadata,
  type HealthAuditInput,
  type HealthAuditOutput,
} from './base.js';

/**
 * Ops Autopilot Contracts
 *
 * Domain-specific schemas for infrastructure reliability, alert correlation,
 * runbook generation, and reliability reporting.
 */

// Re-export base contracts for convenience
export {
  TenantIdSchema,
  ProjectIdSchema,
  EventIdSchema,
  TimestampSchema,
  HashSchema,
  SeveritySchema,
  EvidenceLinkSchema,
  FindingSchema,
  JobRequestSchema,
  CapabilityMetadataSchema,
  HealthAuditInputSchema,
  HealthAuditOutputSchema,
  HealthAuditCapabilityMetadata,
  type TenantContext,
  type Severity,
  type EvidenceLink,
  type Finding,
  type JobRequest,
  type CapabilityMetadata,
  type HealthAuditInput,
  type HealthAuditOutput,
};

// ============================================================================
// Alert Schemas
// ============================================================================

export const AlertSourceSchema = z.enum([
  'cloudwatch',
  'datadog',
  'prometheus',
  'grafana',
  'pagerduty',
  'opsgenie',
  'newrelic',
  'sentry',
  'custom',
]);

export const AlertStatusSchema = z.enum(['open', 'acknowledged', 'resolved', 'suppressed']);

export const AlertSchema = z.object({
  alert_id: z.string().min(1),
  tenant_id: TenantIdSchema,
  project_id: ProjectIdSchema,
  source: AlertSourceSchema,
  status: AlertStatusSchema,
  title: z.string().min(1),
  description: z.string(),
  severity: SeveritySchema,
  service: z.string().min(1),
  metric: z.string().optional(),
  threshold: z.number().optional(),
  current_value: z.number().optional(),
  timestamp: TimestampSchema,
  correlation_id: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type AlertSource = z.infer<typeof AlertSourceSchema>;
export type AlertStatus = z.infer<typeof AlertStatusSchema>;
export type Alert = z.infer<typeof AlertSchema>;

// ============================================================================
// Alert Correlation Schemas
// ============================================================================

export const CorrelationRuleSchema = z.object({
  rule_id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  enabled: z.boolean().default(true),
  match_criteria: z.array(
    z.object({
      field: z.enum(['source', 'service', 'severity', 'metric', 'title']),
      operator: z.enum(['equals', 'contains', 'regex', 'prefix']),
      value: z.string(),
    })
  ),
  time_window_minutes: z.number().int().min(1).default(10),
  correlation_logic: z.enum(['same_service', 'same_metric', 'common_source', 'custom']),
  min_alerts: z.number().int().min(2).default(2),
});

export const CorrelatedAlertGroupSchema = z.object({
  group_id: z.string().min(1),
  correlation_rule_id: z.string().min(1),
  alerts: z.array(AlertSchema),
  root_cause_analysis: z.object({
    probable_cause: z.string(),
    confidence: z.number().min(0).max(1),
    contributing_factors: z.array(z.string()),
  }),
  blast_radius: z.object({
    services_affected: z.array(z.string()),
    estimated_impact: z.enum(['low', 'medium', 'high', 'critical']),
  }),
  created_at: TimestampSchema,
  resolved_at: TimestampSchema.optional(),
});

export const AlertCorrelationSchema = z.object({
  correlation_id: z.string().min(1),
  tenant_id: TenantIdSchema,
  project_id: ProjectIdSchema,
  groups: z.array(CorrelatedAlertGroupSchema),
  summary: z.object({
    total_alerts: z.number().int(),
    total_groups: z.number().int(),
    new_groups: z.number().int(),
    resolved_groups: z.number().int(),
  }),
  generated_at: TimestampSchema,
  profile_id: z.string(),
});

export type CorrelationRule = z.infer<typeof CorrelationRuleSchema>;
export type CorrelatedAlertGroup = z.infer<typeof CorrelatedAlertGroupSchema>;
export type AlertCorrelation = z.infer<typeof AlertCorrelationSchema>;

// ============================================================================
// Runbook Schemas
// ============================================================================

export const RunbookStepSchema = z.object({
  step_number: z.number().int().min(1),
  title: z.string().min(1),
  description: z.string(),
  command: z.string().optional(),
  expected_output: z.string().optional(),
  verification: z.string().optional(),
  rollback_step: z.number().int().optional(),
  automated: z.boolean().default(false),
  requires_approval: z.boolean().default(false),
});

export const RunbookSchema = z.object({
  runbook_id: z.string().min(1),
  tenant_id: TenantIdSchema,
  project_id: ProjectIdSchema,
  name: z.string().min(1),
  description: z.string(),
  trigger_conditions: z.array(
    z.object({
      alert_source: AlertSourceSchema.optional(),
      alert_title_pattern: z.string().optional(),
      service: z.string().optional(),
      metric: z.string().optional(),
    })
  ),
  severity: SeveritySchema,
  estimated_duration_minutes: z.number().int().min(1),
  steps: z.array(RunbookStepSchema),
  prerequisites: z.array(z.string()),
  post_conditions: z.array(z.string()),
  rollback_procedure: z.string().optional(),
  related_runbooks: z.array(z.string()).optional(),
  created_at: TimestampSchema,
  updated_at: TimestampSchema,
  version: z.string().default('1.0.0'),
  generated_by: z.enum(['ai', 'manual', 'hybrid']).default('ai'),
});

export type RunbookStep = z.infer<typeof RunbookStepSchema>;
export type Runbook = z.infer<typeof RunbookSchema>;

// ============================================================================
// Reliability Report Schemas
// ============================================================================

export const ReliabilityMetricSchema = z.object({
  metric_name: z.string().min(1),
  value: z.number(),
  unit: z.string(),
  trend: z.enum(['improving', 'degrading', 'stable']).optional(),
  target: z.number().optional(),
  previous_value: z.number().optional(),
  change_percent: z.number().optional(),
});

export const InfrastructureHealthSchema = z.object({
  service_name: z.string().min(1),
  status: z.enum(['healthy', 'degraded', 'unhealthy', 'unknown']),
  availability_percent: z.number().min(0).max(100),
  latency_p95_ms: z.number().optional(),
  error_rate_percent: z.number().optional(),
  last_incident: TimestampSchema.optional(),
  metrics: z.array(ReliabilityMetricSchema),
});

export const AnomalyDetectionSchema = z.object({
  anomaly_id: z.string().min(1),
  type: z.enum(['spike', 'drop', 'pattern_break', 'correlation', 'threshold_breach']),
  service: z.string().min(1),
  metric: z.string().min(1),
  detected_at: TimestampSchema,
  severity: SeveritySchema,
  baseline_value: z.number(),
  observed_value: z.number(),
  deviation_percent: z.number(),
  contributing_factors: z.array(z.string()),
  historical_context: z
    .object({
      similar_incidents_count: z.number().int(),
      last_similar_incident: TimestampSchema.optional(),
      typical_resolution_time_minutes: z.number().optional(),
    })
    .optional(),
});

export const ReliabilityReportSchema = z.object({
  report_id: z.string().min(1),
  tenant_id: TenantIdSchema,
  project_id: ProjectIdSchema,
  report_type: z.enum(['incident_postmortem', 'health_check', 'trend_analysis', 'compliance']),
  period_start: TimestampSchema,
  period_end: TimestampSchema,
  generated_at: TimestampSchema,
  overall_health_score: z.number().min(0).max(100),
  service_health: z.array(InfrastructureHealthSchema),
  anomalies: z.array(AnomalyDetectionSchema),
  findings: z.array(FindingSchema),
  recommendations: z.array(
    z.object({
      priority: z.enum(['low', 'medium', 'high', 'critical']),
      category: z.string(),
      description: z.string(),
      expected_impact: z.string(),
      implementation_effort: z.enum(['low', 'medium', 'high']),
      related_findings: z.array(z.string()),
    })
  ),
  job_requests: z.array(JobRequestSchema),
  profile_id: z.string(),
  report_hash: HashSchema,
  redaction_applied: z.boolean().default(true),
});

export type ReliabilityMetric = z.infer<typeof ReliabilityMetricSchema>;
export type InfrastructureHealth = z.infer<typeof InfrastructureHealthSchema>;
export type AnomalyDetection = z.infer<typeof AnomalyDetectionSchema>;
export type ReliabilityReport = z.infer<typeof ReliabilityReportSchema>;

// ============================================================================
// Input/Output Schemas
// ============================================================================

export const IngestInputSchema = z.object({
  tenant_id: TenantIdSchema,
  project_id: ProjectIdSchema,
  source: AlertSourceSchema,
  alerts: z.array(AlertSchema).optional(),
  raw_events: z.array(z.record(z.string(), z.unknown())).optional(),
  log_summary: z.string().optional(),
  manifest_path: z.string().optional(),
  profile_id: z.string().default('base'),
  time_range: z
    .object({
      start: TimestampSchema,
      end: TimestampSchema,
    })
    .optional(),
});

export const CorrelationInputSchema = z.object({
  tenant_id: TenantIdSchema,
  project_id: ProjectIdSchema,
  alerts: z.array(AlertSchema),
  rules: z.array(CorrelationRuleSchema).optional(),
  profile_id: z.string().default('base'),
  time_window_minutes: z.number().int().min(1).default(10),
});

export const RunbookInputSchema = z.object({
  tenant_id: TenantIdSchema,
  project_id: ProjectIdSchema,
  alert_group: CorrelatedAlertGroupSchema,
  existing_runbooks: z.array(RunbookSchema).optional(),
  profile_id: z.string().default('base'),
  include_automation: z.boolean().default(false),
});

export const ReportInputSchema = z.object({
  tenant_id: TenantIdSchema,
  project_id: ProjectIdSchema,
  report_type: ReliabilityReportSchema.shape.report_type,
  period_start: TimestampSchema,
  period_end: TimestampSchema,
  services: z.array(z.string()).optional(),
  include_metrics: z.array(z.string()).optional(),
  profile_id: z.string().default('base'),
});

export type IngestInput = z.infer<typeof IngestInputSchema>;
export type CorrelationInput = z.infer<typeof CorrelationInputSchema>;
export type RunbookInput = z.infer<typeof RunbookInputSchema>;
export type ReportInput = z.infer<typeof ReportInputSchema>;

// ============================================================================
// Utility Functions
// ============================================================================

export function generateId(): string {
  return randomUUID();
}

export function computeHash(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export * from './compat.js';
