import { z } from 'zod';
import { ISODateTimeSchema, JSONValueSchema, SemVerSchema } from './core.js';
import { TenantContextSchema } from './tenant.js';
import { EvidenceSchema } from './evidence.js';

/**
 * EventEnvelope - JobForge-compatible event schema
 *
 * Events are the primary input to Autopilot modules. They represent
 * signals from external systems (Settler, AIAS, Keys, ReadyLayer)
 * that trigger observation and recommendation workflows.
 */

/** Event types supported by Autopilot modules */
export const EventTypeSchema = z.enum([
  // Growth events
  'growth.page_scanned',
  'growth.funnel_updated',
  'growth.experiment_proposed',
  'growth.content_requested',

  // Ops events
  'ops.metric_alert',
  'ops.incident_detected',
  'ops.health_check_failed',
  'ops.cost_anomaly',

  // Support events
  'support.ticket_created',
  'support.ticket_updated',
  'support.kb_requested',
  'support.response_drafted',

  // FinOps events
  'finops.usage_reported',
  'finops.budget_threshold',
  'finops.cost_anomaly',
  'finops.optimization_opportunity',

  // Generic events
  'autopilot.trigger.manual',
  'autopilot.trigger.scheduled',
  'autopilot.trigger.webhook',
]);

export type EventType = z.infer<typeof EventTypeSchema>;

/** Event envelope - wraps all events with metadata */
export const EventEnvelopeSchema = z.object({
  /** Event envelope version */
  version: SemVerSchema,

  /** Unique event identifier */
  event_id: z.string().uuid(),

  /** Event type classification */
  event_type: EventTypeSchema,

  /** Tenant context for multi-tenancy */
  tenant_context: TenantContextSchema,

  /** Timestamp when event occurred */
  timestamp: ISODateTimeSchema,

  /** Event payload (type-specific data) */
  payload: z.record(z.string(), JSONValueSchema),

  /** Evidence links for traceability */
  evidence: z.array(EvidenceSchema).optional(),

  /** Source system that generated the event */
  source: z.object({
    system: z.string(),
    version: z.string().optional(),
    instance_id: z.string().optional(),
  }),

  /** Correlation ID for tracing request chains */
  correlation_id: z.string().optional(),

  /** Event priority */
  priority: z.enum(['low', 'normal', 'high', 'critical']).default('normal'),

  /** Whether event has been processed */
  processed: z.boolean().default(false),

  /** Processing metadata */
  processed_at: ISODateTimeSchema.optional(),
  processed_by: z.string().optional(),
});

export type EventEnvelope = z.infer<typeof EventEnvelopeSchema>;

/**
 * Create an event envelope
 * @param event_type - Type of event
 * @param tenant_context - Tenant/project context
 * @param payload - Event-specific data
 * @returns Validated event envelope
 */
export function createEventEnvelope(
  event_type: EventType,
  tenant_context: { tenant_id: string; project_id: string },
  payload: Record<string, unknown>,
  options?: {
    source?: { system: string; version?: string };
    priority?: 'low' | 'normal' | 'high' | 'critical';
    correlation_id?: string;
    evidence?: z.infer<typeof EvidenceSchema>[];
  }
): EventEnvelope {
  const now = new Date().toISOString();

  return EventEnvelopeSchema.parse({
    version: '1.0.0',
    event_id: crypto.randomUUID(),
    event_type,
    tenant_context: TenantContextSchema.parse(tenant_context),
    timestamp: now,
    payload,
    source: options?.source ?? { system: 'autopilot.unknown' },
    priority: options?.priority ?? 'normal',
    correlation_id: options?.correlation_id ?? crypto.randomUUID(),
    evidence: options?.evidence ?? [],
    processed: false,
  });
}

/**
 * Mark an event as processed
 * @param envelope - Event envelope
 * @param processor - Identifier of processor
 * @returns Updated envelope
 */
export function markEventProcessed(envelope: EventEnvelope, processor: string): EventEnvelope {
  return {
    ...envelope,
    processed: true,
    processed_at: new Date().toISOString(),
    processed_by: processor,
  };
}
