import { randomUUID } from 'crypto';
import { z } from 'zod';
import {
  EventEnvelopeSchema,
  ReportEnvelopeSchema,
  RunManifestSchema,
  type Evidence,
  type ReportEnvelope,
  type ReportType,
  type TenantContext,
} from '@autopilot/contracts';
import {
  AlertSchema,
  ReportInputSchema,
  type Alert,
  type AlertCorrelation,
  type ReportInput,
} from '../contracts/index.js';
import {
  JobRequestBundleSchema,
  ReportEnvelopeBundleSchema,
  type JobRequestBundle,
  type ReportEnvelopeBundle,
} from '../contracts/compat.js';
import { correlateAlerts, createAlertCorrelation } from '../alerts/index.js';
import {
  createAlertCorrelationJobs,
  createReliabilityReportJobs,
  type RunnerlessRequestOptions,
} from './index.js';
import { generateReliabilityReport } from '../reports/index.js';
import {
  stablePrettyStringify,
  hashCanonicalJson,
  sha256Hex,
  canonicalizeValue,
} from './canonical.js';
import { VERSION } from '../index.js';

export const AnalyzeInputSchema = z.object({
  tenant_id: z.string().min(1),
  project_id: z.string().min(1),
  trace_id: z.string().min(1),
  events: z.array(EventEnvelopeSchema).optional(),
  run_manifests: z.array(RunManifestSchema).optional(),
  alerts: z.array(AlertSchema).optional(),
  report: ReportInputSchema,
  profile_id: z.string().default('ops-base'),
});

export type AnalyzeInput = z.infer<typeof AnalyzeInputSchema>;

export interface AnalyzeOptions {
  stableOutput?: boolean;
}

const STABLE_TIMESTAMP = '2000-01-01T00:00:00.000Z';
const STABLE_ID = '00000000-0000-0000-0000-000000000000';
const MODULE_ID = 'ops';
const MODULE_NAME = 'ops-autopilot';

const REPORT_TYPE_MAP: Record<ReportInput['report_type'], ReportType> = {
  incident_postmortem: 'ops.incident_report',
  health_check: 'ops.health_assessment',
  trend_analysis: 'ops.metric_summary',
  compliance: 'ops.cost_analysis',
};

function buildEvidence(
  description: string,
  severity: Evidence['severity'],
  traceId: string,
  stableOutput: boolean,
  rawValue?: Evidence['raw_value']
): Evidence {
  const idSeed = `${traceId}:${description}`;
  const id = stableOutput
    ? `ev-${sha256Hex(idSeed).slice(0, 12)}`
    : `ev-${sha256Hex(`${idSeed}:${Date.now()}`).slice(0, 12)}`;
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

function buildReportEnvelope(
  input: AnalyzeInput,
  alerts: Alert[],
  jobRequests: JobRequestBundle['requests'],
  stableOutput: boolean
): ReportEnvelope {
  const generatedAt = stableOutput ? STABLE_TIMESTAMP : new Date().toISOString();
  const reportId = stableOutput ? STABLE_ID : randomUUID();
  const reportType = REPORT_TYPE_MAP[input.report.report_type];
  const tenantContext: TenantContext = {
    tenant_id: input.tenant_id,
    project_id: input.project_id,
  };

  const criticalAlerts = alerts.filter(alert => alert.severity === 'critical');
  const evidence: Evidence[] = [];
  const recommendations = [];

  if (criticalAlerts.length > 0) {
    evidence.push(
      buildEvidence(
        `${criticalAlerts.length} critical alerts detected`,
        'critical',
        input.trace_id,
        stableOutput,
        { count: criticalAlerts.length }
      )
    );
    const recIdSeed = `${input.trace_id}:critical-alerts`;
    recommendations.push({
      id: stableOutput
        ? `rec-${sha256Hex(recIdSeed).slice(0, 12)}`
        : `rec-${sha256Hex(`${recIdSeed}:${Date.now()}`).slice(0, 12)}`,
      title: 'Review critical alert patterns',
      description: 'Investigate recent critical alerts and validate runbook coverage.',
      action: 'request_job',
      severity: 'critical',
      evidence: [...evidence],
      job_request: jobRequests.find(request => request.payload.action === 'investigate_and_notify'),
      requires_review: true,
      reviewer_roles: ['oncall', 'ops-lead'],
    });
  }

  const summary = {
    total_findings: evidence.length,
    by_severity: {
      info: 0,
      opportunity: 0,
      warning: 0,
      critical: evidence.filter(item => item.severity === 'critical').length,
    },
    total_recommendations: recommendations.length,
    actionable_count: recommendations.filter(rec => rec.action !== 'observe').length,
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
    time_range: {
      start: input.report.period_start,
      end: input.report.period_end,
    },
    summary,
    evidence,
    recommendations,
    job_requests: jobRequests,
    findings: {
      alerts_total: alerts.length,
      alerts_critical: criticalAlerts.length,
    },
    metadata: {
      correlation_id: input.trace_id,
      profile_id: input.report.profile_id,
    },
    redaction_hints: [
      {
        field: 'findings.alerts_total',
        reason: 'Aggregate counts only; raw alerts excluded.',
        severity: 'low',
      },
    ],
  });
}

function normalizeCorrelation(
  correlation: ReturnType<typeof createAlertCorrelation>,
  traceId: string
): AlertCorrelation {
  const correlationSeed = sha256Hex(
    `${traceId}:${correlation.tenant_id}:${correlation.project_id}`
  );
  const normalizedGroups = correlation.groups.map((group, index) => {
    const alertIds = group.alerts
      .map(alert => alert.alert_id)
      .sort()
      .join(',');
    const groupSeed = sha256Hex(`${correlationSeed}:${index}:${alertIds}`);
    return {
      ...group,
      group_id: `grp-${groupSeed.slice(0, 12)}`,
      created_at: STABLE_TIMESTAMP,
    };
  });

  return {
    ...correlation,
    correlation_id: `corr-${correlationSeed.slice(0, 12)}`,
    generated_at: STABLE_TIMESTAMP,
    groups: normalizedGroups,
  };
}

function withIdempotency(
  requests: JobRequestBundle['requests']
): Array<{ request: JobRequestBundle['requests'][number]; idempotency_key: string }> {
  return requests.map(request => {
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
}

function normalizeJobRequests(
  requests: JobRequestBundle['requests'],
  traceId: string
): JobRequestBundle['requests'] {
  return requests.map(request => {
    const payload = { ...(request.payload as Record<string, unknown>) };

    if (typeof payload.recommendation_id === 'string') {
      const seed = sha256Hex(
        `${traceId}:${request.job_type}:${payload.category ?? ''}:${payload.description ?? ''}:${payload.report_id ?? ''}`
      );
      payload.recommendation_id = `rec-${seed.slice(0, 12)}`;
    }

    if (typeof payload.runbook_id === 'string') {
      const seed = sha256Hex(
        `${traceId}:${request.job_type}:${payload.alert_group_id ?? ''}:${payload.root_cause ?? ''}`
      );
      payload.runbook_id = `rb-${seed.slice(0, 12)}`;
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
  const withKeys = withIdempotency(requests);
  const sortedRequests = [...withKeys]
    .sort((a, b) => a.request.job_type.localeCompare(b.request.job_type))
    .map(entry => entry.request);
  const idempotency_keys = withKeys.map(entry => ({
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

  const alerts = validated.alerts ?? [];
  const correlationResult = alerts.length > 0 ? correlateAlerts(alerts) : undefined;
  const correlation = correlationResult
    ? createAlertCorrelation(
        validated.tenant_id,
        validated.project_id,
        correlationResult,
        validated.profile_id
      )
    : undefined;
  const normalizedCorrelation =
    correlation && stableOutput
      ? normalizeCorrelation(correlation, validated.trace_id)
      : correlation;

  const reliabilityReport = generateReliabilityReport(validated.report, alerts, {
    stableOutput,
    generatedAt: stableOutput ? STABLE_TIMESTAMP : undefined,
  });

  const requestOptions: RunnerlessRequestOptions = {
    requestedAt: stableOutput ? STABLE_TIMESTAMP : undefined,
    traceId: validated.trace_id,
  };

  const jobRequests = [
    ...(normalizedCorrelation
      ? createAlertCorrelationJobs(tenantContext, normalizedCorrelation, requestOptions)
      : []),
    ...createReliabilityReportJobs(tenantContext, reliabilityReport, requestOptions),
  ];
  const stableRequests = stableOutput
    ? normalizeJobRequests(jobRequests, validated.trace_id)
    : jobRequests;

  const jobRequestBundle = buildJobRequestBundle(validated, stableRequests, stableOutput);
  const reportEnvelope = buildReportEnvelope(
    validated,
    alerts,
    jobRequestBundle.requests,
    stableOutput
  );
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
    errors: result.error.errors.map(issue => `${issue.path.join('.')}: ${issue.message}`),
  };
}

export function validateReportBundle(bundle: unknown): { valid: boolean; errors: string[] } {
  const result = ReportEnvelopeBundleSchema.safeParse(bundle);
  if (result.success) {
    return { valid: true, errors: [] as string[] };
  }
  return {
    valid: false,
    errors: result.error.errors.map(issue => `${issue.path.join('.')}: ${issue.message}`),
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
    `# Ops Autopilot Report`,
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
