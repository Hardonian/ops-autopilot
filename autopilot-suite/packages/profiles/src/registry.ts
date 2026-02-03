import { type Profile, validateProfile, extendProfile } from '@autopilot/contracts';
import { baseProfile } from './base.js';
import {
  jobforgeProfile,
  settlerProfile,
  readylayerProfile,
  aiasProfile,
  keysProfile,
} from './index.js';

/**
 * Profile registry - all available profiles
 */
export const profileRegistry: Record<string, Profile> = {
  base: baseProfile,
  jobforge: jobforgeProfile,
  settler: settlerProfile,
  readylayer: readylayerProfile,
  aias: aiasProfile,
  keys: keysProfile,
};

/**
 * Get a profile by ID
 * @param id - Profile identifier
 * @returns Profile
 * @throws Error if profile not found
 */
export function getProfile(id: string): Profile {
  const profile = profileRegistry[id];
  if (!profile) {
    throw new Error(`Profile not found: ${id}`);
  }
  return profile;
}

/**
 * Check if a profile exists
 * @param id - Profile identifier
 * @returns True if profile exists
 */
export function hasProfile(id: string): boolean {
  return id in profileRegistry;
}

/**
 * List all available profile IDs
 * @returns Array of profile IDs
 */
export function listProfiles(): string[] {
  return Object.keys(profileRegistry);
}

/**
 * Get all profiles
 * @returns Array of all profiles
 */
export function getAllProfiles(): Profile[] {
  return Object.values(profileRegistry);
}

/**
 * Create a custom profile by extending a base
 * @param baseId - Base profile ID
 * @param overrides - Profile overrides
 * @returns Extended profile
 */
export function createCustomProfile(
  baseId: string,
  overrides: Partial<Profile>
): Profile {
  const base = getProfile(baseId);
  return extendProfile(base, overrides);
}

/**
 * Validate a profile object
 * @param profile - Profile to validate
 * @returns Validation result
 */
export function validateCustomProfile(profile: unknown): {
  valid: boolean;
  errors?: string[];
} {
  return validateProfile(profile);
}

/**
 * Get profiles by category
 * @param category - Category filter
 * @returns Matching profiles
 */
export function getProfilesByCategory(category: string): Profile[] {
  return Object.values(profileRegistry).filter(
    (p) => p.metadata?.category === category
  );
}

/**
 * Get default profile
 * @returns Base profile
 */
export function getDefaultProfile(): Profile {
  return baseProfile;
}
