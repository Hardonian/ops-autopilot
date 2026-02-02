import { z } from 'zod';
import { IdentifierSchema, JSONValueSchema } from './core.js';

/**
 * Profile schemas for app-specific configuration
 * 
 * Profiles define the "personality" and constraints for content generation
 * and recommendations per application (Settler, AIAS, Keys, ReadyLayer, JobForge).
 */

/** Voice tone enumeration */
export const VoiceToneSchema = z.enum([
  'professional',
  'friendly',
  'technical',
  'casual',
  'bold',
  'empathetic',
]);

export type VoiceTone = z.infer<typeof VoiceToneSchema>;

/** Ideal Customer Profile (ICP) */
export const ICPSchema = z.object({
  /** Job title or role */
  title: z.string(),
  
  /** Company size range */
  company_size: z.string(),
  
  /** Pain points this persona experiences */
  pain_points: z.array(z.string()),
  
  /** Goals and objectives */
  goals: z.array(z.string()),
  
  /** Industries (optional) */
  industries: z.array(z.string()).optional(),
  
  /** Seniority level (optional) */
  seniority: z.enum(['individual', 'manager', 'director', 'executive']).optional(),
});

export type ICP = z.infer<typeof ICPSchema>;

/** Voice configuration */
export const VoiceSchema = z.object({
  /** Primary tone */
  tone: VoiceToneSchema,
  
  /** Style guidelines */
  style_notes: z.array(z.string()),
  
  /** Vocabulary preferences */
  vocabulary: z.object({
    preferred: z.array(z.string()),
    avoid: z.array(z.string()),
  }),
  
  /** Example phrases (optional) */
  examples: z.array(z.string()).optional(),
});

export type Voice = z.infer<typeof VoiceSchema>;

/** Keywords configuration */
export const KeywordsSchema = z.object({
  /** Primary keywords */
  primary: z.array(z.string()),
  
  /** Secondary keywords */
  secondary: z.array(z.string()),
  
  /** Negative keywords to avoid */
  negative: z.array(z.string()),
  
  /** SEO target phrases (optional) */
  seo_targets: z.array(z.string()).optional(),
});

export type Keywords = z.infer<typeof KeywordsSchema>;

/** Feature description */
export const FeatureSchema = z.object({
  /** Feature name */
  name: z.string(),
  
  /** Feature description */
  description: z.string(),
  
  /** Key benefit */
  benefit: z.string(),
  
  /** Use cases (optional) */
  use_cases: z.array(z.string()).optional(),
});

export type Feature = z.infer<typeof FeatureSchema>;

/** Complete profile schema */
export const ProfileSchema = z.object({
  /** Unique profile identifier */
  id: IdentifierSchema,
  
  /** Display name */
  name: z.string(),
  
  /** Description */
  description: z.string(),
  
  /** Ideal Customer Profile */
  icp: ICPSchema,
  
  /** Voice and tone */
  voice: VoiceSchema,
  
  /** Keywords */
  keywords: KeywordsSchema,
  
  /** Prohibited claims (legal/compliance) */
  prohibited_claims: z.array(z.string()),
  
  /** Key features */
  features: z.array(FeatureSchema),
  
  /** Additional metadata */
  metadata: z.record(z.string(), JSONValueSchema).optional(),
});

export type Profile = z.infer<typeof ProfileSchema>;

/** Profile registry */
export const ProfileRegistrySchema = z.object({
  version: z.string(),
  profiles: z.record(z.string(), ProfileSchema),
});

export type ProfileRegistry = z.infer<typeof ProfileRegistrySchema>;

/**
 * Validate a profile
 * @param profile - Unknown profile data
 * @returns Validation result
 */
export function validateProfile(profile: unknown): {
  valid: boolean;
  profile?: Profile;
  errors?: string[];
} {
  const result = ProfileSchema.safeParse(profile);
  
  if (result.success) {
    return { valid: true, profile: result.data };
  } else {
    return {
      valid: false,
      errors: result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
    };
  }
}

/**
 * Extend a base profile with overrides
 * @param base - Base profile
 * @param overrides - Partial profile to override
 * @returns Extended profile
 */
export function extendProfile(base: Profile, overrides: Partial<Profile>): Profile {
  const extended = {
    ...base,
    ...overrides,
    // Deep merge for nested objects
    icp: { ...base.icp, ...overrides.icp },
    voice: {
      ...base.voice,
      ...overrides.voice,
      vocabulary: {
        preferred: [
          ...base.voice.vocabulary.preferred,
          ...(overrides.voice?.vocabulary?.preferred ?? []),
        ],
        avoid: [
          ...base.voice.vocabulary.avoid,
          ...(overrides.voice?.vocabulary?.avoid ?? []),
        ],
      },
    },
    keywords: {
      primary: [...base.keywords.primary, ...(overrides.keywords?.primary ?? [])],
      secondary: [...base.keywords.secondary, ...(overrides.keywords?.secondary ?? [])],
      negative: [...base.keywords.negative, ...(overrides.keywords?.negative ?? [])],
    },
    features: overrides.features ?? base.features,
    prohibited_claims: [...base.prohibited_claims, ...(overrides.prohibited_claims ?? [])],
  };
  
  return ProfileSchema.parse(extended);
}