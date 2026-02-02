import { describe, it, expect } from 'vitest';
import {
  profileRegistry,
  getProfile,
  hasProfile,
  listProfiles,
  getAllProfiles,
  createCustomProfile,
  validateCustomProfile,
  getProfilesByCategory,
  getDefaultProfile,
} from '../src/registry.js';

describe('Profile Registry', () => {
  describe('profileRegistry', () => {
    it('should contain all profiles', () => {
      expect(profileRegistry.base).toBeDefined();
      expect(profileRegistry.jobforge).toBeDefined();
      expect(profileRegistry.settler).toBeDefined();
      expect(profileRegistry.readylayer).toBeDefined();
      expect(profileRegistry.aias).toBeDefined();
      expect(profileRegistry.keys).toBeDefined();
    });
  });
  
  describe('getProfile', () => {
    it('should return existing profile', () => {
      const profile = getProfile('base');
      expect(profile.id).toBe('base');
    });
    
    it('should throw for non-existent profile', () => {
      expect(() => getProfile('nonexistent')).toThrow('Profile not found');
    });
  });
  
  describe('hasProfile', () => {
    it('should return true for existing profile', () => {
      expect(hasProfile('base')).toBe(true);
      expect(hasProfile('jobforge')).toBe(true);
    });
    
    it('should return false for non-existent profile', () => {
      expect(hasProfile('nonexistent')).toBe(false);
    });
  });
  
  describe('listProfiles', () => {
    it('should return all profile IDs', () => {
      const ids = listProfiles();
      expect(ids).toContain('base');
      expect(ids).toContain('jobforge');
      expect(ids).toContain('settler');
      expect(ids).toContain('readylayer');
      expect(ids).toContain('aias');
      expect(ids).toContain('keys');
      expect(ids).toHaveLength(6);
    });
  });
  
  describe('getAllProfiles', () => {
    it('should return all profiles', () => {
      const profiles = getAllProfiles();
      expect(profiles).toHaveLength(6);
      expect(profiles.every((p) => p.id && p.name)).toBe(true);
    });
  });
  
  describe('createCustomProfile', () => {
    it('should create custom profile from base', () => {
      const custom = createCustomProfile('base', {
        id: 'custom',
        name: 'Custom Profile',
        description: 'A custom profile',
      });
      
      expect(custom.id).toBe('custom');
      expect(custom.name).toBe('Custom Profile');
      // Should inherit from base
      expect(custom.voice.tone).toBe('professional');
    });
    
    it('should throw for non-existent base', () => {
      expect(() => {
        createCustomProfile('nonexistent', { id: 'custom', name: 'Custom' });
      }).toThrow('Profile not found');
    });
  });
  
  describe('validateCustomProfile', () => {
    it('should validate correct profile', () => {
      const result = validateCustomProfile({
        id: 'test',
        name: 'Test',
        description: 'Test profile',
        icp: {
          title: 'Test',
          company_size: '1-10',
          pain_points: ['test'],
          goals: ['test'],
        },
        voice: {
          tone: 'professional',
          style_notes: ['test'],
          vocabulary: { preferred: [], avoid: [] },
        },
        keywords: {
          primary: ['test'],
          secondary: [],
          negative: [],
        },
        prohibited_claims: [],
        features: [],
      });
      
      expect(result.valid).toBe(true);
    });
    
    it('should invalidate incorrect profile', () => {
      const result = validateCustomProfile({ invalid: true });
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });
  });
  
  describe('getProfilesByCategory', () => {
    it('should filter by category', () => {
      const saasProfiles = getProfilesByCategory('saas');
      expect(saasProfiles.some((p) => p.id === 'base')).toBe(true);
      
      const aiProfiles = getProfilesByCategory('ai');
      expect(aiProfiles.some((p) => p.id === 'aias')).toBe(true);
      expect(aiProfiles).toHaveLength(1);
    });
    
    it('should return empty array for unknown category', () => {
      const profiles = getProfilesByCategory('unknown');
      expect(profiles).toHaveLength(0);
    });
  });
  
  describe('getDefaultProfile', () => {
    it('should return base profile', () => {
      const profile = getDefaultProfile();
      expect(profile.id).toBe('base');
    });
  });
});