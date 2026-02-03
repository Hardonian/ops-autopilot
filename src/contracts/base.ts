import { z } from 'zod';
import { IdentifierSchema, ISODateTimeSchema, SeveritySchema } from '@autopilot/contracts';

export const TenantIdSchema = IdentifierSchema;
export const ProjectIdSchema = IdentifierSchema;
export const EventIdSchema = IdentifierSchema;
export const TimestampSchema = ISODateTimeSchema;
export const HashSchema = z.string().regex(/^[a-f0-9]{64}$/i, 'Must be a SHA-256 hex digest');

export const EvidenceLinkSchema = z.object({
  type: z.string(),
  id: z.string(),
  description: z.string(),
  url: z.string().url().optional(),
});

export type EvidenceLink = z.infer<typeof EvidenceLinkSchema>;

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
