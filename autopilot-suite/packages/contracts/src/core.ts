import { z } from 'zod';

/**
 * Core primitive schemas used throughout Autopilot
 */

/** ISO 8601 datetime string */
export const ISODateTimeSchema = z.string().datetime();

export type ISODateTime = z.infer<typeof ISODateTimeSchema>;

/** Non-empty string identifier */
export const IdentifierSchema = z.string().min(1).max(256);

export type Identifier = z.infer<typeof IdentifierSchema>;

/** UUID v4 string */
export const UUIDSchema = z.string().uuid();

export type UUID = z.infer<typeof UUIDSchema>;

/** Semantic version string */
export const SemVerSchema = z.string().regex(
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/,
  'Must be valid semantic version (e.g., 1.0.0)'
);

export type SemVer = z.infer<typeof SemVerSchema>;

/** Priority levels for jobs and tasks */
export const PrioritySchema = z.enum(['low', 'normal', 'high', 'critical']);

export type Priority = z.infer<typeof PrioritySchema>;

/** Severity levels for findings and issues */
export const SeveritySchema = z.enum(['info', 'opportunity', 'warning', 'critical']);

export type Severity = z.infer<typeof SeveritySchema>;

/** JSON-serializable primitive values */
export const JSONPrimitiveSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);

export type JSONPrimitive = z.infer<typeof JSONPrimitiveSchema>;

/** JSON-serializable values (including objects and arrays) */
export const JSONValueSchema: z.ZodType = z.lazy(() =>
  z.union([
    JSONPrimitiveSchema,
    z.record(JSONValueSchema),
    z.array(JSONValueSchema),
  ])
);

export type JSONValue = z.infer<typeof JSONValueSchema>;

/** Metadata record (string keys, JSON values) */
export const MetadataSchema = z.record(z.string(), JSONValueSchema);

export type Metadata = z.infer<typeof MetadataSchema>;

/** Timestamped entity mixin */
export const TimestampedSchema = z.object({
  created_at: ISODateTimeSchema,
  updated_at: ISODateTimeSchema.optional(),
});

export type Timestamped = z.infer<typeof TimestampedSchema>;

/** Versioned entity mixin */
export const VersionedSchema = z.object({
  version: SemVerSchema,
  schema_version: z.string().optional(),
});

export type Versioned = z.infer<typeof VersionedSchema>;

/** Paginated result wrapper */
export const PaginatedSchema = <T extends z.ZodType>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().nonnegative(),
    page_size: z.number().int().positive(),
    has_more: z.boolean(),
  });

export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
};