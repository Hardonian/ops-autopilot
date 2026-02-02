import { z } from 'zod';

/**
 * Tenant and project identifiers for multi-tenancy safety
 */
export const TenantContextSchema = z.object({
  tenant_id: z.string().min(1, 'tenant_id is required'),
  project_id: z.string().min(1, 'project_id is required'),
});

export type TenantContext = z.infer<typeof TenantContextSchema>;

/**
 * Evidence link structure for traceability
 */
export const EvidenceSchema = z.object({
  signal: z.string(),
  location: z.string(),
  severity: z.enum(['critical', 'warning', 'info', 'opportunity']),
  raw_value: z.union([z.string(), z.number(), z.boolean(), z.null(), z.record(z.unknown()), z.array(z.unknown())]).optional(),
});

export type Evidence = z.infer<typeof EvidenceSchema>;

/**
 * SEO Finding schemas
 */
export const SEOIssueSchema = z.object({
  type: z.enum([
    'missing_title',
    'missing_meta_description',
    'missing_og_tags',
    'missing_canonical',
    'broken_link',
    'duplicate_title',
    'duplicate_meta',
    'title_too_long',
    'meta_too_long',
    'noindex_detected',
    'missing_sitemap_hint',
    'missing_robots_hint',
    'slow_page_hint',
    'mobile_viewport_missing',
  ]),
  page: z.string(),
  severity: z.enum(['critical', 'warning', 'info', 'opportunity']),
  message: z.string(),
  evidence: EvidenceSchema,
  recommendation: z.string(),
});

export type SEOIssue = z.infer<typeof SEOIssueSchema>;

export const SEOHealthScoreSchema = z.object({
  overall: z.number().min(0).max(100),
  categories: z.record(z.number().min(0).max(100)),
  total_pages: z.number().int().nonnegative(),
  issues_by_severity: z.object({
    critical: z.number().int().nonnegative(),
    warning: z.number().int().nonnegative(),
    info: z.number().int().nonnegative(),
    opportunity: z.number().int().nonnegative(),
  }),
});

export type SEOHealthScore = z.infer<typeof SEOHealthScoreSchema>;

export const SEOFindingsSchema = z.object({
  tenant_context: TenantContextSchema,
  scanned_at: z.string().datetime(),
  source_type: z.enum(['nextjs_routes', 'html_export', 'sitemap']),
  source_path: z.string(),
  health_score: SEOHealthScoreSchema,
  issues: z.array(SEOIssueSchema),
  summary: z.object({
    total_pages: z.number().int().nonnegative(),
    total_issues: z.number().int().nonnegative(),
    actionable_items: z.number().int().nonnegative(),
    opportunities: z.array(z.string()),
  }),
});

export type SEOFindings = z.infer<typeof SEOFindingsSchema>;

/**
 * Funnel Metrics schemas
 */
export const FunnelStageSchema = z.object({
  name: z.string(),
  event_name: z.string(),
  unique_users: z.number().int().nonnegative(),
  total_events: z.number().int().nonnegative(),
  conversion_rate_from_previous: z.number().min(0).max(100).nullable(),
  conversion_rate_from_start: z.number().min(0).max(100),
  avg_time_to_convert_seconds: z.number().nonnegative().nullable(),
  drop_off_count: z.number().int().nonnegative(),
  drop_off_rate: z.number().min(0).max(100),
});

export type FunnelStage = z.infer<typeof FunnelStageSchema>;

export const FunnelMetricsSchema = z.object({
  tenant_context: TenantContextSchema,
  computed_at: z.string().datetime(),
  funnel_name: z.string(),
  stages: z.array(FunnelStageSchema),
  overall_conversion_rate: z.number().min(0).max(100),
  total_users_entered: z.number().int().nonnegative(),
  total_users_completed: z.number().int().nonnegative(),
  biggest_drop_off_stage: z.string().nullable(),
  biggest_drop_off_rate: z.number().min(0).max(100).nullable(),
  time_window: z.object({
    start: z.string().datetime(),
    end: z.string().datetime(),
  }),
  evidence: z.array(EvidenceSchema),
});

export type FunnelMetrics = z.infer<typeof FunnelMetricsSchema>;

/**
 * Experiment Proposal schemas
 */
export const ExperimentTypeSchema = z.enum([
  'ab_test',
  'multivariate',
  'personalization',
  'sequential',
  'rollback',
]);

export type ExperimentType = z.infer<typeof ExperimentTypeSchema>;

export const EffortLevelSchema = z.enum(['low', 'medium', 'high']);

export type EffortLevel = z.infer<typeof EffortLevelSchema>;

export const ExperimentHypothesisSchema = z.object({
  belief: z.string(),
  expected_outcome: z.string(),
  success_metric: z.string(),
  minimum_detectable_effect: z.string(),
});

export type ExperimentHypothesis = z.infer<typeof ExperimentHypothesisSchema>;

export const ExperimentProposalSchema = z.object({
  tenant_context: TenantContextSchema,
  proposal_id: z.string(),
  created_at: z.string().datetime(),
  type: ExperimentTypeSchema,
  name: z.string(),
  description: z.string(),
  target_funnel_stage: z.string().nullable(),
  hypothesis: ExperimentHypothesisSchema,
  effort: EffortLevelSchema,
  expected_impact: z.object({
    metric: z.string(),
    lift_percentage: z.number(),
    confidence: z.enum(['low', 'medium', 'high']),
  }),
  variants: z.array(z.object({
    name: z.string(),
    description: z.string(),
    traffic_percentage: z.number().min(0).max(100),
  })),
  required_sample_size: z.number().int().nonnegative(),
  estimated_duration_days: z.number().int().nonnegative(),
  evidence: z.array(EvidenceSchema),
  prerequisites: z.array(z.string()),
  risks: z.array(z.string()),
});

export type ExperimentProposal = z.infer<typeof ExperimentProposalSchema>;

/**
 * Content Draft schemas
 */
export const ContentTypeSchema = z.enum([
  'landing_page',
  'onboarding_email',
  'changelog_note',
  'blog_post',
  'social_post',
  'ad_copy',
  'help_article',
]);

export type ContentType = z.infer<typeof ContentTypeSchema>;

export const ContentVariantSchema = z.object({
  name: z.string(),
  headline: z.string(),
  body: z.string(),
  cta: z.string(),
  meta_description: z.string().optional(),
  seo_keywords: z.array(z.string()),
});

export type ContentVariant = z.infer<typeof ContentVariantSchema>;

export const ContentDraftSchema = z.object({
  tenant_context: TenantContextSchema,
  draft_id: z.string(),
  created_at: z.string().datetime(),
  content_type: ContentTypeSchema,
  target_audience: z.string(),
  goal: z.string(),
  profile_used: z.string(),
  llm_provider: z.string().nullable(),
  llm_model: z.string().nullable(),
  variants: z.array(ContentVariantSchema),
  recommended_variant: z.string(),
  evidence: z.array(EvidenceSchema),
  suggested_experiments: z.array(z.string()),
  constraints_respected: z.object({
    prohibited_claims_checked: z.boolean(),
    brand_voice_matched: z.boolean(),
    character_limits_met: z.boolean(),
  }),
});

export type ContentDraft = z.infer<typeof ContentDraftSchema>;

/**
 * JobForge Request schemas
 */
export const JobPrioritySchema = z.enum(['low', 'normal', 'high', 'critical']);

export type JobPriority = z.infer<typeof JobPrioritySchema>;

export const JobForgeRequestSchema = z.object({
  job_type: z.enum([
    'autopilot.growth.seo_scan',
    'autopilot.growth.experiment_propose',
    'autopilot.growth.content_draft',
  ]),
  tenant_context: TenantContextSchema,
  priority: JobPrioritySchema,
  requested_at: z.string().datetime(),
  payload: z.record(z.unknown()),
  evidence_links: z.array(z.object({
    type: z.string(),
    id: z.string(),
    description: z.string(),
  })),
  estimated_cost_credits: z.number().int().nonnegative().optional(),
  expires_at: z.string().datetime().optional(),
});

export type JobForgeRequest = z.infer<typeof JobForgeRequestSchema>;

/**
 * Profile schemas
 */
export const ProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  icp: z.object({
    title: z.string(),
    company_size: z.string(),
    pain_points: z.array(z.string()),
    goals: z.array(z.string()),
  }),
  voice: z.object({
    tone: z.enum(['professional', 'friendly', 'technical', 'casual', 'bold']),
    style_notes: z.array(z.string()),
    vocabulary: z.object({
      preferred: z.array(z.string()),
      avoid: z.array(z.string()),
    }),
  }),
  keywords: z.object({
    primary: z.array(z.string()),
    secondary: z.array(z.string()),
    negative: z.array(z.string()),
  }),
  prohibited_claims: z.array(z.string()),
  features: z.array(z.object({
    name: z.string(),
    description: z.string(),
    benefit: z.string(),
  })),
  metadata: z.record(z.unknown()).optional(),
});

export type Profile = z.infer<typeof ProfileSchema>;
