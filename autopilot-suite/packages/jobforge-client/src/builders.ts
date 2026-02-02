import {
  type TenantContext,
  type JobRequest,
  type JobType,
  type CostEstimate,
  type Evidence,
  createJobRequest,
} from '@autopilot/contracts';

/**
 * Request builder for fluent job request creation
 */
export class RequestBuilder {
  private jobType?: JobType;
  private tenantContext?: TenantContext;
  private payload: Record<string, unknown> = {};
  private priority: 'low' | 'normal' | 'high' | 'critical' = 'normal';
  private evidenceLinks: Array<{ type: string; id: string; description: string }> = [];
  private costEstimate?: CostEstimate;
  private expiresAt?: string;
  private metadata: Record<string, unknown> = {};
  
  /**
   * Set job type
   * @param jobType - Type of job
   * @returns Builder instance
   */
  forJob(jobType: JobType): this {
    this.jobType = jobType;
    return this;
  }
  
  /**
   * Set tenant context
   * @param tenantId - Tenant ID
   * @param projectId - Project ID
   * @returns Builder instance
   */
  forTenant(tenantId: string, projectId: string): this {
    this.tenantContext = { tenant_id: tenantId, project_id: projectId };
    return this;
  }
  
  /**
   * Set tenant context from object
   * @param context - Tenant context
   * @returns Builder instance
   */
  withTenantContext(context: TenantContext): this {
    this.tenantContext = context;
    return this;
  }
  
  /**
   * Set job payload
   * @param payload - Job payload
   * @returns Builder instance
   */
  withPayload(payload: Record<string, unknown>): this {
    this.payload = payload;
    return this;
  }
  
  /**
   * Add payload field
   * @param key - Field key
   * @param value - Field value
   * @returns Builder instance
   */
  addPayloadField(key: string, value: unknown): this {
    this.payload[key] = value;
    return this;
  }
  
  /**
   * Set priority
   * @param priority - Priority level
   * @returns Builder instance
   */
  withPriority(priority: 'low' | 'normal' | 'high' | 'critical'): this {
    this.priority = priority;
    return this;
  }
  
  /**
   * Add evidence link
   * @param type - Evidence type
   * @param id - Evidence ID
   * @param description - Evidence description
   * @returns Builder instance
   */
  withEvidence(type: string, id: string, description: string): this {
    this.evidenceLinks.push({ type, id, description });
    return this;
  }
  
  /**
   * Add evidence from Evidence object
   * @param evidence - Evidence object
   * @returns Builder instance
   */
  withEvidenceObject(evidence: Evidence): this {
    this.evidenceLinks.push({
      type: evidence.type,
      id: evidence.id,
      description: evidence.description,
    });
    return this;
  }
  
  /**
   * Set cost estimate
   * @param credits - Estimated credits
   * @param confidence - Confidence level
   * @returns Builder instance
   */
  withCostEstimate(credits: number, confidence: 'low' | 'medium' | 'high' = 'medium'): this {
    this.costEstimate = { credits, confidence };
    return this;
  }
  
  /**
   * Set expiration
   * @param hours - Hours until expiration
   * @returns Builder instance
   */
  expiresIn(hours: number): this {
    this.expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
    return this;
  }
  
  /**
   * Set expiration date
   * @param date - Expiration date
   * @returns Builder instance
   */
  expiresAtDate(date: Date): this {
    this.expiresAt = date.toISOString();
    return this;
  }
  
  /**
   * Add metadata
   * @param key - Metadata key
   * @param value - Metadata value
   * @returns Builder instance
   */
  withMetadata(key: string, value: unknown): this {
    this.metadata[key] = value;
    return this;
  }
  
  /**
   * Build the job request
   * @returns Validated job request
   * @throws Error if required fields are missing
   */
  build(): JobRequest {
    if (!this.jobType) {
      throw new Error('Job type is required (use .forJob())');
    }
    
    if (!this.tenantContext) {
      throw new Error('Tenant context is required (use .forTenant() or .withTenantContext())');
    }
    
    return createJobRequest(this.jobType, this.tenantContext, this.payload, {
      priority: this.priority,
      evidence_links: this.evidenceLinks,
      cost_estimate: this.costEstimate,
      expires_at: this.expiresAt,
    });
  }
}

/**
 * Create a new request builder
 * @returns Request builder instance
 */
export function buildRequest(): RequestBuilder {
  return new RequestBuilder();
}

/**
 * Quick builder for common job types
 */
export const QuickBuilders = {
  /**
   * Create SEO scan request
   */
  seoScan(
    tenantContext: TenantContext,
    url: string,
    options?: {
      priority?: 'low' | 'normal' | 'high' | 'critical';
      evidence?: Evidence[];
    }
  ): JobRequest {
    return createJobRequest(
      'autopilot.growth.seo_scan',
      tenantContext,
      { url },
      {
        priority: options?.priority ?? 'normal',
        evidence_links: options?.evidence?.map((e) => ({
          type: e.type,
          id: e.id,
          description: e.description,
        })),
      }
    );
  },
  
  /**
   * Create content draft request
   */
  contentDraft(
    tenantContext: TenantContext,
    contentType: string,
    goal: string,
    options?: {
      priority?: 'low' | 'normal' | 'high' | 'critical';
      profileId?: string;
      variants?: number;
    }
  ): JobRequest {
    return createJobRequest(
      'autopilot.growth.content_draft',
      tenantContext,
      {
        content_type: contentType,
        goal,
        profile_id: options?.profileId ?? 'base',
        variants: options?.variants ?? 3,
      },
      {
        priority: options?.priority ?? 'normal',
      }
    );
  },
  
  /**
   * Create experiment proposal request
   */
  experimentProposal(
    tenantContext: TenantContext,
    funnelData: Record<string, unknown>,
    options?: {
      priority?: 'low' | 'normal' | 'high' | 'critical';
      maxProposals?: number;
    }
  ): JobRequest {
    return createJobRequest(
      'autopilot.growth.experiment_propose',
      tenantContext,
      {
        funnel_data: funnelData,
        max_proposals: options?.maxProposals ?? 5,
      },
      {
        priority: options?.priority ?? 'normal',
      }
    );
  },
};