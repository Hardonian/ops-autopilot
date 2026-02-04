import { describe, it, expect } from 'vitest';
import {
  RunnerDefinitionSchema,
  type RunnerDefinition,
} from '../src/contracts/index.js';
import { RUNNER_DEFINITIONS, exportRunnerMetricsOpenMetrics } from '../src/runners/index.js';

function hasMetricCategory(metrics: RunnerDefinition['metrics'], category: string): boolean {
  return metrics.some(metric => metric.category === category);
}

describe('Runner Maturity Catalog', () => {
  it('should validate runner definitions against schema', () => {
    for (const runner of RUNNER_DEFINITIONS) {
      const result = RunnerDefinitionSchema.safeParse(runner);
      expect(result.success).toBe(true);
    }
  });

  it('should define success and failure metrics for every runner', () => {
    for (const runner of RUNNER_DEFINITIONS) {
      expect(hasMetricCategory(runner.metrics, 'success')).toBe(true);
      expect(hasMetricCategory(runner.metrics, 'failure')).toBe(true);
    }
  });

  it('should enforce idempotency and retry semantics per runner', () => {
    for (const runner of RUNNER_DEFINITIONS) {
      expect(runner.execution_guarantees.idempotent).toBe(true);
      expect(runner.execution_guarantees.retry_policy?.max_attempts).toBeGreaterThan(0);
    }
  });

  it('should include finops hooks and bounded cost policies', () => {
    for (const runner of RUNNER_DEFINITIONS) {
      expect(runner.finops_hooks.length).toBeGreaterThan(0);
      expect(runner.cost_policy.max_cost_per_execution_usd).toBeGreaterThan(0);
      expect(runner.cost_policy.max_executions_per_run).toBeGreaterThan(0);
      expect(runner.cost_policy.budget_usd_per_day).toBeGreaterThan(0);
    }
  });

  it('should export metrics in OpenMetrics format', () => {
    const output = exportRunnerMetricsOpenMetrics();
    expect(output).toContain('# HELP ops_autopilot_runner_success_total');
    expect(output).toContain('# TYPE ops_autopilot_runner_success_total counter');
    expect(output).toContain('ops_autopilot_runner_success_total{runner="ops.health_audit"} 0');
  });
});
