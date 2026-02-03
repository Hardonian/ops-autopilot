/**
 * Ops Autopilot Base Contracts
 *
 * Re-exports from @autopilot/contracts canonical types.
 * Local extensions for ops-specific domain concepts.
 */

import { z } from 'zod';
import {
  IdentifierSchema,
  ISODateTimeSchema,
  SeveritySchema,
  type Severity,
} from '@autopilot/contracts';

// Re-export canonical types for convenience
export { IdentifierSchema, ISODateTimeSchema, SeveritySchema, type Severity };

/**
 * Tenant identifier - re-exported from canonical IdentifierSchema
 * @deprecated Use IdentifierSchema directly from @autopilot/contracts
 */
export const TenantIdSchema = IdentifierSchema;

/**
 * Project identifier - re-exported from canonical IdentifierSchema
 * @deprecated Use IdentifierSchema directly from @autopilot/contracts
 */
export const ProjectIdSchema = IdentifierSchema;

/**
 * Event identifier - re-exported from canonical IdentifierSchema
 * @deprecated Use IdentifierSchema directly from @autopilot/contracts
 */
export const EventIdSchema = IdentifierSchema;

/**
 * Timestamp - re-exported from canonical ISODateTimeSchema
 * @deprecated Use ISODateTimeSchema directly from @autopilot/contracts
 */
export const TimestampSchema = ISODateTimeSchema;

/**
 * SHA-256 hash string
 */
export const HashSchema = z.string().regex(/^[a-f0-9]{64}$/i, 'Must be a SHA-256 hex digest');

/**
 * Evidence link - connects findings to source signals
 * Aligns with canonical EvidenceSchema structure
 */
export const EvidenceLinkSchema = z.object({
  type: z.string(),
  id: z.string(),
  description: z.string(),
  url: z.string().url().optional(),
});

export type EvidenceLink = z.infer<typeof EvidenceLinkSchema>;

/**
 * Finding - represents a discovered issue or observation
 * Ops-specific finding structure aligned with canonical patterns
 */
export const FindingSchema = z.object({
  id: z.string().min(1),
  severity: SeveritySchema,
  category: z.string().min(1),
  message: z.string().min(1),
  recommendation: z.string(),
  evidence: z.array(
    z.object({
      type: z.string(),
      path: z.string(),
      value: z.unknown(),
      description: z.string(),
    })
  ),
});

export type Finding = z.infer<typeof FindingSchema>;

/**
 * Capability metadata schema for ops capabilities
 * Defines inputs, outputs, errors, and execution policy
 */
export const CapabilityMetadataSchema = z.object({
  /** Capability identifier (e.g., 'ops.health_audit') */
  capability_id: z.string(),

  /** Semantic version */
  version: z.string(),

  /** Human-readable description */
  description: z.string(),

  /** Input schema reference */
  input_schema: z.object({
    type: z.literal('zod_schema'),
    ref: z.string(),
    description: z.string(),
  }),

  /** Output schema reference */
  output_schema: z.object({
    type: z.literal('zod_schema'),
    ref: z.string(),
    description: z.string(),
  }),

  /** Error types this capability may produce */
  errors: z.array(
    z.object({
      code: z.string(),
      message: z.string(),
      severity: SeveritySchema,
      recoverable: z.boolean(),
    })
  ),

  /** Execution policy */
  execution_policy: z.object({
    /** Whether execution must be idempotent */
    idempotent: z.boolean(),

    /** Retry policy configuration */
    retry_policy: z.object({
      /** Maximum number of retry attempts */
      max_attempts: z.number().int().min(1).max(10),

      /** Backoff strategy: fixed, linear, or exponential */
      backoff_strategy: z.enum(['fixed', 'linear', 'exponential']),

      /** Initial delay in milliseconds */
      initial_delay_ms: z.number().int().min(100).max(60000),

      /** Maximum delay between retries in milliseconds */
      max_delay_ms: z.number().int().min(1000).max(300000),

      /** Multiplier for exponential backoff */
      backoff_multiplier: z.number().min(1).max(10).optional(),
    }),

    /** Timeout budget in milliseconds */
    timeout_budget_ms: z.number().int().min(1000).max(300000),

    /** Circuit breaker configuration */
    circuit_breaker: z
      .object({
        /** Failure threshold to open circuit */
        failure_threshold: z.number().int().min(1).max(20),

        /** Recovery timeout in milliseconds */
        recovery_timeout_ms: z.number().int().min(1000).max(60000),
      })
      .optional(),
  }),

  /** Required permissions for execution */
  required_permissions: z.array(z.string()).default([]),

  /** Tags for categorization */
  tags: z.array(z.string()).default([]),
});

export type CapabilityMetadata = z.infer<typeof CapabilityMetadataSchema>;

/**
 * Health audit input schema
 */
export const HealthAuditInputSchema = z.object({
  tenant_id: IdentifierSchema,
  project_id: IdentifierSchema,
  services: z.array(z.string()).optional(),
  include_metrics: z.array(z.string()).optional(),
  audit_depth: z.enum(['surface', 'standard', 'deep']).default('standard'),
  time_range: z
    .object({
      start: ISODateTimeSchema,
      end: ISODateTimeSchema,
    })
    .optional(),
  idempotency_key: z.string().optional(),
});

export type HealthAuditInput = z.infer<typeof HealthAuditInputSchema>;

/**
 * Health audit output schema
 */
export const HealthAuditOutputSchema = z.object({
  audit_id: z.string(),
  status: z.enum(['success', 'partial', 'failure']),
  services_audited: z.array(z.string()),
  findings: z.array(FindingSchema),
  metrics: z.record(z.string(), z.number()),
  recommendations: z.array(
    z.object({
      priority: z.enum(['low', 'medium', 'high', 'critical']),
      description: z.string(),
      action: z.string(),
    })
  ),
  execution_metadata: z.object({
    started_at: ISODateTimeSchema,
    completed_at: ISODateTimeSchema,
    attempts: z.number().int(),
    execution_time_ms: z.number().int(),
  }),
  idempotency_key: z.string().optional(),
});

export type HealthAuditOutput = z.infer<typeof HealthAuditOutputSchema>;

/**
 * Pre-defined capability metadata for ops.health_audit
 */
export const HealthAuditCapabilityMetadata: CapabilityMetadata = {
  capability_id: 'ops.health_audit',
  version: '1.0.0',
  description: 'Performs comprehensive health audit of infrastructure services',
  input_schema: {
    type: 'zod_schema',
    ref: 'HealthAuditInputSchema',
    description: 'Services to audit, metrics to include, audit depth',
  },
  output_schema: {
    type: 'zod_schema',
    ref: 'HealthAuditOutputSchema',
    description: 'Audit findings, metrics, and recommendations',
  },
  errors: [
    {
      code: 'INVALID_INPUT',
      message: 'Input validation failed',
      severity: 'warning',
      recoverable: false,
    },
    {
      code: 'DEPENDENCY_UNAVAILABLE',
      message: 'Required monitoring service unavailable',
      severity: 'critical',
      recoverable: true,
    },
    {
      code: 'TIMEOUT_EXCEEDED',
      message: 'Audit exceeded timeout budget',
      severity: 'warning',
      recoverable: true,
    },
    {
      code: 'IDEMPOTENCY_CONFLICT',
      message: 'Duplicate audit with same idempotency key',
      severity: 'info',
      recoverable: false,
    },
  ],
  execution_policy: {
    idempotent: true,
    retry_policy: {
      max_attempts: 3,
      backoff_strategy: 'exponential',
      initial_delay_ms: 100, // Tighter initial delay for faster recovery
      max_delay_ms: 5000, // Reduced max delay to avoid thundering herd
      backoff_multiplier: 2,
    },
    timeout_budget_ms: 60000,
    circuit_breaker: {
      failure_threshold: 5,
      recovery_timeout_ms: 10000, // Reduced recovery time for faster healing
    },
  },
  required_permissions: ['ops:read', 'metrics:read'],
  tags: ['ops', 'health', 'audit', 'infrastructure'],
};
