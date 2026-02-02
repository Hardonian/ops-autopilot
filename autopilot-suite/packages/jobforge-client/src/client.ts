import {
  type TenantContext,
  type JobRequest,
  type JobRequestBatch,
  type JobType,
  type CostEstimate,
  createJobRequest,
  batchJobRequests,
  serializeJobRequest,
  JobRequestSchema,
  JobRequestBatchSchema,
} from '@autopilot/contracts';

/**
 * JobForge client configuration
 * 
 * This configuration is for request generation only.
 * No network endpoints or credentials are configured here.
 */
export interface JobForgeClientConfig {
  /** Default tenant context for requests */
  defaultTenantContext?: TenantContext;
  
  /** Default priority for requests */
  defaultPriority?: 'low' | 'normal' | 'high' | 'critical';
  
  /** Whether to require policy tokens by default */
  requirePolicyToken?: boolean;
  
  /** Default request expiration time in hours */
  defaultExpirationHours?: number;
}

/**
 * JobForge client - request generator only
 * 
 * This client generates validated JobForge request payloads.
 * It does NOT execute jobs or connect to JobForge.
 */
export class JobForgeClient {
  private config: JobForgeClientConfig;
  
  constructor(config: JobForgeClientConfig = {}) {
    this.config = {
      requirePolicyToken: true,
      defaultPriority: 'normal',
      defaultExpirationHours: 24,
      ...config,
    };
  }
  
  /**
   * Create a job request
   * @param jobType - Type of job
   * @param payload - Job-specific payload
   * @param options - Request options
   * @returns Validated job request
   */
  createRequest(
    jobType: JobType,
    payload: Record<string, unknown>,
    options?: {
      tenantContext?: TenantContext;
      priority?: 'low' | 'normal' | 'high' | 'critical';
      evidenceLinks?: Array<{ type: string; id: string; description: string }>;
      costEstimate?: CostEstimate;
      expiresInHours?: number;
    }
  ): JobRequest {
    const tenantContext = options?.tenantContext ?? this.config.defaultTenantContext;
    
    if (!tenantContext) {
      throw new Error('Tenant context is required (provide in options or config)');
    }
    
    const expiresAt = options?.expiresInHours !== undefined
      ? new Date(Date.now() + options.expiresInHours * 60 * 60 * 1000).toISOString()
      : this.config.defaultExpirationHours !== undefined
        ? new Date(Date.now() + this.config.defaultExpirationHours * 60 * 60 * 1000).toISOString()
        : undefined;
    
    return createJobRequest(jobType, tenantContext, payload, {
      priority: options?.priority ?? this.config.defaultPriority,
      evidence_links: options?.evidenceLinks,
      cost_estimate: options?.costEstimate,
      expires_at: expiresAt,
    });
  }
  
  /**
   * Batch multiple requests
   * @param requests - Array of job requests
   * @returns Batched request
   */
  batchRequests(requests: JobRequest[]): JobRequestBatch {
    return batchJobRequests(requests);
  }
  
  /**
   * Serialize request to JSON
   * @param request - Job request
   * @returns JSON string
   */
  serialize(request: JobRequest): string {
    return serializeJobRequest(request);
  }
  
  /**
   * Serialize batch to JSON
   * @param batch - Job request batch
   * @returns JSON string
   */
  serializeBatch(batch: JobRequestBatch): string {
    return JSON.stringify(batch, null, 2);
  }
  
  /**
   * Validate a request against schema
   * @param request - Request to validate
   * @returns Validation result
   */
  validate(request: unknown): { valid: boolean; errors?: string[] } {
    const result = JobRequestSchema.safeParse(request);
    
    if (result.success) {
      return { valid: true };
    } else {
      return {
        valid: false,
        errors: result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
      };
    }
  }
  
  /**
   * Validate a batch against schema
   * @param batch - Batch to validate
   * @returns Validation result
   */
  validateBatch(batch: unknown): { valid: boolean; errors?: string[] } {
    const result = JobRequestBatchSchema.safeParse(batch);
    
    if (result.success) {
      return { valid: true };
    } else {
      return {
        valid: false,
        errors: result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
      };
    }
  }
}

/**
 * Create a new JobForge client
 * @param config - Client configuration
 * @returns JobForge client instance
 */
export function createClient(config?: JobForgeClientConfig): JobForgeClient {
  return new JobForgeClient(config);
}