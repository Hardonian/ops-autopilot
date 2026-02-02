import {
  JobRequestSchema,
  JobRequestBatchSchema,
  type JobRequest,
  type JobRequestBatch,
} from '@autopilot/contracts';

/**
 * Validation result type
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Validation error details
 */
export interface ValidationError {
  path: string;
  message: string;
  code: string;
}

/**
 * Comprehensive validation of a job request
 * 
 * Performs both schema validation and business rule validation.
 * 
 * @param request - Request to validate
 * @returns Detailed validation result
 */
export function validateRequest(request: unknown): ValidationResult {
  const errors: ValidationError[] = [];
  
  // Schema validation
  const schemaResult = JobRequestSchema.safeParse(request);
  
  if (!schemaResult.success) {
    for (const issue of schemaResult.error.issues) {
      errors.push({
        path: issue.path.join('.'),
        message: issue.message,
        code: 'SCHEMA_VIOLATION',
      });
    }
    
    return { valid: false, errors };
  }
  
  const validRequest = schemaResult.data;
  
  // Business rule: Policy token requirement warning
  if (!validRequest.policy.requires_policy_token) {
    errors.push({
      path: 'policy.requires_policy_token',
      message: 'Policy token is recommended for audit compliance',
      code: 'POLICY_WARNING',
    });
  }
  
  // Business rule: Cost estimate recommended for expensive jobs
  if (!validRequest.cost_estimate && validRequest.priority === 'high') {
    errors.push({
      path: 'cost_estimate',
      message: 'Cost estimate recommended for high-priority jobs',
      code: 'COST_WARNING',
    });
  }
  
  // Business rule: Evidence links recommended
  if (validRequest.evidence_links.length === 0) {
    errors.push({
      path: 'evidence_links',
      message: 'Evidence links recommended for traceability',
      code: 'EVIDENCE_WARNING',
    });
  }
  
  // Business rule: Expiration should be reasonable
  if (validRequest.expires_at) {
    const expiresAt = new Date(validRequest.expires_at);
    const now = new Date();
    const hoursUntilExpiry = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    if (hoursUntilExpiry < 1) {
      errors.push({
        path: 'expires_at',
        message: 'Expiration should be at least 1 hour in the future',
        code: 'EXPIRATION_ERROR',
      });
    }
    
    if (hoursUntilExpiry > 168) { // 7 days
      errors.push({
        path: 'expires_at',
        message: 'Expiration longer than 7 days may indicate stale request',
        code: 'EXPIRATION_WARNING',
      });
    }
  }
  
  const isValid = !errors.some((e) => e.code.endsWith('_ERROR'));
  
  return {
    valid: isValid,
    errors: errors.filter((e) => !isValid || !e.code.endsWith('_WARNING')),
  };
}

/**
 * Validate a batch of job requests
 * @param batch - Batch to validate
 * @returns Validation result
 */
export function validateBatch(batch: unknown): ValidationResult {
  const errors: ValidationError[] = [];
  
  // Schema validation
  const schemaResult = JobRequestBatchSchema.safeParse(batch);
  
  if (!schemaResult.success) {
    for (const issue of schemaResult.error.issues) {
      errors.push({
        path: issue.path.join('.'),
        message: issue.message,
        code: 'SCHEMA_VIOLATION',
      });
    }
    
    return { valid: false, errors };
  }
  
  const validBatch = schemaResult.data;
  
  // Validate each request in batch
  for (let i = 0; i < validBatch.requests.length; i++) {
    const requestResult = validateRequest(validBatch.requests[i]);
    
    for (const error of requestResult.errors) {
      errors.push({
        ...error,
        path: `requests[${i}].${error.path}`,
      });
    }
  }
  
  // Business rule: Batch should not be too large
  if (validBatch.requests.length > 100) {
    errors.push({
      path: 'requests',
      message: 'Batch size exceeds recommended maximum of 100 requests',
      code: 'BATCH_SIZE_WARNING',
    });
  }
  
  const isValid = !errors.some((e) => e.code.endsWith('_ERROR'));
  
  return {
    valid: isValid,
    errors: errors.filter((e) => !isValid || !e.code.endsWith('_WARNING')),
  };
}

/**
 * Check if a request is valid (simple boolean check)
 * @param request - Request to check
 * @returns True if valid
 */
export function isValidRequest(request: unknown): boolean {
  return validateRequest(request).valid;
}

/**
 * Check if a batch is valid (simple boolean check)
 * @param batch - Batch to check
 * @returns True if valid
 */
export function isValidBatch(batch: unknown): boolean {
  return validateBatch(batch).valid;
}