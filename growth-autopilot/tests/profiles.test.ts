import { describe, it, expect } from 'vitest';
import {
  getProfile,
  listProfiles,
  extendProfile,
  validateProfile,
  baseProfile,
  jobforgeProfile,
  settlerProfile,
  readylayerProfile,
  aiasProfile,
  keysProfile,
} from '../src/profiles/index.js';

describe('Profiles', () => {
  describe('Get profile', () => {
    it('returns base profile', () => {
      const profile = getProfile('base');
      expect(profile.id).toBe('base');
      expect(profile.name).toBe('Base Profile');
    });

    it('returns jobforge profile', () => {
      const profile = getProfile('jobforge');
      expect(profile.id).toBe('jobforge');
      expect(profile.name).toBe('JobForge');
    });

    it('returns settler profile', () => {
      const profile = getProfile('settler');
      expect(profile.id).toBe('settler');
      expect(profile.name).toBe('Settler');
    });

    it('returns readylayer profile', () => {
      const profile = getProfile('readylayer');
      expect(profile.id).toBe('readylayer');
      expect(profile.name).toBe('Readylayer');
    });

    it('returns aias profile', () => {
      const profile = getProfile('aias');
      expect(profile.id).toBe('aias');
      expect(profile.name).toBe('AIAS');
    });

    it('returns keys profile', () => {
      const profile = getProfile('keys');
      expect(profile.id).toBe('keys');
      expect(profile.name).toBe('Keys');
    });

    it('throws on unknown profile', () => {
      expect(() => getProfile('unknown')).toThrow('Profile not found: unknown');
    });
  });

  describe('List profiles', () => {
    it('returns all available profiles', () => {
      const profiles = listProfiles();
      expect(profiles).toContain('base');
      expect(profiles).toContain('jobforge');
      expect(profiles).toContain('settler');
      expect(profiles).toContain('readylayer');
      expect(profiles).toContain('aias');
      expect(profiles).toContain('keys');
    });

    it('returns 6 profiles', () => {
      const profiles = listProfiles();
      expect(profiles.length).toBe(6);
    });
  });

  describe('Extend profile', () => {
    it('extends base profile with overrides', () => {
      const extended = extendProfile('base', {
        name: 'Custom Base',
        description: 'Custom description',
      });

      expect(extended.id).toBe('base');
      expect(extended.name).toBe('Custom Base');
      expect(extended.description).toBe('Custom description');
      // Should keep original features
      expect(extended.features.length).toBeGreaterThan(0);
    });

    it('preserves nested properties when extending', () => {
      const extended = extendProfile('base', {
        icp: {
          title: 'Custom Title',
          company_size: 'Custom Size',
          pain_points: ['Custom pain'],
          goals: ['Custom goal'],
        },
      });

      expect(extended.icp.title).toBe('Custom Title');
      expect(extended.icp.company_size).toBe('Custom Size');
    });

    it('validates extended profile', () => {
      expect(() =>
        extendProfile('base', {
          name: 'Valid Extension',
        })
      ).not.toThrow();
    });
  });

  describe('Validate profile', () => {
    it('validates correct profile', () => {
      const result = validateProfile(baseProfile);
      expect(result.valid).toBe(true);
    });

    it('rejects profile with missing fields', () => {
      const invalid = {
        id: 'invalid',
        name: 'Invalid',
        // Missing other required fields
      };

      const result = validateProfile(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('rejects profile with wrong types', () => {
      const invalid = {
        id: 'invalid',
        name: 'Invalid',
        description: 'Test',
        icp: 'not an object', // Should be object
        voice: {},
        keywords: {},
        prohibited_claims: [],
        features: [],
      };

      const result = validateProfile(invalid);
      expect(result.valid).toBe(false);
    });
  });

  describe('Built-in profiles structure', () => {
    it('base profile has all required sections', () => {
      expect(baseProfile.icp.pain_points.length).toBeGreaterThan(0);
      expect(baseProfile.icp.goals.length).toBeGreaterThan(0);
      expect(baseProfile.voice.style_notes.length).toBeGreaterThan(0);
      expect(baseProfile.voice.vocabulary.preferred.length).toBeGreaterThan(0);
      expect(baseProfile.keywords.primary.length).toBeGreaterThan(0);
      expect(baseProfile.prohibited_claims.length).toBeGreaterThan(0);
      expect(baseProfile.features.length).toBeGreaterThan(0);
    });

    it('jobforge profile has technical focus', () => {
      expect(jobforgeProfile.voice.tone).toBe('technical');
      expect(jobforgeProfile.keywords.primary).toContain('job orchestration');
    });

    it('settler profile has friendly tone', () => {
      expect(settlerProfile.voice.tone).toBe('friendly');
      expect(settlerProfile.keywords.primary).toContain('habit tracking');
    });

    it('readylayer profile has technical focus', () => {
      expect(readylayerProfile.voice.tone).toBe('technical');
      expect(readylayerProfile.keywords.primary).toContain('environment management');
    });

    it('aias profile has technical focus', () => {
      expect(aiasProfile.voice.tone).toBe('technical');
      expect(aiasProfile.keywords.primary).toContain('AI agents');
    });

    it('keys profile has professional tone', () => {
      expect(keysProfile.voice.tone).toBe('professional');
      expect(keysProfile.keywords.primary).toContain('secrets management');
    });
  });
});
