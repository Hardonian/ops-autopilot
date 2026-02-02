import { z } from 'zod';
import { ISODateTimeSchema, JSONValueSchema, SeveritySchema } from './core.js';

/**
 * Evidence schemas for traceability
 * 
 * Every recommendation, finding, or job request must link back to
 * the evidence (signal) that caused it. This enables audit trails
 * and explains the "why" behind every output.
 */

/** Evidence type enumeration */
export const EvidenceTypeSchema = z.enum([
  'signal',
  'metric',
  'event',
  'finding',
  'recommendation',
  'manual',
  'external',
]);

export type EvidenceType = z.infer<typeof EvidenceTypeSchema>;

/** Evidence link - connects outputs to source signals */
export const EvidenceSchema = z.object({
  /** Unique identifier for this evidence */
  id: z.string().min(1),
  
  /** Type of evidence */
  type: EvidenceTypeSchema,
  
  /** Human-readable description of the evidence */
  description: z.string().min(1),
  
  /** Location/path where evidence was found (e.g., file path, URL) */
  location: z.string().optional(),
  
  /** Severity classification */
  severity: SeveritySchema,
  
  /** Raw value or snapshot of the evidence */
  raw_value: JSONValueSchema.optional(),
  
  /** Timestamp when evidence was collected */
  collected_at: ISODateTimeSchema.optional(),
  
  /** Source system or module that produced this evidence */
  source: z.string().optional(),
});

export type Evidence = z.infer<typeof EvidenceSchema>;

/** Evidence collection - multiple evidence items */
export const EvidenceCollectionSchema = z.object({
  items: z.array(EvidenceSchema),
  total: z.number().int().nonnegative(),
  summary: z.string().optional(),
});

export type EvidenceCollection = z.infer<typeof EvidenceCollectionSchema>;

/**
 * Create evidence from a signal
 * @param signal - Signal identifier
 * @param severity - Severity level
 * @param description - Human-readable description
 * @returns Evidence object
 */
export function createEvidence(
  signal: string,
  severity: 'info' | 'opportunity' | 'warning' | 'critical',
  description: string
): Evidence {
  return EvidenceSchema.parse({
    id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: 'signal',
    description,
    severity,
    collected_at: new Date().toISOString(),
  });
}

/**
 * Calculate aggregate severity from evidence collection
 * @param evidence - Array of evidence
 * @returns Highest severity found
 */
export function aggregateSeverity(evidence: Evidence[]): Severity {
  const severityOrder = ['info', 'opportunity', 'warning', 'critical'] as const;
  let maxIndex = 0;
  
  for (const item of evidence) {
    const index = severityOrder.indexOf(item.severity);
    if (index > maxIndex) {
      maxIndex = index;
    }
  }
  
  return severityOrder[maxIndex];
}