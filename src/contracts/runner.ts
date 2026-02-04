import { z } from 'zod';

export const RunnerMetricDefinitionSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['counter', 'gauge', 'histogram']),
  category: z.enum(['success', 'failure', 'latency', 'retry', 'idempotency', 'cost', 'volume']),
  description: z.string().min(1),
  unit: z.string().optional(),
  labels: z.record(z.string(), z.string()).optional(),
});

export type RunnerMetricDefinition = z.infer<typeof RunnerMetricDefinitionSchema>;

export const RunnerExecutionGuaranteeSchema = z.object({
  idempotent: z.boolean(),
  retry_policy: z
    .object({
      max_attempts: z.number().int().min(1).max(10),
      backoff_strategy: z.enum(['fixed', 'linear', 'exponential']),
      initial_delay_ms: z.number().int().min(0).max(60000),
      max_delay_ms: z.number().int().min(0).max(300000),
      backoff_multiplier: z.number().min(1).max(10).optional(),
    })
    .optional(),
  timeout_budget_ms: z.number().int().min(0).max(300000),
  circuit_breaker: z
    .object({
      failure_threshold: z.number().int().min(1).max(20),
      recovery_timeout_ms: z.number().int().min(1000).max(60000),
    })
    .optional(),
  notes: z.array(z.string()).default([]),
});

export type RunnerExecutionGuarantee = z.infer<typeof RunnerExecutionGuaranteeSchema>;

export const RunnerCostPolicySchema = z.object({
  finops_owner: z.string().min(1),
  cost_center: z.string().min(1),
  budget_usd_per_day: z.number().positive(),
  estimated_cost_per_execution_usd: z.number().min(0),
  max_cost_per_execution_usd: z.number().positive(),
  max_executions_per_run: z.number().int().min(1),
  guardrails: z.array(z.string()).min(1),
});

export type RunnerCostPolicy = z.infer<typeof RunnerCostPolicySchema>;

export const RunnerDefinitionSchema = z.object({
  runner_id: z.string().min(1),
  purpose: z.string().min(1),
  inputs: z.array(z.string()).min(1),
  outputs: z.array(z.string()).min(1),
  failure_modes: z.array(z.string()).min(1),
  execution_guarantees: RunnerExecutionGuaranteeSchema,
  metrics: z.array(RunnerMetricDefinitionSchema).min(1),
  cost_policy: RunnerCostPolicySchema,
  finops_hooks: z.array(z.string()).min(1),
});

export type RunnerDefinition = z.infer<typeof RunnerDefinitionSchema>;
