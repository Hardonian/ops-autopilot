import { randomUUID } from 'crypto';
import { z } from 'zod';
import {
  ReportEnvelopeSchema,
  type Evidence,
  type ReportEnvelope,
  type ReportType,
  type TenantContext,
} from '@autopilot/contracts';
import {
  ContentDraftSchema,
  ExperimentProposalSchema,
  FunnelMetricsSchema,
  SEOFindingsSchema,
  type ContentDraft,
  type ExperimentProposal,
  type FunnelMetrics,
  type SEOFindings,
} from '../contracts/index.js';
import {
  JobRequestBundleSchema,
  ReportEnvelopeBundleSchema,
  type JobRequestBundle,
  type ReportEnvelopeBundle,
} from '../contracts/compat.js';
import {
  createContentDraftJob,
  createExperimentJob,
  createSEOScanJob,
  type JobForgeRequestOptions,
} from './client.js';
import { stablePrettyStringify, hashCanonicalJson, sha256Hex, canonicalizeValue } from './canonical.js';
import { VERSION } from '../version.js';

export const AnalyzeInputSchema = z.object({
  tenant_id: z.string().min(1),
  project_id: z.string().min(1),
  trace_id: z.string().min(1),
  seo_findings: SEOFindingsSchema.optional(),
  funnel_metrics: FunnelMetricsSchema.optional(),
  experiment_proposals: z.array(ExperimentProposalSchema).optional(),
  content_draft: ContentDraftSchema.optional(),
  profile_id: z.string().default('growth-base'),
});

export type AnalyzeInput = z.infer<typeof AnalyzeInputSchema>;

export interface AnalyzeOptions {
  stableOutput?: boolean;
}

const STABLE_TIMESTAMP = '2000-01-01T00:00:00.000Z';
const STABLE_ID = '00000000-0000-0000-0000-000000000000';
const MODULE_ID = 'growth';
const MODULE_NAME = 'growth-autopilot';

function stableId(seed: string): string {
  return sha256Hex(seed).slice(0, 12);
}

function buildEvidence(
  description: string,
  severity: Evidence['severity'],
  traceId: string,
  stableOutput: boolean,
  rawValue?: Evidence['raw_value']
): Evidence {
  const idSeed = `${traceId}:${description}`;
  const id = stableOutput ? `ev-${stableId(idSeed)}` : `ev-${stableId(`${idSeed}:${Date.now()}`)}`;
  return {
    id,
    type: 'signal',
    description,
    severity,
    raw_value: rawValue,
    collected_at: stableOutput ? STABLE_TIMESTAMP : new Date().toISOString(),
    source: MODULE_NAME,
  };
}

function resolveReportType(input: AnalyzeInput): ReportType {
  if (input.seo_findings) return 'growth.seo_audit';
  if (input.funnel_metrics) return 'growth.funnel_analysis';
  if (input.content_draft) return 'growth.content_drafts';
  return 'growth.experiment_proposals';
}

function buildReportEnvelope(
  input: AnalyzeInput,
  jobRequests: JobRequestBundle['requests'],
  stableOutput: boolean,
  findings: {
    seo_findings?: SEOFindings;
    funnel_metrics?: FunnelMetrics;
    experiment_proposals?: ExperimentProposal[];
    content_draft?: ContentDraft;
  }
): ReportEnvelope {
  const generatedAt = stableOutput ? STABLE_TIMESTAMP : new Date().toISOString();
  const reportId = stableOutput ? STABLE_ID : randomUUID();
  const reportType = resolveReportType(input);
  const tenantContext: TenantContext = {
    tenant_id: input.tenant_id,
    project_id: input.project_id,
  };

  const evidence: Evidence[] = [];

  if (findings.seo_findings) {
    evidence.push(
      buildEvidence(
        `${findings.seo_findings.summary.total_issues} SEO issues across ${findings.seo_findings.summary.total_pages} pages`,
        findings.seo_findings.summary.total_issues > 0 ? 'warning' : 'info',
        input.trace_id,
        stableOutput,
        {
          total_issues: findings.seo_findings.summary.total_issues,
          total_pages: findings.seo_findings.summary.total_pages,
        }
      )
    );
  }

  if (findings.funnel_metrics) {
    evidence.push(
      buildEvidence(
        `Funnel ${findings.funnel_metrics.funnel_name} conversion ${findings.funnel_metrics.overall_conversion_rate.toFixed(1)}%`,
        'info',
        input.trace_id,
        stableOutput,
        {
          total_users_entered: findings.funnel_metrics.total_users_entered,
          total_users_completed: findings.funnel_metrics.total_users_completed,
        }
      )
    );
  }

  if (findings.experiment_proposals) {
    evidence.push(
      buildEvidence(
        `${findings.experiment_proposals.length} experiment proposals generated`,
        'opportunity',
        input.trace_id,
        stableOutput,
        { proposals: findings.experiment_proposals.length }
      )
    );
  }

  if (findings.content_draft) {
    evidence.push(
      buildEvidence(
        `Drafted ${findings.content_draft.variants.length} content variants`,
        'info',
        input.trace_id,
        stableOutput,
        { variants: findings.content_draft.variants.length }
      )
    );
  }

  const recommendations = jobRequests.map((request, index) => {
    const recIdSeed = `${input.trace_id}:${request.job_type}:${index}`;
    return {
      id: stableOutput ? `rec-${stableId(recIdSeed)}` : `rec-${stableId(`${recIdSeed}:${Date.now()}`)}`,
      title: `Execute ${request.job_type}`,
      description: `Submit ${request.job_type} via JobForge for execution.`,
      action: 'request_job',
      severity: 'warning',
      evidence: [...evidence],
      job_request: request,
      requires_review: true,
      reviewer_roles: ['growth-lead', 'marketing-lead'],
    } as const;
  });

  const summary = {
    total_findings: evidence.length,
    by_severity: {
      info: evidence.filter((item) => item.severity === 'info').length,
      opportunity: evidence.filter((item) => item.severity === 'opportunity').length,
      warning: evidence.filter((item) => item.severity === 'warning').length,
      critical: evidence.filter((item) => item.severity === 'critical').length,
    },
    total_recommendations: recommendations.length,
    actionable_count: recommendations.length,
  };

  return ReportEnvelopeSchema.parse({
    version: '1.0.0',
    report_id: reportId,
    report_type: reportType,
    tenant_context: tenantContext,
    module: {
      name: MODULE_NAME,
      version: VERSION,
    },
    generated_at: generatedAt,
    summary,
    evidence,
    recommendations,
    job_requests: jobRequests,
    findings: {
      seo_issues: findings.seo_findings?.summary.total_issues ?? 0,
      funnel_name: findings.funnel_metrics?.funnel_name ?? null,
      experiment_proposals: findings.experiment_proposals?.length ?? 0,
      content_variants: findings.content_draft?.variants.length ?? 0,
    },
    metadata: {
      correlation_id: input.trace_id,
      profile_id: input.profile_id,
    },
    redaction_hints: [
      {
        field: 'findings',
        reason: 'Aggregate counts only; raw marketing data excluded.',
        severity: 'low',
      },
    ],
  });
}

function normalizeJobRequests(
  requests: JobRequestBundle['requests'],
  traceId: string
): JobRequestBundle['requests'] {
  return requests.map((request) => {
    const payload = { ...(request.payload as Record<string, unknown>) };
    if (typeof payload.recommendation_id === 'string') {
      const seed = sha256Hex(`${traceId}:${request.job_type}:${payload.recommendation_id}`);
      payload.recommendation_id = `rec-${seed.slice(0, 12)}`;
    }
    return {
      ...request,
      payload,
    };
  });
}

function buildJobRequestBundle(
  input: AnalyzeInput,
  requests: JobRequestBundle['requests'],
  stableOutput: boolean
): JobRequestBundle {
  const createdAt = stableOutput ? STABLE_TIMESTAMP : new Date().toISOString();
  const idempotency = requests.map((request) => {
    const seed = canonicalizeValue({
      job_type: request.job_type,
      tenant_context: request.tenant_context,
      payload: request.payload,
      policy: request.policy,
    });
    const idempotency_key = sha256Hex(JSON.stringify(seed));
    return {
      request: {
        ...request,
        metadata: {
          ...request.metadata,
          idempotency_key,
        },
      },
      idempotency_key,
    };
  });

  const sortedRequests = [...idempotency]
    .sort((a, b) => a.request.job_type.localeCompare(b.request.job_type))
    .map((entry) => entry.request);
  const idempotency_keys = idempotency.map((entry) => ({
    job_type: entry.request.job_type,
    idempotency_key: entry.idempotency_key,
  }));
  const canonicalization = hashCanonicalJson({
    schema_version: '1.0.0',
    module_id: MODULE_ID,
    tenant_id: input.tenant_id,
    project_id: input.project_id,
    trace_id: input.trace_id,
    created_at: createdAt,
    dry_run: true,
    requests: sortedRequests,
    idempotency_keys,
  });

  return JobRequestBundleSchema.parse({
    schema_version: '1.0.0',
    module_id: MODULE_ID,
    tenant_id: input.tenant_id,
    project_id: input.project_id,
    trace_id: input.trace_id,
    created_at: createdAt,
    dry_run: true,
    requests: sortedRequests,
    idempotency_keys,
    canonicalization: {
      algorithm: 'json-lexicographic',
      hash_algorithm: 'sha256',
      hash: canonicalization.hash,
    },
  });
}

function buildReportBundle(
  input: AnalyzeInput,
  report: ReportEnvelope,
  idempotency_keys: ReportEnvelopeBundle['idempotency_keys'],
  stableOutput: boolean
): ReportEnvelopeBundle {
  const createdAt = stableOutput ? STABLE_TIMESTAMP : new Date().toISOString();
  const canonicalization = hashCanonicalJson({
    schema_version: '1.0.0',
    module_id: MODULE_ID,
    tenant_id: input.tenant_id,
    project_id: input.project_id,
    trace_id: input.trace_id,
    created_at: createdAt,
    dry_run: true,
    report,
    idempotency_keys,
  });

  return ReportEnvelopeBundleSchema.parse({
    schema_version: '1.0.0',
    module_id: MODULE_ID,
    tenant_id: input.tenant_id,
    project_id: input.project_id,
    trace_id: input.trace_id,
    created_at: createdAt,
    dry_run: true,
    report,
    idempotency_keys,
    canonicalization: {
      algorithm: 'json-lexicographic',
      hash_algorithm: 'sha256',
      hash: canonicalization.hash,
    },
  });
}

export function analyze(
  inputs: AnalyzeInput,
  options: AnalyzeOptions = {}
): { reportEnvelope: ReportEnvelopeBundle; jobRequestBundle: JobRequestBundle } {
  const validated = AnalyzeInputSchema.parse(inputs);
  const stableOutput = options.stableOutput ?? false;
  const tenantContext: TenantContext = {
    tenant_id: validated.tenant_id,
    project_id: validated.project_id,
  };

  const jobRequestOptions: JobForgeRequestOptions = {
    requestedAt: stableOutput ? STABLE_TIMESTAMP : undefined,
    evidenceIdFactory: stableOutput
      ? (prefix: string) => `${prefix}-${stableId(`${validated.trace_id}:${prefix}`)}`
      : undefined,
    policy: {
      requires_policy_token: true,
      requires_approval: true,
      risk_level: 'low',
      required_scopes: [],
      compliance_tags: [],
    },
    costConfidence: 'medium',
  };

  const jobRequests = [
    ...(validated.seo_findings
      ? [createSEOScanJob(validated.seo_findings, { tenant_context: tenantContext }, 'normal', jobRequestOptions)]
      : []),
    ...(validated.funnel_metrics && validated.experiment_proposals
      ? [
          createExperimentJob(
            validated.experiment_proposals,
            validated.funnel_metrics,
            { tenant_context: tenantContext },
            'normal',
            jobRequestOptions
          ),
        ]
      : []),
    ...(validated.content_draft
      ? [createContentDraftJob(validated.content_draft, { tenant_context: tenantContext }, 'normal', jobRequestOptions)]
      : []),
  ];

  const stableRequests = stableOutput ? normalizeJobRequests(jobRequests, validated.trace_id) : jobRequests;

  const jobRequestBundle = buildJobRequestBundle(validated, stableRequests, stableOutput);
  const reportEnvelope = buildReportEnvelope(validated, stableRequests, stableOutput, {
    seo_findings: validated.seo_findings,
    funnel_metrics: validated.funnel_metrics,
    experiment_proposals: validated.experiment_proposals,
    content_draft: validated.content_draft,
  });
  const reportEnvelopeBundle = buildReportBundle(
    validated,
    reportEnvelope,
    jobRequestBundle.idempotency_keys,
    stableOutput
  );

  return {
    reportEnvelope: reportEnvelopeBundle,
    jobRequestBundle,
  };
}

export function validateBundle(bundle: unknown): { valid: boolean; errors: string[] } {
  const result = JobRequestBundleSchema.safeParse(bundle);
  if (result.success) {
    return { valid: true, errors: [] as string[] };
  }
  return {
    valid: false,
    errors: result.error.errors.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
  };
}

export function validateReportBundle(bundle: unknown): { valid: boolean; errors: string[] } {
  const result = ReportEnvelopeBundleSchema.safeParse(bundle);
  if (result.success) {
    return { valid: true, errors: [] as string[] };
  }
  return {
    valid: false,
    errors: result.error.errors.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
  };
}

export function renderReport(
  reportEnvelope: ReportEnvelopeBundle,
  format: 'markdown' | 'md' = 'markdown'
): string {
  if (format !== 'markdown' && format !== 'md') {
    throw new Error(`Unsupported format: ${format}`);
  }

  const report = reportEnvelope.report;
  const summary = report.summary;
  const lines = [
    `# Growth Autopilot Report`,
    ``,
    `- Report ID: ${report.report_id}`,
    `- Report Type: ${report.report_type}`,
    `- Tenant: ${report.tenant_context.tenant_id}`,
    `- Project: ${report.tenant_context.project_id}`,
    `- Generated At: ${report.generated_at}`,
    `- Trace ID: ${reportEnvelope.trace_id}`,
    ``,
    `## Summary`,
    ``,
    `- Total Findings: ${summary.total_findings}`,
    `- Total Recommendations: ${summary.total_recommendations}`,
    `- Actionable Recommendations: ${summary.actionable_count}`,
    ``,
    `## Recommendations`,
    ``,
  ];

  if (report.recommendations.length === 0) {
    lines.push('No recommendations generated.');
  } else {
    for (const recommendation of report.recommendations) {
      lines.push(`- **${recommendation.title}** (${recommendation.severity})`);
      lines.push(`  - ${recommendation.description}`);
      lines.push(`  - Action: ${recommendation.action}`);
    }
  }

  lines.push(``, `## Job Requests`, ``);
  if (report.job_requests.length > 0) {
    for (const request of report.job_requests) {
      lines.push(`- ${request.job_type} (priority: ${request.priority})`);
    }
  } else {
    lines.push('No job requests generated.');
  }

  return lines.join('\n');
}

export function writeReportMarkdown(reportEnvelope: ReportEnvelopeBundle): string {
  return renderReport(reportEnvelope, 'markdown');
}

export function serializeBundle(bundle: JobRequestBundle): string {
  return stablePrettyStringify(bundle);
}

export function serializeReport(report: ReportEnvelopeBundle): string {
  return stablePrettyStringify(report);
}
