declare module '@autopilot/contracts' {
  import type { z } from 'zod';

  export const IdentifierSchema: z.ZodTypeAny;
  export const ISODateTimeSchema: z.ZodTypeAny;
  export const SeveritySchema: z.ZodTypeAny;
  export const JobRequestSchema: z.ZodTypeAny;
  export const JobRequestBatchSchema: z.ZodTypeAny;
  export const EventEnvelopeSchema: z.ZodTypeAny;
  export const RunManifestSchema: z.ZodTypeAny;
  export const ReportEnvelopeSchema: z.ZodTypeAny;

  export type TenantContext = { tenant_id: string; project_id: string };
  export type Severity = 'info' | 'opportunity' | 'warning' | 'critical';
  export type JobRequest = Record<string, unknown>;
  export type JobRequestBatch = Record<string, unknown>;
  export type Evidence = Record<string, unknown>;
  export type ReportEnvelope = Record<string, unknown>;
  export type ReportType = string;

  export function batchJobRequests(requests: JobRequest[]): JobRequestBatch;
  export function serializeJobRequest(request: JobRequest): string;
  export function serializeJobBatch(batch: JobRequestBatch): string;
}
