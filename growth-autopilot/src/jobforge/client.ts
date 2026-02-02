import type {
  JobForgeRequest,
  TenantContext,
  SEOFindings,
  FunnelMetrics,
  ExperimentProposal,
  ContentDraft,
} from '../contracts/index.js';
import { JobForgeRequestSchema, JobPrioritySchema } from '../contracts/index.js';
import { now, generateId } from '../utils/index.js';

/**
 * JobForge client configuration
 */
export interface JobForgeConfig {
  tenant_context: TenantContext;
  base_url?: string;
  api_key?: string;
}

/**
 * Generate a JobForge request for SEO scan
 */
export function createSEOScanJob(
  findings: SEOFindings,
  config: JobForgeConfig,
  priority: 'low' | 'normal' | 'high' | 'critical' = 'normal'
): JobForgeRequest {
  const request: JobForgeRequest = {
    job_type: 'autopilot.growth.seo_scan',
    tenant_context: config.tenant_context,
    priority,
    requested_at: now(),
    payload: {
      findings_summary: {
        total_pages: findings.summary.total_pages,
        total_issues: findings.summary.total_issues,
        health_score: findings.health_score.overall,
        critical_issues: findings.health_score.issues_by_severity.critical,
      },
      source_type: findings.source_type,
      source_path: findings.source_path,
    },
    evidence_links: findings.issues.map((issue) => ({
      type: 'seo_issue',
      id: generateId('issue'),
      description: `${issue.type}: ${issue.message}`,
    })),
    estimated_cost_credits: calculateSEOCost(findings),
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
  };

  return JobForgeRequestSchema.parse(request);
}

/**
 * Generate a JobForge request for experiment proposal
 */
export function createExperimentJob(
  proposals: ExperimentProposal[],
  metrics: FunnelMetrics,
  config: JobForgeConfig,
  priority: 'low' | 'normal' | 'high' | 'critical' = 'normal'
): JobForgeRequest {
  const request: JobForgeRequest = {
    job_type: 'autopilot.growth.experiment_propose',
    tenant_context: config.tenant_context,
    priority,
    requested_at: now(),
    payload: {
      funnel_name: metrics.funnel_name,
      overall_conversion_rate: metrics.overall_conversion_rate,
      biggest_drop_off_stage: metrics.biggest_drop_off_stage,
      proposals_count: proposals.length,
      proposals_summary: proposals.map((p) => ({
        id: p.proposal_id,
        name: p.name,
        type: p.type,
        effort: p.effort,
        expected_lift: p.expected_impact.lift_percentage,
        confidence: p.expected_impact.confidence,
        duration_days: p.estimated_duration_days,
      })),
    },
    evidence_links: [
      {
        type: 'funnel_metrics',
        id: generateId('funnel'),
        description: `Funnel: ${metrics.funnel_name} (${metrics.total_users_entered} users)`,
      },
      ...proposals.map((p) => ({
        type: 'experiment_proposal',
        id: p.proposal_id,
        description: `${p.name}: ${p.hypothesis.belief.slice(0, 50)}...`,
      })),
    ],
    estimated_cost_credits: calculateExperimentCost(proposals),
    expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days
  };

  return JobForgeRequestSchema.parse(request);
}

/**
 * Generate a JobForge request for content draft
 */
export function createContentDraftJob(
  draft: ContentDraft,
  config: JobForgeConfig,
  priority: 'low' | 'normal' | 'high' | 'critical' = 'normal'
): JobForgeRequest {
  const request: JobForgeRequest = {
    job_type: 'autopilot.growth.content_draft',
    tenant_context: config.tenant_context,
    priority,
    requested_at: now(),
    payload: {
      content_type: draft.content_type,
      target_audience: draft.target_audience,
      goal: draft.goal,
      profile_used: draft.profile_used,
      variants_count: draft.variants.length,
      llm_enhanced: draft.llm_provider !== null,
      constraints_respected: draft.constraints_respected,
      recommended_variant: draft.recommended_variant,
    },
    evidence_links: [
      {
        type: 'content_draft',
        id: draft.draft_id,
        description: `${draft.content_type} draft with ${draft.variants.length} variants`,
      },
      ...draft.suggested_experiments.map((exp, idx) => ({
        type: 'suggested_experiment',
        id: generateId(`exp-${idx}`),
        description: exp,
      })),
    ],
    estimated_cost_credits: calculateContentCost(draft),
    expires_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days
  };

  return JobForgeRequestSchema.parse(request);
}

/**
 * Serialize a JobForge request to JSON
 */
export function serializeJobRequest(request: JobForgeRequest): string {
  return JSON.stringify(request, null, 2);
}

/**
 * Batch multiple job requests
 */
export function batchJobRequests(requests: JobForgeRequest[]): {
  batch_id: string;
  requests: JobForgeRequest[];
  total_cost: number;
} {
  return {
    batch_id: generateId('batch'),
    requests,
    total_cost: requests.reduce((sum, r) => sum + (r.estimated_cost_credits ?? 0), 0),
  };
}

/**
 * Calculate estimated cost for SEO scan job
 */
function calculateSEOCost(findings: SEOFindings): number {
  // Base cost + cost per issue
  const baseCost = 10;
  const perIssueCost = 1;
  const criticalMultiplier = findings.health_score.issues_by_severity.critical > 0 ? 2 : 1;

  return Math.ceil((baseCost + findings.summary.total_issues * perIssueCost) * criticalMultiplier);
}

/**
 * Calculate estimated cost for experiment job
 */
function calculateExperimentCost(proposals: ExperimentProposal[]): number {
  // Base cost + cost based on complexity
  const baseCost = 25;
  const perProposalCost = 10;
  const highEffortMultiplier = proposals.some((p) => p.effort === 'high') ? 1.5 : 1;

  return Math.ceil((baseCost + proposals.length * perProposalCost) * highEffortMultiplier);
}

/**
 * Calculate estimated cost for content job
 */
function calculateContentCost(draft: ContentDraft): number {
  // Base cost + cost per variant
  const baseCost = 15;
  const perVariantCost = 5;
  const llmMultiplier = draft.llm_provider ? 2 : 1;

  return Math.ceil((baseCost + draft.variants.length * perVariantCost) * llmMultiplier);
}

/**
 * Validate a JobForge request
 */
export function validateJobRequest(request: unknown): {
  valid: boolean;
  errors?: string[];
} {
  const result = JobForgeRequestSchema.safeParse(request);

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
 * Create a mock JobForge response (for testing)
 */
export function createMockJobResponse(
  request: JobForgeRequest
): {
  job_id: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  request: JobForgeRequest;
  estimated_completion: string;
} {
  return {
    job_id: generateId('job'),
    status: 'queued',
    request,
    estimated_completion: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour
  };
}
