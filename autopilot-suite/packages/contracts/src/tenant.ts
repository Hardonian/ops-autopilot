import { z } from 'zod';
import { IdentifierSchema } from './core.js';

/**
 * Multi-tenant context schemas
 * 
 * Every operation in Autopilot must be scoped to a tenant and project.
 * This ensures data isolation and prevents cross-tenant leakage.
 */

/** Tenant context - required for all operations */
export const TenantContextSchema = z.object({
  tenant_id: IdentifierSchema.describe('Unique tenant identifier'),
  project_id: IdentifierSchema.describe('Unique project identifier within tenant'),
});

export type TenantContext = z.infer<typeof TenantContextSchema>;

/** Extended tenant context with optional metadata */
export const ExtendedTenantContextSchema = TenantContextSchema.extend({
  environment: z.enum(['development', 'staging', 'production']).optional(),
  region: z.string().optional(),
  metadata: z.record(z.string()).optional(),
});

export type ExtendedTenantContext = z.infer<typeof ExtendedTenantContextSchema>;

/**
 * Validate tenant context
 * @param context - Unknown value to validate
 * @returns Validation result with typed context or errors
 */
export function validateTenantContext(context: unknown): {
  valid: boolean;
  context?: TenantContext;
  errors?: string[];
} {
  const result = TenantContextSchema.safeParse(context);
  
  if (result.success) {
    return { valid: true, context: result.data };
  } else {
    return {
      valid: false,
      errors: result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
    };
  }
}

/**
 * Create tenant context with defaults
 * @param tenant_id - Tenant identifier
 * @param project_id - Project identifier
 * @returns Validated tenant context
 */
export function createTenantContext(
  tenant_id: string,
  project_id: string
): TenantContext {
  return TenantContextSchema.parse({ tenant_id, project_id });
}