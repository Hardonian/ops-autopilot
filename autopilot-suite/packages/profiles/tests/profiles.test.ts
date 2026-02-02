import { describe, it, expect } from 'vitest';
import { baseProfile, validateBaseProfile } from '../src/base.js';
import {
  jobforgeProfile,
  settlerProfile,
  readylayerProfile,
  aiasProfile,
  keysProfile,
} from '../src/overlays/index.js';

describe('Profiles', () => {
  describe('baseProfile', () => {
    it('should have required fields', () => {
      expect(baseProfile.id).toBe('base');
      expect(baseProfile.name).toBe('Base Profile');
      expect(baseProfile.icp).toBeDefined();
      expect(baseProfile.voice).toBeDefined();
      expect(baseProfile.keywords).toBeDefined();
      expect(baseProfile.prohibited_claims.length).toBeGreaterThan(0);
      expect(baseProfile.features.length).toBeGreaterThan(0);
    });
    
    it('should validate', () => {
      expect(validateBaseProfile()).toBe(true);
    });
  });
  
  describe('jobforgeProfile', () => {
    it('should have technical voice', () => {
      expect(jobforgeProfile.voice.tone).toBe('technical');
      expect(jobforgeProfile.id).toBe('jobforge');
    });
    
    it('should have infrastructure keywords', () => {
      expect(jobforgeProfile.keywords.primary).toContain('job orchestration');
      expect(jobforgeProfile.keywords.primary).toContain('background jobs');
    });
  });
  
  describe('settlerProfile', () => {
    it('should have friendly voice', () => {
      expect(settlerProfile.voice.tone).toBe('friendly');
      expect(settlerProfile.id).toBe('settler');
    });
    
    it('should avoid negative language', () => {
      expect(settlerProfile.voice.vocabulary.avoid).toContain('fail');
      expect(settlerProfile.vocabulary.avoid).toContain('bad');
    });
  });
  
  describe('readylayerProfile', () => {
    it('should have technical voice', () => {
      expect(readylayerProfile.voice.tone).toBe('technical');
      expect(readylayerProfile.id).toBe('readylayer');
    });
    
    it('should have DevOps terminology', () => {
      expect(readylayerProfile.voice.vocabulary.preferred).toContain('immutable');
      expect(readylayerProfile.voice.vocabulary.preferred).toContain('reproducible');
    });
  });
  
  describe('aiasProfile', () => {
    it('should have technical voice', () => {
      expect(aiasProfile.voice.tone).toBe('technical');
      expect(aiasProfile.id).toBe('aias');
    });
    
    it('should avoid anthropomorphic language', () => {
      expect(aiasProfile.voice.vocabulary.avoid).toContain('intelligent');
      expect(aiasProfile.voice.vocabulary.avoid).toContain('smart');
      expect(aiasProfile.voice.vocabulary.avoid).toContain('human-like');
    });
  });
  
  describe('keysProfile', () => {
    it('should have professional voice', () => {
      expect(keysProfile.voice.tone).toBe('professional');
      expect(keysProfile.id).toBe('keys');
    });
    
    it('should have security keywords', () => {
      expect(keysProfile.keywords.primary).toContain('secrets management');
      expect(keysProfile.keywords.primary).toContain('encryption');
    });
  });
});