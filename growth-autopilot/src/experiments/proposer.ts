import type {
  FunnelMetrics,
  ExperimentProposal,
  ExperimentType,
  EffortLevel,
  TenantContext,
  Evidence,
} from '../contracts/index.js';
import { ExperimentProposalSchema } from '../contracts/index.js';
import { generateId, now } from '../utils/index.js';

/**
 * Proposer configuration
 */
export interface ProposerConfig {
  tenant_context: TenantContext;
  max_proposals?: number;
  min_confidence?: 'low' | 'medium' | 'high';
}

/**
 * Predefined experiment templates for common scenarios
 */
const EXPERIMENT_TEMPLATES: Array<{
  trigger: (metrics: FunnelMetrics) => boolean;
  type: ExperimentType;
  name: string;
  description: string;
  hypothesis: {
    belief: string;
    expected_outcome: string;
    success_metric: string;
    minimum_detectable_effect: string;
  };
  effort: EffortLevel;
  variants: Array<{ name: string; description: string; traffic_percentage: number }>;
  prerequisites: string[];
  risks: string[];
}> = [
  // Landing page optimization for entry drop-offs
  {
    trigger: (m) => m.stages[0]?.drop_off_rate > 30,
    type: 'ab_test',
    name: 'Landing Page Value Proposition Test',
    description: 'Test different headline and hero messaging to reduce initial bounce rate',
    hypothesis: {
      belief: 'Users are not understanding our core value proposition within 5 seconds',
      expected_outcome: 'Reduce landing page bounce rate by 15%',
      success_metric: 'landing_page_to_next_step_conversion',
      minimum_detectable_effect: '15% relative improvement',
    },
    effort: 'low',
    variants: [
      { name: 'control', description: 'Current headline and CTA', traffic_percentage: 50 },
      { name: 'value_focused', description: 'Benefit-focused headline with social proof', traffic_percentage: 50 },
    ],
    prerequisites: ['Landing page analytics tracking', 'Heatmap tool installed'],
    risks: ['May not address root cause of drop-off', 'Traffic volume may be insufficient'],
  },

  // Signup flow optimization
  {
    trigger: (m) => {
      const signupStage = m.stages.find((s) => s.name.toLowerCase().includes('signup'));
      return (signupStage?.drop_off_rate ?? 0) > 40;
    },
    type: 'ab_test',
    name: 'Simplified Signup Flow',
    description: 'Reduce signup friction by removing optional fields and adding progress indicator',
    hypothesis: {
      belief: 'Signup form has too many fields causing user abandonment',
      expected_outcome: 'Increase signup completion rate by 20%',
      success_metric: 'signup_completion_rate',
      minimum_detectable_effect: '20% relative improvement',
    },
    effort: 'medium',
    variants: [
      { name: 'control', description: 'Current multi-step signup', traffic_percentage: 50 },
      { name: 'simplified', description: 'Single-step with required fields only', traffic_percentage: 50 },
    ],
    prerequisites: ['User authentication system supports variants', 'Database schema allows partial profiles'],
    risks: ['Lower data quality from fewer fields', 'May require backend changes'],
  },

  // Activation/paywall optimization
  {
    trigger: (m) => {
      const activationStage = m.stages.find((s) => 
        s.name.toLowerCase().includes('activation') || 
        s.name.toLowerCase().includes('upgrade')
      );
      return (activationStage?.drop_off_rate ?? 0) > 50;
    },
    type: 'ab_test',
    name: 'Paywall Timing Experiment',
    description: 'Test showing paywall earlier vs later in user journey',
    hypothesis: {
      belief: 'Showing paywall after user experiences core value will increase conversion',
      expected_outcome: 'Increase paywall conversion by 10% without hurting retention',
      success_metric: 'paywall_conversion_rate',
      minimum_detectable_effect: '10% relative improvement',
    },
    effort: 'medium',
    variants: [
      { name: 'early', description: 'Show paywall after first action', traffic_percentage: 33 },
      { name: 'value_first', description: 'Show paywall after 3 value moments', traffic_percentage: 33 },
      { name: 'delayed', description: 'Show paywall after 7 days', traffic_percentage: 34 },
    ],
    prerequisites: ['Feature flags for paywall timing', 'Revenue tracking by cohort'],
    risks: ['Delayed paywall may increase churn', 'Revenue impact during test period'],
  },

  // Slow conversion optimization
  {
    trigger: (m) => {
      const times = m.stages
        .map((s) => s.avg_time_to_convert_seconds)
        .filter((t): t is number => t !== null);
      return times.some((t) => t > 300); // > 5 minutes
    },
    type: 'ab_test',
    name: 'Accelerate Conversion Flow',
    description: 'Add urgency elements and reduce steps for slow-converting users',
    hypothesis: {
      belief: 'Long time-to-convert indicates friction and lack of urgency',
      expected_outcome: 'Reduce time-to-convert by 30% and increase overall conversion',
      success_metric: 'conversion_rate_and_time_to_convert',
      minimum_detectable_effect: '20% faster conversion, 10% higher rate',
    },
    effort: 'low',
    variants: [
      { name: 'control', description: 'Current flow', traffic_percentage: 50 },
      { name: 'urgency', description: 'Add progress bar and time-limited offer', traffic_percentage: 50 },
    ],
    prerequisites: ['Timer functionality', 'Offer management system'],
    risks: ['Urgency tactics may feel aggressive', 'Test audience size may be small'],
  },

  // Overall conversion optimization
  {
    trigger: (m) => m.overall_conversion_rate < 10,
    type: 'multivariate',
    name: 'End-to-End Journey Optimization',
    description: 'Test multiple touchpoints simultaneously to find optimal combination',
    hypothesis: {
      belief: 'Multiple friction points compound to create low overall conversion',
      expected_outcome: 'Increase end-to-end conversion by 25%',
      success_metric: 'overall_funnel_conversion_rate',
      minimum_detectable_effect: '25% relative improvement',
    },
    effort: 'high',
    variants: [
      { name: 'control', description: 'Current experience', traffic_percentage: 25 },
      { name: 'streamlined', description: 'Reduced steps + clearer CTAs', traffic_percentage: 25 },
      { name: 'guided', description: 'Progressive disclosure + tooltips', traffic_percentage: 25 },
      { name: 'social_proof', description: 'Testimonials + usage stats throughout', traffic_percentage: 25 },
    ],
    prerequisites: ['High traffic volume (>1000 users/week)', 'Multivariate testing infrastructure'],
    risks: ['Requires significant development effort', 'Long test duration needed'],
  },

  // Retention/personalization for completed users
  {
    trigger: (m) => m.overall_conversion_rate > 30 && m.stages.length > 3,
    type: 'personalization',
    name: 'Post-Conversion Personalization',
    description: 'Personalize onboarding based on funnel entry point and behavior',
    hypothesis: {
      belief: 'Users converting through different paths have different needs',
      expected_outcome: 'Increase day-7 retention by 15%',
      success_metric: 'd7_retention_rate',
      minimum_detectable_effect: '15% relative improvement',
    },
    effort: 'medium',
    variants: [
      { name: 'control', description: 'Generic onboarding', traffic_percentage: 50 },
      { name: 'personalized', description: 'Segmented onboarding by entry point', traffic_percentage: 50 },
    ],
    prerequisites: ['User segmentation data', 'Dynamic content system'],
    risks: ['Segmentation logic complexity', 'Content creation overhead'],
  },
];

/**
 * Propose experiments based on funnel metrics
 * Pure deterministic analysis - no LLM required
 */
export function proposeExperiments(
  metrics: FunnelMetrics,
  config: ProposerConfig
): ExperimentProposal[] {
  const proposals: ExperimentProposal[] = [];

  // Find matching templates
  for (const template of EXPERIMENT_TEMPLATES) {
    if (template.trigger(metrics)) {
      const proposal = createProposalFromTemplate(template, metrics, config);
      
      // Check confidence threshold
      if (meetsConfidenceThreshold(proposal, config.min_confidence ?? 'low')) {
        proposals.push(proposal);
      }
    }
  }

  // Add proposals for specific stage issues
  const stageProposals = generateStageSpecificProposals(metrics, config);
  proposals.push(...stageProposals);

  // Sort by expected impact and limit
  proposals.sort((a, b) => {
    const impactOrder = { high: 3, medium: 2, low: 1 };
    return (
      impactOrder[b.expected_impact.confidence] -
      impactOrder[a.expected_impact.confidence]
    );
  });

  const maxProposals = config.max_proposals ?? 5;
  return proposals.slice(0, maxProposals);
}

/**
 * Create a proposal from a template
 */
function createProposalFromTemplate(
  template: (typeof EXPERIMENT_TEMPLATES)[0],
  metrics: FunnelMetrics,
  config: ProposerConfig
): ExperimentProposal {
  // Determine target stage
  const targetStage = metrics.stages.find((s) => {
    const stageName = s.name.toLowerCase();
    return (
      template.name.toLowerCase().includes(stageName) ||
      (template.description.toLowerCase().includes('signup') &&
        stageName.includes('signup')) ||
      (template.description.toLowerCase().includes('paywall') &&
        stageName.includes('activation'))
    );
  })?.name ?? null;

  // Estimate sample size and duration
  const targetUsers = targetStage
    ? metrics.stages.find((s) => s.name === targetStage)?.unique_users ??
      metrics.total_users_entered
    : metrics.total_users_entered;

  const requiredSampleSize = Math.ceil(targetUsers * 0.2); // 20% of users
  const estimatedDurationDays = Math.ceil(requiredSampleSize / 100); // Assume 100 users/day

  // Determine confidence based on sample size
  let confidence: 'low' | 'medium' | 'high' = 'low';
  if (requiredSampleSize > 1000) {
    confidence = 'high';
  } else if (requiredSampleSize > 500) {
    confidence = 'medium';
  }

  // Build evidence
  const evidence: Evidence[] = [
    {
      signal: 'funnel_metrics',
      location: `funnel:${metrics.funnel_name}`,
      severity: 'opportunity',
      raw_value: {
        target_stage: targetStage,
        target_users: targetUsers,
        current_conversion: metrics.overall_conversion_rate,
      },
    },
    {
      signal: 'experiment_template_match',
      location: 'template_library',
      severity: 'info',
      raw_value: template.name,
    },
  ];

  const proposal: ExperimentProposal = {
    tenant_context: config.tenant_context,
    proposal_id: generateId('exp'),
    created_at: now(),
    type: template.type,
    name: template.name,
    description: template.description,
    target_funnel_stage: targetStage,
    hypothesis: {
      belief: template.hypothesis.belief,
      expected_outcome: template.hypothesis.expected_outcome,
      success_metric: template.hypothesis.success_metric,
      minimum_detectable_effect: template.hypothesis.minimum_detectable_effect,
    },
    effort: template.effort,
    expected_impact: {
      metric: template.hypothesis.success_metric,
      lift_percentage: parseInt(template.hypothesis.expected_outcome.match(/\d+/)?.[0] ?? '10'),
      confidence,
    },
    variants: template.variants,
    required_sample_size: requiredSampleSize,
    estimated_duration_days: Math.max(estimatedDurationDays, 7), // Min 7 days
    evidence,
    prerequisites: template.prerequisites,
    risks: template.risks,
  };

  return ExperimentProposalSchema.parse(proposal);
}

/**
 * Generate stage-specific proposals
 */
function generateStageSpecificProposals(
  metrics: FunnelMetrics,
  config: ProposerConfig
): ExperimentProposal[] {
  const proposals: ExperimentProposal[] = [];

  for (const stage of metrics.stages) {
    // Skip first stage (no conversion rate from previous)
    if (stage.conversion_rate_from_previous === null) continue;

    // Proposal for low conversion stages
    if (stage.conversion_rate_from_previous < 30) {
      const evidence: Evidence[] = [
        {
          signal: 'low_stage_conversion',
          location: `stage:${stage.name}`,
          severity: 'critical',
          raw_value: stage.conversion_rate_from_previous,
        },
      ];

      const proposal: ExperimentProposal = {
        tenant_context: config.tenant_context,
        proposal_id: generateId('exp'),
        created_at: now(),
        type: 'ab_test',
        name: `${stage.name} - Conversion Recovery`,
        description: `Address ${stage.drop_off_rate.toFixed(1)}% drop-off at ${stage.name} stage`,
        target_funnel_stage: stage.name,
        hypothesis: {
          belief: `Users are abandoning at ${stage.name} due to unclear next step or unexpected friction`,
          expected_outcome: `Increase ${stage.name} conversion by 25%`,
          success_metric: `${stage.name}_conversion_rate`,
          minimum_detectable_effect: '25% relative improvement',
        },
        effort: 'medium',
        expected_impact: {
          metric: `${stage.name}_conversion_rate`,
          lift_percentage: 25,
          confidence: stage.drop_off_rate > 60 ? 'high' : 'medium',
        },
        variants: [
          { name: 'control', description: 'Current experience', traffic_percentage: 50 },
          { name: 'improved', description: 'Reduced friction + clearer CTA', traffic_percentage: 50 },
        ],
        required_sample_size: Math.ceil(stage.unique_users * 0.3),
        estimated_duration_days: 14,
        evidence,
        prerequisites: [`${stage.name} event tracking`, 'Variant assignment system'],
        risks: ['May require UI redesign', 'Users may be price-sensitive, not friction-sensitive'],
      };

      proposals.push(ExperimentProposalSchema.parse(proposal));
    }
  }

  return proposals;
}

/**
 * Check if proposal meets confidence threshold
 */
function meetsConfidenceThreshold(
  proposal: ExperimentProposal,
  minConfidence: 'low' | 'medium' | 'high'
): boolean {
  const confidenceOrder = { low: 1, medium: 2, high: 3 };
  return confidenceOrder[proposal.expected_impact.confidence] >= confidenceOrder[minConfidence];
}

/**
 * Rank proposals by priority score
 */
export function rankProposals(proposals: ExperimentProposal[]): ExperimentProposal[] {
  return proposals
    .map((p) => ({
      proposal: p,
      score: calculatePriorityScore(p),
    }))
    .sort((a, b) => b.score - a.score)
    .map((r) => r.proposal);
}

/**
 * Calculate priority score for a proposal
 */
function calculatePriorityScore(proposal: ExperimentProposal): number {
  // Higher is better
  const effortScore = { low: 3, medium: 2, high: 1 }[proposal.effort];
  const confidenceScore = { low: 1, medium: 2, high: 3 }[proposal.expected_impact.confidence];
  const impactScore = proposal.expected_impact.lift_percentage / 10;
  
  // Duration penalty (shorter is better)
  const durationScore = Math.max(0, 30 - proposal.estimated_duration_days) / 10;

  return effortScore * 2 + confidenceScore * 3 + impactScore * 2 + durationScore;
}
