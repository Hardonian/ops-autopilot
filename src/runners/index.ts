import {
  HealthAuditCapabilityMetadata,
  MAX_SERVICES_PER_AUDIT,
  type RunnerDefinition,
  type RunnerMetricDefinition,
} from '../contracts/index.js';
import { MAX_JOB_REQUESTS_PER_BATCH } from '../jobforge/index.js';

const STANDARD_METRICS: Array<Pick<RunnerMetricDefinition, 'name' | 'type' | 'category' | 'unit'>> = [
  {
    name: 'ops_autopilot_runner_success_total',
    type: 'counter',
    category: 'success',
  },
  {
    name: 'ops_autopilot_runner_failure_total',
    type: 'counter',
    category: 'failure',
  },
  {
    name: 'ops_autopilot_runner_retry_total',
    type: 'counter',
    category: 'retry',
  },
  {
    name: 'ops_autopilot_runner_duration_ms',
    type: 'histogram',
    category: 'latency',
    unit: 'ms',
  },
  {
    name: 'ops_autopilot_runner_idempotency_hit_total',
    type: 'counter',
    category: 'idempotency',
  },
  {
    name: 'ops_autopilot_runner_cost_usd',
    type: 'gauge',
    category: 'cost',
    unit: 'usd',
  },
];

function buildRunnerMetrics(
  runnerId: string,
  purposeHint: string
): RunnerMetricDefinition[] {
  return STANDARD_METRICS.map(metric => ({
    ...metric,
    description: `${purposeHint} (${metric.category}).`,
    labels: {
      runner: runnerId,
    },
  }));
}

const healthAuditExecutionPolicy = HealthAuditCapabilityMetadata.execution_policy;

export const RUNNER_DEFINITIONS: RunnerDefinition[] = [
  {
    runner_id: 'ops.health_audit',
    purpose: 'Audit infrastructure health signals and surface reliability findings.',
    inputs: [
      'tenant_id',
      'project_id',
      'services[] (max 25)',
      'audit_depth',
      'include_metrics[]',
      'time_range',
      'idempotency_key',
    ],
    outputs: [
      'HealthAuditOutput (findings, metrics, recommendations)',
      'execution_metadata with attempts, latency, and cost estimate',
    ],
    failure_modes: [
      'Dependency health API unavailable',
      'Timeout budget exceeded',
      'Circuit breaker open after repeated failures',
      'Idempotency key collision returns cached result',
    ],
    execution_guarantees: {
      idempotent: healthAuditExecutionPolicy.idempotent,
      retry_policy: healthAuditExecutionPolicy.retry_policy,
      timeout_budget_ms: healthAuditExecutionPolicy.timeout_budget_ms,
      circuit_breaker: healthAuditExecutionPolicy.circuit_breaker,
      notes: ['Execution is cached per idempotency key for 60 minutes.'],
    },
    metrics: buildRunnerMetrics(
      'ops.health_audit',
      'Health audit execution and outcomes'
    ),
    cost_policy: {
      finops_owner: 'ops-finops',
      cost_center: 'ops-reliability',
      budget_usd_per_day: 50,
      estimated_cost_per_execution_usd: 0.5,
      max_cost_per_execution_usd: 2,
      max_executions_per_run: MAX_SERVICES_PER_AUDIT,
      guardrails: [
        `services_per_audit<=${MAX_SERVICES_PER_AUDIT}`,
        'retry_policy.max_attempts<=3',
        'timeout_budget_ms<=60000',
      ],
    },
    finops_hooks: ['execution_metadata.cost_usd_estimate', 'metadata.finops in job requests'],
  },
  {
    runner_id: 'autopilot.ops.alert_correlate',
    purpose: 'Emit correlation requests for critical alert groups (runnerless).',
    inputs: ['AlertCorrelation groups', 'tenant_context', 'trace_id'],
    outputs: ['JobForge JobRequest (alert correlation)'],
    failure_modes: ['JobForge request validation failure', 'Request bundle exceeds cap'],
    execution_guarantees: {
      idempotent: true,
      retry_policy: {
        max_attempts: 1,
        backoff_strategy: 'fixed',
        initial_delay_ms: 0,
        max_delay_ms: 0,
      },
      timeout_budget_ms: 5000,
      notes: ['JobForge enforces idempotency via deterministic idempotency keys.'],
    },
    metrics: buildRunnerMetrics(
      'autopilot.ops.alert_correlate',
      'Alert correlation request emission'
    ),
    cost_policy: {
      finops_owner: 'ops-finops',
      cost_center: 'ops-reliability',
      budget_usd_per_day: 20,
      estimated_cost_per_execution_usd: 0.1,
      max_cost_per_execution_usd: 0.5,
      max_executions_per_run: MAX_JOB_REQUESTS_PER_BATCH,
      guardrails: [`job_request_batch<=${MAX_JOB_REQUESTS_PER_BATCH}`],
    },
    finops_hooks: ['metadata.finops in job requests', 'batch size caps enforced'],
  },
  {
    runner_id: 'autopilot.ops.runbook_generate',
    purpose: 'Emit runbook generation or execution requests (runnerless).',
    inputs: ['Runbook data', 'tenant_context', 'trace_id'],
    outputs: ['JobForge JobRequest (runbook generate/execute/notify)'],
    failure_modes: ['JobForge request validation failure', 'Request bundle exceeds cap'],
    execution_guarantees: {
      idempotent: true,
      retry_policy: {
        max_attempts: 1,
        backoff_strategy: 'fixed',
        initial_delay_ms: 0,
        max_delay_ms: 0,
      },
      timeout_budget_ms: 5000,
      notes: ['Runnerless mode emits requests only; execution is delegated.'],
    },
    metrics: buildRunnerMetrics(
      'autopilot.ops.runbook_generate',
      'Runbook request emission'
    ),
    cost_policy: {
      finops_owner: 'ops-finops',
      cost_center: 'ops-reliability',
      budget_usd_per_day: 25,
      estimated_cost_per_execution_usd: 0.2,
      max_cost_per_execution_usd: 1,
      max_executions_per_run: MAX_JOB_REQUESTS_PER_BATCH,
      guardrails: [`job_request_batch<=${MAX_JOB_REQUESTS_PER_BATCH}`],
    },
    finops_hooks: ['metadata.finops in job requests', 'batch size caps enforced'],
  },
  {
    runner_id: 'autopilot.ops.reliability_report',
    purpose: 'Emit reliability report follow-up requests (runnerless).',
    inputs: ['Reliability report summary', 'tenant_context', 'trace_id'],
    outputs: ['JobForge JobRequest (reliability report)'],
    failure_modes: ['JobForge request validation failure', 'Request bundle exceeds cap'],
    execution_guarantees: {
      idempotent: true,
      retry_policy: {
        max_attempts: 1,
        backoff_strategy: 'fixed',
        initial_delay_ms: 0,
        max_delay_ms: 0,
      },
      timeout_budget_ms: 5000,
      notes: ['Runnerless mode emits requests only; execution is delegated.'],
    },
    metrics: buildRunnerMetrics(
      'autopilot.ops.reliability_report',
      'Reliability report request emission'
    ),
    cost_policy: {
      finops_owner: 'ops-finops',
      cost_center: 'ops-reliability',
      budget_usd_per_day: 25,
      estimated_cost_per_execution_usd: 0.15,
      max_cost_per_execution_usd: 0.75,
      max_executions_per_run: MAX_JOB_REQUESTS_PER_BATCH,
      guardrails: [`job_request_batch<=${MAX_JOB_REQUESTS_PER_BATCH}`],
    },
    finops_hooks: ['metadata.finops in job requests', 'batch size caps enforced'],
  },
];

export function exportRunnerMetricsOpenMetrics(
  definitions: RunnerDefinition[] = RUNNER_DEFINITIONS
): string {
  const seen = new Set<string>();
  const lines: string[] = [];

  for (const definition of definitions) {
    for (const metric of definition.metrics) {
      if (!seen.has(metric.name)) {
        lines.push(`# HELP ${metric.name} ${metric.description}`);
        lines.push(`# TYPE ${metric.name} ${metric.type}`);
        if (metric.unit) {
          lines.push(`# UNIT ${metric.name} ${metric.unit}`);
        }
        seen.add(metric.name);
      }

      const labels = metric.labels
        ? `{${Object.entries(metric.labels)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, value]) => `${key}="${value}"`)
            .join(',')}}`
        : '';
      lines.push(`${metric.name}${labels} 0`);
    }
  }

  return `${lines.join('\n')}\n`;
}
