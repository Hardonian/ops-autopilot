import { z } from 'zod';
import { ISODateTimeSchema, JSONValueSchema, SemVerSchema, SeveritySchema } from './core.js';
import { TenantContextSchema } from './tenant.js';
import { EvidenceSchema, type Evidence } from './evidence.js';
import { JobRequestSchema } from './job.js';

/**
 * ReportEnvelope - Module output schema
 *
 * Reports are the primary output of Autopilot modules. They contain
 * findings, recommendations, and optionally job requests for actions.
 *
 * All reports are:
 * - Multi-tenant safe
 * - Evidence-linked
 * - Self-contained (no external references required)
 * - Serializable to JSON
 */

/** Report type enumeration */
export const ReportTypeSchema = z.enum([
  // Growth reports
  'growth.seo_audit',
  'growth.funnel_analysis',
  'growth.experiment_proposals',
  'growth.content_drafts',

  // Ops reports
  'ops.health_assessment',
  'ops.incident_report',
  'ops.metric_summary',
  'ops.cost_analysis',

  // Support reports
  'support.ticket_summary',
  'support.response_suggestions',
  'support.kb_drafts',
  'support.sentiment_report',

  // FinOps reports
  'finops.usage_report',
  'finops.budget_status',
  'finops.optimization_recommendations',
  'finops.anomaly_report',
]);

export type ReportType = z.infer<typeof ReportTypeSchema>;

/** Recommendation action type */
export const RecommendationActionSchema = z.enum([
  'observe', // Just record, no action
  'draft', // Create draft content/config
  'recommend', // Suggest action to user
  'request_job', // Generate JobForge request
]);

export type RecommendationAction = z.infer<typeof RecommendationActionSchema>;

/** Single recommendation item */
export const RecommendationSchema = z.object({
  /** Unique recommendation ID */
  id: z.string().min(1),

  /** Recommendation title */
  title: z.string().min(1),

  /** Detailed description */
  description: z.string(),

  /** Action type */
  action: RecommendationActionSchema,

  /** Severity/importance */
  severity: SeveritySchema,

  /** Evidence supporting this recommendation */
  evidence: z.array(EvidenceSchema),

  /** Associated job request (if action is 'request_job') */
  job_request: JobRequestSchema.optional(),

  /** Metadata */
  metadata: z.record(z.string(), JSONValueSchema).optional(),

  /** Whether this recommendation requires human review */
  requires_review: z.boolean().default(true),

  /** Suggested reviewer roles */
  reviewer_roles: z.array(z.string()).optional(),
});

export type Recommendation = z.infer<typeof RecommendationSchema>;

/** Report summary statistics */
export const ReportSummarySchema = z.object({
  /** Total findings count */
  total_findings: z.number().int().nonnegative(),

  /** Count by severity */
  by_severity: z.record(
    z.enum(['info', 'opportunity', 'warning', 'critical']),
    z.number().int().nonnegative()
  ),

  /** Total recommendations */
  total_recommendations: z.number().int().nonnegative(),

  /** Recommendations requiring action */
  actionable_count: z.number().int().nonnegative(),

  /** Processing statistics */
  processing_time_ms: z.number().int().nonnegative().optional(),

  /** Coverage percentage (if applicable) */
  coverage_percent: z.number().min(0).max(100).optional(),
});

export type ReportSummary = z.infer<typeof ReportSummarySchema>;

/** Report envelope - wraps all module outputs */
export const ReportEnvelopeSchema = z.object({
  /** Report version */
  version: SemVerSchema,

  /** Unique report identifier */
  report_id: z.string().uuid(),

  /** Report type */
  report_type: ReportTypeSchema,

  /** Tenant context */
  tenant_context: TenantContextSchema,

  /** Module that generated this report */
  module: z.object({
    name: z.string(),
    version: z.string(),
  }),

  /** Timestamps */
  generated_at: ISODateTimeSchema,

  /** Time range covered by report (if applicable) */
  time_range: z
    .object({
      start: ISODateTimeSchema,
      end: ISODateTimeSchema,
    })
    .optional(),

  /** Report summary */
  summary: ReportSummarySchema,

  /** All evidence collected */
  evidence: z.array(EvidenceSchema),

  /** Recommendations */
  recommendations: z.array(RecommendationSchema),

  /** Job requests generated (for action recommendations) */
  job_requests: z.array(JobRequestSchema).default([]),

  /** Raw findings data */
  findings: z.record(z.string(), JSONValueSchema).default({}),

  /** Processing metadata */
  metadata: z
    .object({
      input_size_bytes: z.number().int().nonnegative().optional(),
      output_size_bytes: z.number().int().nonnegative().optional(),
      correlation_id: z.string().optional(),
      source_event_id: z.string().optional(),
      profile_id: z.string().optional(),
    })
    .default({}),

  /** Redaction hints (for sensitive data) */
  redaction_hints: z
    .array(
      z.object({
        field: z.string(),
        reason: z.string(),
        severity: z.enum(['low', 'medium', 'high']),
      })
    )
    .default([]),
});

export type ReportEnvelope = z.infer<typeof ReportEnvelopeSchema>;

/**
 * Create a report envelope
 * @param report_type - Type of report
 * @param tenant_context - Tenant/project context
 * @param module - Module info
 * @returns Initial report envelope
 */
export function createReportEnvelope(
  report_type: ReportType,
  tenant_context: { tenant_id: string; project_id: string },
  module: { name: string; version: string }
): ReportEnvelope {
  return ReportEnvelopeSchema.parse({
    version: '1.0.0',
    report_id: crypto.randomUUID(),
    report_type,
    tenant_context: TenantContextSchema.parse(tenant_context),
    module,
    generated_at: new Date().toISOString(),
    summary: {
      total_findings: 0,
      by_severity: {
        info: 0,
        opportunity: 0,
        warning: 0,
        critical: 0,
      },
      total_recommendations: 0,
      actionable_count: 0,
    },
    evidence: [],
    recommendations: [],
    job_requests: [],
    findings: {},
    metadata: {},
    redaction_hints: [],
  });
}

/**
 * Add a recommendation to a report
 * @param envelope - Report envelope
 * @param recommendation - Recommendation to add
 * @returns Updated envelope
 */
export function addRecommendation(
  envelope: ReportEnvelope,
  recommendation: Omit<Recommendation, 'id'> & { id?: string }
): ReportEnvelope {
  const rec: Recommendation = {
    ...recommendation,
    id: recommendation.id ?? `rec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  };

  const updated = {
    ...envelope,
    recommendations: [...envelope.recommendations, rec],
    summary: {
      ...envelope.summary,
      total_recommendations: envelope.summary.total_recommendations + 1,
      actionable_count: envelope.summary.actionable_count + (rec.action !== 'observe' ? 1 : 0),
    },
  };

  // Update severity counts
  updated.summary.by_severity[rec.severity] = (updated.summary.by_severity[rec.severity] ?? 0) + 1;

  return updated;
}

/**
 * Add evidence to a report
 * @param envelope - Report envelope
 * @param evidence - Evidence to add
 * @returns Updated envelope
 */
export function addEvidence(envelope: ReportEnvelope, evidence: Evidence): ReportEnvelope {
  return {
    ...envelope,
    evidence: [...envelope.evidence, evidence],
    summary: {
      ...envelope.summary,
      total_findings: envelope.summary.total_findings + 1,
      by_severity: {
        ...envelope.summary.by_severity,
        [evidence.severity]: (envelope.summary.by_severity[evidence.severity] ?? 0) + 1,
      },
    },
  };
}

/**
 * Add a job request to a report
 * @param envelope - Report envelope
 * @param job_request - Job request to add
 * @returns Updated envelope
 */
export function addJobRequest(
  envelope: ReportEnvelope,
  job_request: z.infer<typeof JobRequestSchema>
): ReportEnvelope {
  return {
    ...envelope,
    job_requests: [...envelope.job_requests, job_request],
  };
}
