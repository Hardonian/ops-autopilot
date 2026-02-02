import type {
  ContentDraft,
  ContentType,
  ContentVariant,
  TenantContext,
  Evidence,
  Profile,
} from '../contracts/index.js';
import { ContentDraftSchema } from '../contracts/index.js';
import { generateId, now } from '../utils/index.js';

/**
 * Content drafter configuration
 */
export interface DrafterConfig {
  tenant_context: TenantContext;
  content_type: ContentType;
  target_audience: string;
  goal: string;
  profile: Profile;
  llm_provider?: string;
  llm_model?: string;
  variants_count?: number;
  constraints?: {
    max_headline_length?: number;
    max_body_length?: number;
    max_cta_length?: number;
    prohibited_phrases?: string[];
    required_phrases?: string[];
  };
}

/**
 * Template library for deterministic content generation
 * Works without LLM using pattern matching and templates
 */
const CONTENT_TEMPLATES: Record<
  ContentType,
  Array<{
    headline_pattern: string;
    body_template: string;
    cta_options: string[];
    seo_keywords: string[];
  }>
> = {
  landing_page: [
    {
      headline_pattern: '{benefit} for {audience}',
      body_template: '{icp_pain_point}? {product_name} helps you {solution}. {social_proof} {features_benefits}',
      cta_options: ['Start Free Trial', 'Get Started', 'Try It Free', 'See How It Works'],
      seo_keywords: ['software', 'saas', 'solution', 'platform'],
    },
    {
      headline_pattern: 'The {adjective} way to {action}',
      body_template: 'Stop {negative_action}. With {product_name}, you can {positive_action} in {timeframe}. {trust_signal}',
      cta_options: ['Get Started Now', 'Try for Free', 'See Pricing', 'Book a Demo'],
      seo_keywords: ['tool', 'solution', 'easy', 'fast'],
    },
  ],
  onboarding_email: [
    {
      headline_pattern: 'Welcome to {product_name}!',
      body_template: "Hi {first_name},\n\nThanks for joining {product_name}! I'm {founder_name}, and I wanted to personally welcome you.\n\nTo get started, {first_action}.\n\n{tip_content}\n\nIf you have any questions, just reply to this email.\n\n{signoff}",
      cta_options: ['Get Started', 'Complete Setup', 'Watch Tutorial', 'Explore Features'],
      seo_keywords: ['welcome', 'getting started', 'onboarding'],
    },
    {
      headline_pattern: 'Your first step with {product_name}',
      body_template: "Hey {first_name},\n\nYou're in! Now let's make sure you get the most out of {product_name}.\n\nMost successful users start by {recommended_action}.\n\nHere's why: {benefit_explanation}\n\n{cta}\n\nBest,\n{founder_name}",
      cta_options: ['Take First Step', 'Setup Account', 'Create First Project'],
      seo_keywords: ['tutorial', 'guide', 'first steps'],
    },
  ],
  changelog_note: [
    {
      headline_pattern: '{feature_name}: {brief_benefit}',
      body_template: "We've just shipped {feature_name} - {feature_description}.\n\n{benefit_details}\n\n{how_to_use}\n\n{feedback_request}",
      cta_options: ['Try It Now', 'Learn More', 'See Documentation', 'Give Feedback'],
      seo_keywords: ['update', 'new feature', 'release'],
    },
    {
      headline_pattern: 'New: {feature_name}',
      body_template: "{feature_name} is now live! {one_line_description}.\n\nKey highlights:\n- {highlight_1}\n- {highlight_2}\n- {highlight_3}\n\n{cta}",
      cta_options: ['Check It Out', 'Read the Docs', 'See Examples'],
      seo_keywords: ['update', 'feature', 'improvement'],
    },
  ],
  blog_post: [
    {
      headline_pattern: 'How to {action} with {product_name}',
      body_template: "{intro_problem}\n\n## The Challenge\n{challenge_description}\n\n## The Solution\n{solution_description}\n\n## Step-by-Step\n{step_by_step}\n\n## Results\n{results}\n\n{cta}",
      cta_options: ['Try {product_name}', 'Start Free Trial', 'Learn More'],
      seo_keywords: ['how to', 'tutorial', 'guide'],
    },
  ],
  social_post: [
    {
      headline_pattern: '{announcement}',
      body_template: "{hook}\n\n{main_point}\n\n{engagement_question}\n\n{hashtags}",
      cta_options: ['Learn more', 'Check it out', 'Try it'],
      seo_keywords: ['new', 'launch', 'update'],
    },
  ],
  ad_copy: [
    {
      headline_pattern: '{benefit} - {timeframe}',
      body_template: "{pain_point}? {solution_statement}. {social_proof}. {risk_reversal}",
      cta_options: ['Sign Up Free', 'Get Started', 'Try Now'],
      seo_keywords: ['free', 'easy', 'fast'],
    },
    {
      headline_pattern: '{question}?',
      body_template: "{problem_agitation}. {solution_intro}. {key_benefits}. {urgency}",
      cta_options: ['Yes, I Want This', 'Get Access', 'Try Free'],
      seo_keywords: ['solution', 'fix', 'improve'],
    },
  ],
  help_article: [
    {
      headline_pattern: 'How to {action}',
      body_template: "## Overview\n{overview}\n\n## Steps\n{numbered_steps}\n\n## FAQ\n{faq_section}\n\n## Related\n{related_links}",
      cta_options: ['Contact Support', 'Was this helpful?', 'Read More'],
      seo_keywords: ['help', 'support', 'how to'],
    },
  ],
};

/**
 * Draft content variants
 * Can work with or without LLM
 */
export function draftContent(config: DrafterConfig): ContentDraft {
  const { profile, content_type } = config;
  const variantsCount = config.variants_count ?? 3;

  // Get templates for content type
  const templates = CONTENT_TEMPLATES[content_type] ?? CONTENT_TEMPLATES.blog_post;

  // Generate variants using templates
  const variants: ContentVariant[] = [];

  for (let i = 0; i < Math.min(variantsCount, templates.length); i++) {
    const template = templates[i % templates.length];
    const variant = generateVariantFromTemplate(template, config, i);
    variants.push(variant);
  }

  // If LLM is configured, we would enhance variants here
  // For now, we use template-based generation only
  const llmProvider = config.llm_provider ?? null;
  const llmModel = config.llm_model ?? null;

  // Check constraints
  const constraintsRespected = validateConstraints(variants, config.constraints ?? {}, profile);

  // Build evidence
  const evidence: Evidence[] = [
    {
      signal: 'template_generation',
      location: `type:${content_type}`,
      severity: 'info',
      raw_value: {
        templates_used: templates.length,
        variants_generated: variants.length,
        llm_enhanced: llmProvider !== null,
      },
    },
    {
      signal: 'profile_applied',
      location: `profile:${profile.id}`,
      severity: 'info',
      raw_value: profile.id,
    },
  ];

  // Recommend best variant (simple heuristic for now)
  const recommendedVariant = variants[0]?.name ?? 'variant-1';

  // Suggest experiments
  const suggestedExperiments = generateContentExperiments(content_type, variants);

  const draft: ContentDraft = {
    tenant_context: config.tenant_context,
    draft_id: generateId('draft'),
    created_at: now(),
    content_type,
    target_audience: config.target_audience,
    goal: config.goal,
    profile_used: profile.id,
    llm_provider: llmProvider,
    llm_model: llmModel,
    variants,
    recommended_variant: recommendedVariant,
    evidence,
    suggested_experiments: suggestedExperiments,
    constraints_respected: constraintsRespected,
  };

  return ContentDraftSchema.parse(draft);
}

/**
 * Generate a content variant from a template
 */
function generateVariantFromTemplate(
  template: (typeof CONTENT_TEMPLATES)[ContentType][0],
  config: DrafterConfig,
  index: number
): ContentVariant {
  const { profile, goal, target_audience } = config;

  // Replace placeholders in headline
  let headline = template.headline_pattern
    .replace('{benefit}', profile.features[0]?.benefit ?? 'Save time')
    .replace('{audience}', target_audience)
    .replace('{action}', goal.toLowerCase())
    .replace('{adjective}', 'easiest')
    .replace('{product_name}', profile.name)
    .replace('{feature_name}', profile.features[0]?.name ?? 'New Feature')
    .replace('{brief_benefit}', profile.features[0]?.benefit ?? 'Get more done')
    .replace('{announcement}', `Just launched: ${profile.features[0]?.name ?? 'New Feature'}`)
    .replace('{question}', profile.icp.pain_points[0] ?? 'Struggling with workflow')
    .replace('{timeframe}', 'in minutes');

  // Replace placeholders in body
  let body = template.body_template
    .replace('{icp_pain_point}', profile.icp.pain_points[0] ?? 'Tired of manual work')
    .replace('{product_name}', profile.name)
    .replace('{solution}', profile.features[0]?.benefit ?? 'automate your workflow')
    .replace('{social_proof}', 'Join thousands of satisfied users')
    .replace('{features_benefits}', profile.features.map((f) => `${f.name}: ${f.benefit}`).join('. '))
    .replace('{negative_action}', 'wasting time')
    .replace('{positive_action}', goal.toLowerCase())
    .replace('{trust_signal}', 'Trusted by leading companies')
    .replace('{first_name}', '{{first_name}}')
    .replace('{founder_name}', 'The Team')
    .replace('{first_action}', 'set up your first project')
    .replace('{tip_content}', `Pro tip: ${profile.features[1]?.description ?? 'Use templates to speed up your workflow'}`)
    .replace('{signoff}', 'Cheers!')
    .replace('{recommended_action}', 'creating their first automation')
    .replace('{benefit_explanation}', profile.features[0]?.benefit ?? 'it saves hours of manual work')
    .replace('{feature_description}', profile.features[0]?.description ?? 'a powerful new capability')
    .replace('{benefit_details}', profile.features[0]?.benefit ?? 'Save time and reduce errors')
    .replace('{how_to_use}', `Go to Dashboard > ${profile.features[0]?.name ?? 'Features'} to try it out`)
    .replace('{feedback_request}', 'What do you think? Reply and let us know!')
    .replace('{one_line_description}', profile.features[0]?.description ?? 'now available')
    .replace('{highlight_1}', profile.features[0]?.benefit ?? 'Faster performance')
    .replace('{highlight_2}', profile.features[1]?.benefit ?? 'Better UX')
    .replace('{highlight_3}', profile.features[2]?.benefit ?? 'More integrations')
    .replace('{intro_problem}', profile.icp.pain_points[0] ?? 'Managing complex workflows is hard')
    .replace('{challenge_description}', 'Most teams struggle with coordination and manual handoffs')
    .replace('{solution_description}', `${profile.name} provides a unified platform for your workflow`)
    .replace('{step_by_step}', '1. Sign up\n2. Connect your tools\n3. Start automating')
    .replace('{results}', `Teams using ${profile.name} report 50% time savings`)
    .replace('{hook}', `🚀 ${profile.name} just got better!`)
    .replace('{main_point}', profile.features[0]?.description ?? 'New capabilities now available')
    .replace('{engagement_question}', 'What feature would you like to see next?')
    .replace('{hashtags}', '#productivity #automation #saas')
    .replace('{pain_point}', profile.icp.pain_points[0] ?? 'Manual work')
    .replace('{solution_statement}', `${profile.name} automates it for you`)
    .replace('{risk_reversal}', 'Free forever plan available')
    .replace('{problem_agitation}', `Still ${profile.icp.pain_points[0] ?? 'working manually'}?`)
    .replace('{solution_intro}', `Try ${profile.name}`)
    .replace('{key_benefits}', profile.features.slice(0, 3).map((f) => f.benefit).join('. '))
    .replace('{urgency}', 'Limited time: 20% off annual plans')
    .replace('{overview}', `This guide shows you how to ${goal.toLowerCase()} using ${profile.name}`)
    .replace('{numbered_steps}', 'Step 1: Navigate to Settings\nStep 2: Select your preferences\nStep 3: Save changes')
    .replace('{faq_section}', 'Q: Is this available on all plans?\nA: Yes, this feature is available to all users.')
    .replace('{related_links}', profile.features.map((f) => `- ${f.name}: ${f.description}`).join('\n'));

  // Select CTA
  const cta = template.cta_options[index % template.cta_options.length] ?? 'Get Started';

  // Generate meta description
  const metaDescription = `${profile.name} - ${profile.features[0]?.benefit ?? 'The solution you need'}. ${profile.description.slice(0, 100)}`;

  // Combine with profile keywords
  const seoKeywords = [...template.seo_keywords, ...profile.keywords.primary].slice(0, 5);

  return {
    name: `variant-${index + 1}`,
    headline,
    body,
    cta,
    meta_description: metaDescription,
    seo_keywords: seoKeywords,
  };
}

/**
 * Validate that content meets constraints
 */
function validateConstraints(
  variants: ContentVariant[],
  constraints: {
    max_headline_length?: number;
    max_body_length?: number;
    max_cta_length?: number;
    prohibited_phrases?: string[];
    required_phrases?: string[];
  },
  profile: Profile
): {
  prohibited_claims_checked: boolean;
  brand_voice_matched: boolean;
  character_limits_met: boolean;
} {
  const prohibitedPhrases = constraints.prohibited_phrases ?? profile.prohibited_claims;
  const requiredPhrases = constraints.required_phrases ?? [];

  let prohibitedClaimsChecked = true;
  let brandVoiceMatched = true;
  let characterLimitsMet = true;

  for (const variant of variants) {
    // Check prohibited phrases
    const content = `${variant.headline} ${variant.body} ${variant.cta}`.toLowerCase();
    for (const phrase of prohibitedPhrases) {
      if (content.includes(phrase.toLowerCase())) {
        prohibitedClaimsChecked = false;
      }
    }

    // Check required phrases
    for (const phrase of requiredPhrases) {
      if (!content.includes(phrase.toLowerCase())) {
        brandVoiceMatched = false;
      }
    }

    // Check character limits
    if (constraints.max_headline_length && variant.headline.length > constraints.max_headline_length) {
      characterLimitsMet = false;
    }
    if (constraints.max_body_length && variant.body.length > constraints.max_body_length) {
      characterLimitsMet = false;
    }
    if (constraints.max_cta_length && variant.cta.length > constraints.max_cta_length) {
      characterLimitsMet = false;
    }
  }

  return {
    prohibited_claims_checked: prohibitedClaimsChecked,
    brand_voice_matched: brandVoiceMatched,
    character_limits_met: characterLimitsMet,
  };
}

/**
 * Generate suggested experiments for content
 */
function generateContentExperiments(
  contentType: ContentType,
  variants: ContentVariant[]
): string[] {
  const experiments: string[] = [];

  if (variants.length >= 2) {
    experiments.push(`A/B test: ${variants[0].headline} vs ${variants[1].headline}`);
  }

  if (contentType === 'landing_page') {
    experiments.push('Test headline vs subheadline impact on bounce rate');
    experiments.push('Test CTA button color and copy variations');
  }

  if (contentType === 'onboarding_email') {
    experiments.push('Test send time (immediate vs 1-hour delay)');
    experiments.push('Test personalization level (name vs no name)');
  }

  if (contentType === 'ad_copy') {
    experiments.push('Test benefit-focused vs fear-focused messaging');
    experiments.push('Test social proof placement (beginning vs end)');
  }

  return experiments;
}

/**
 * Enhance content with LLM (placeholder for future implementation)
 */
export async function enhanceWithLLM(
  draft: ContentDraft,
  provider: string,
  model: string
): Promise<ContentDraft> {
  // This is a placeholder for LLM enhancement
  // In production, this would call the LLM API
  console.log(`Enhancing content with ${provider}/${model}...`);

  // Return original draft (enhancement not implemented)
  return draft;
}
