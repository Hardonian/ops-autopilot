import { z } from 'zod';
import { JobRequestSchema, ReportEnvelopeSchema } from '@autopilot/contracts';
import { HashSchema, ProjectIdSchema, TenantIdSchema, TimestampSchema } from './base.js';

export const ModuleIdSchema = z.enum(['ops']);
export type ModuleId = z.infer<typeof ModuleIdSchema>;

export const IdempotencyKeySchema = z.object({
  job_type: z.string().min(1),
  idempotency_key: z.string().min(1),
});

export type IdempotencyKey = z.infer<typeof IdempotencyKeySchema>;

export const CanonicalizationSchema = z.object({
  algorithm: z.literal('json-lexicographic'),
  hash_algorithm: z.literal('sha256'),
  hash: HashSchema,
});

export type Canonicalization = z.infer<typeof CanonicalizationSchema>;

export const JobRequestBundleSchema = z.object({
  schema_version: z.literal('1.0.0'),
  module_id: ModuleIdSchema,
  tenant_id: TenantIdSchema,
  project_id: ProjectIdSchema,
  trace_id: z.string().min(1),
  created_at: TimestampSchema,
  dry_run: z.literal(true),
  requests: z.array(JobRequestSchema),
  idempotency_keys: z.array(IdempotencyKeySchema),
  canonicalization: CanonicalizationSchema,
});

export type JobRequestBundle = z.infer<typeof JobRequestBundleSchema>;

export const ReportEnvelopeBundleSchema = z.object({
  schema_version: z.literal('1.0.0'),
  module_id: ModuleIdSchema,
  tenant_id: TenantIdSchema,
  project_id: ProjectIdSchema,
  trace_id: z.string().min(1),
  created_at: TimestampSchema,
  dry_run: z.literal(true),
  report: ReportEnvelopeSchema,
  idempotency_keys: z.array(IdempotencyKeySchema),
  canonicalization: CanonicalizationSchema,
});

export type ReportEnvelopeBundle = z.infer<typeof ReportEnvelopeBundleSchema>;
