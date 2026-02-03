import { describe, it, expect } from 'vitest';
import {
  getOpsProfile,
  listOpsProfiles,
  createOpsBaseProfile,
  createJobforgeOpsProfile,
  getOpsThreshold,
  checkOpsThreshold,
} from '../src/profiles/index.js';

describe('Ops Profiles', () => {
  describe('getOpsProfile', () => {
    it('should return base ops profile', () => {
      const profile = getOpsProfile('ops-base');
      expect(profile).toBeDefined();
      expect(profile?.id).toBe('base-ops-base');
      expect(profile?.metadata.module).toBe('ops');
    });

    it('should return jobforge ops profile', () => {
      const profile = getOpsProfile('ops-jobforge');
      expect(profile).toBeDefined();
      expect(profile?.config.thresholds.error_rate_spike.critical).toBe(3.0);
    });

    it('should return settler ops profile', () => {
      const profile = getOpsProfile('ops-settler');
      expect(profile).toBeDefined();
      expect(profile?.config.thresholds.payment_failure_rate.warning).toBe(0.08);
    });

    it('should return undefined for unknown profile', () => {
      const profile = getOpsProfile('unknown');
      expect(profile).toBeUndefined();
    });

    it('should support short profile names', () => {
      const base = getOpsProfile('base');
      const jobforge = getOpsProfile('jobforge');

      expect(base).toBeDefined();
      expect(jobforge).toBeDefined();
    });
  });

  describe('listOpsProfiles', () => {
    it('should return all ops profiles', () => {
      const profiles = listOpsProfiles();
      expect(profiles.length).toBeGreaterThan(0);

      const ids = profiles.map(p => p.id);
      expect(ids).toContain('base-ops-base');
    });
  });

  describe('createOpsBaseProfile', () => {
    it('should create base ops profile', () => {
      const profile = createOpsBaseProfile();
      expect(profile.metadata.module).toBe('ops');
      expect(profile.config.thresholds.alert_correlation_window_minutes).toBeDefined();
    });
  });

  describe('createJobforgeOpsProfile', () => {
    it('should create jobforge ops profile with stricter thresholds', () => {
      const profile = createJobforgeOpsProfile();
      const baseProfile = createOpsBaseProfile();

      // JobForge should have stricter error rate thresholds
      expect(profile.config.thresholds.error_rate_spike.critical).toBeLessThanOrEqual(
        baseProfile.config.thresholds.error_rate_spike.critical
      );
    });
  });

  describe('getOpsThreshold', () => {
    it('should return threshold value', () => {
      const profile = createOpsBaseProfile();
      const threshold = getOpsThreshold(profile, 'error_rate_spike', 'warning');

      expect(threshold).toBe(2.0);
    });

    it('should return undefined for unknown metric', () => {
      const profile = createOpsBaseProfile();
      const threshold = getOpsThreshold(profile, 'unknown_metric' as any, 'warning');

      expect(threshold).toBeUndefined();
    });
  });

  describe('checkOpsThreshold', () => {
    it('should detect critical threshold breach', () => {
      const profile = createOpsBaseProfile();
      const result = checkOpsThreshold(profile, 'error_rate_spike', 6.0);

      expect(result.exceeded).toBe(true);
      expect(result.level).toBe('critical');
    });

    it('should detect warning threshold breach', () => {
      const profile = createOpsBaseProfile();
      const result = checkOpsThreshold(profile, 'error_rate_spike', 3.0);

      expect(result.exceeded).toBe(true);
      expect(result.level).toBe('warning');
    });

    it('should not flag value below threshold', () => {
      const profile = createOpsBaseProfile();
      const result = checkOpsThreshold(profile, 'error_rate_spike', 1.0);

      expect(result.exceeded).toBe(false);
      expect(result.level).toBeUndefined();
    });

    it('should handle unknown metrics gracefully', () => {
      const profile = createOpsBaseProfile();
      const result = checkOpsThreshold(profile, 'unknown_metric' as any, 100);

      expect(result.exceeded).toBe(false);
    });
  });

  describe('Profile Features', () => {
    it('should have ops-specific features', () => {
      const profile = createOpsBaseProfile();

      expect(profile.config.features.enable_alert_correlation).toBe(true);
      expect(profile.config.features.enable_runbook_generation).toBe(true);
      expect(profile.config.features.enable_anomaly_detection).toBe(true);
    });

    it('should have custom configuration', () => {
      const profile = createOpsBaseProfile();

      expect(profile.config.custom.default_time_window_hours).toBeDefined();
      expect(profile.config.custom.max_alerts_per_correlation).toBeDefined();
      expect(profile.config.custom.runbook_max_steps).toBeDefined();
    });
  });
});
