import { describe, it, expect } from 'vitest';
import {
  analyzeFunnel,
  detectFunnelPatterns,
} from '../src/funnel/index.js';
import type { FunnelEvent, FunnelConfig } from '../src/funnel/index.js';
import type { TenantContext } from '../src/contracts/index.js';

describe('Funnel Analyzer', () => {
  const tenantContext: TenantContext = {
    tenant_id: 'test-tenant',
    project_id: 'test-project',
  };

  describe('Funnel analysis', () => {
    it('calculates correct conversion rates', async () => {
      const events: FunnelEvent[] = [
        // User 1 completes all stages
        { user_id: 'user1', event_name: 'page_view', timestamp: '2024-01-01T00:00:00Z' },
        { user_id: 'user1', event_name: 'signup_start', timestamp: '2024-01-01T00:01:00Z' },
        { user_id: 'user1', event_name: 'activation', timestamp: '2024-01-01T00:05:00Z' },
        // User 2 drops off at signup
        { user_id: 'user2', event_name: 'page_view', timestamp: '2024-01-01T00:00:00Z' },
        // User 3 completes all stages
        { user_id: 'user3', event_name: 'page_view', timestamp: '2024-01-01T00:00:00Z' },
        { user_id: 'user3', event_name: 'signup_start', timestamp: '2024-01-01T00:02:00Z' },
        { user_id: 'user3', event_name: 'activation', timestamp: '2024-01-01T00:06:00Z' },
      ];

      const config: FunnelConfig = {
        tenant_context: tenantContext,
        funnel_name: 'Test Funnel',
        stages: ['page_view', 'signup_start', 'activation'],
      };

      const result = await analyzeFunnel(events, config);

      expect(result.total_users_entered).toBe(3);
      expect(result.total_users_completed).toBe(2);
      expect(result.overall_conversion_rate).toBeCloseTo(66.67, 1);
    });

    it('detects biggest drop-off correctly', async () => {
      const events: FunnelEvent[] = [
        // 10 users enter
        { user_id: 'user1', event_name: 'page_view', timestamp: '2024-01-01T00:00:00Z' },
        { user_id: 'user2', event_name: 'page_view', timestamp: '2024-01-01T00:00:00Z' },
        { user_id: 'user3', event_name: 'page_view', timestamp: '2024-01-01T00:00:00Z' },
        { user_id: 'user4', event_name: 'page_view', timestamp: '2024-01-01T00:00:00Z' },
        { user_id: 'user5', event_name: 'page_view', timestamp: '2024-01-01T00:00:00Z' },
        { user_id: 'user6', event_name: 'page_view', timestamp: '2024-01-01T00:00:00Z' },
        { user_id: 'user7', event_name: 'page_view', timestamp: '2024-01-01T00:00:00Z' },
        { user_id: 'user8', event_name: 'page_view', timestamp: '2024-01-01T00:00:00Z' },
        { user_id: 'user9', event_name: 'page_view', timestamp: '2024-01-01T00:00:00Z' },
        { user_id: 'user10', event_name: 'page_view', timestamp: '2024-01-01T00:00:00Z' },
        // Only 3 convert to signup (70% drop-off)
        { user_id: 'user1', event_name: 'signup_start', timestamp: '2024-01-01T00:01:00Z' },
        { user_id: 'user2', event_name: 'signup_start', timestamp: '2024-01-01T00:01:00Z' },
        { user_id: 'user3', event_name: 'signup_start', timestamp: '2024-01-01T00:01:00Z' },
        // All 3 activate
        { user_id: 'user1', event_name: 'activation', timestamp: '2024-01-01T00:05:00Z' },
        { user_id: 'user2', event_name: 'activation', timestamp: '2024-01-01T00:05:00Z' },
        { user_id: 'user3', event_name: 'activation', timestamp: '2024-01-01T00:05:00Z' },
      ];

      const config: FunnelConfig = {
        tenant_context: tenantContext,
        funnel_name: 'Test Funnel',
        stages: ['page_view', 'signup_start', 'activation'],
      };

      const result = await analyzeFunnel(events, config);

      expect(result.biggest_drop_off_stage).toBe('signup_start');
      expect(result.biggest_drop_off_rate).toBeCloseTo(70, 1);
    });

    it('calculates time to convert correctly', async () => {
      const events: FunnelEvent[] = [
        { user_id: 'user1', event_name: 'page_view', timestamp: '2024-01-01T00:00:00Z' },
        { user_id: 'user1', event_name: 'signup_start', timestamp: '2024-01-01T00:02:00Z' }, // 2 min later
        { user_id: 'user1', event_name: 'activation', timestamp: '2024-01-01T00:05:00Z' }, // 3 min later
      ];

      const config: FunnelConfig = {
        tenant_context: tenantContext,
        funnel_name: 'Test Funnel',
        stages: ['page_view', 'signup_start', 'activation'],
      };

      const result = await analyzeFunnel(events, config);

      const signupStage = result.stages.find((s) => s.name === 'signup_start');
      expect(signupStage?.avg_time_to_convert_seconds).toBe(120); // 2 minutes from page_view

      const activationStage = result.stages.find((s) => s.name === 'activation');
      expect(activationStage?.avg_time_to_convert_seconds).toBe(180); // 3 minutes from signup_start
    });

    it('handles users with multiple events at same stage', async () => {
      const events: FunnelEvent[] = [
        { user_id: 'user1', event_name: 'page_view', timestamp: '2024-01-01T00:00:00Z' },
        { user_id: 'user1', event_name: 'page_view', timestamp: '2024-01-01T00:00:30Z' }, // Duplicate
        { user_id: 'user1', event_name: 'signup_start', timestamp: '2024-01-01T00:01:00Z' },
      ];

      const config: FunnelConfig = {
        tenant_context: tenantContext,
        funnel_name: 'Test Funnel',
        stages: ['page_view', 'signup_start'],
      };

      const result = await analyzeFunnel(events, config);

      expect(result.total_users_entered).toBe(1);
      expect(result.stages[0]?.total_events).toBe(2); // Counts all events
      expect(result.stages[0]?.unique_users).toBe(1); // But only 1 unique user
    });

    it('produces stable output for same input', async () => {
      const events: FunnelEvent[] = [
        { user_id: 'user1', event_name: 'page_view', timestamp: '2024-01-01T00:00:00Z' },
        { user_id: 'user1', event_name: 'signup_start', timestamp: '2024-01-01T00:01:00Z' },
        { user_id: 'user2', event_name: 'page_view', timestamp: '2024-01-01T00:00:00Z' },
      ];

      const config: FunnelConfig = {
        tenant_context: tenantContext,
        funnel_name: 'Test Funnel',
        stages: ['page_view', 'signup_start'],
      };

      const result1 = await analyzeFunnel(events, config);
      const result2 = await analyzeFunnel(events, config);

      expect(result1.total_users_entered).toBe(result2.total_users_entered);
      expect(result1.overall_conversion_rate).toBe(result2.overall_conversion_rate);
      expect(result1.stages.length).toBe(result2.stages.length);
      
      // Stage metrics should match
      result1.stages.forEach((stage1, idx) => {
        const stage2 = result2.stages[idx];
        expect(stage1.unique_users).toBe(stage2?.unique_users);
        expect(stage1.conversion_rate_from_previous).toBe(stage2?.conversion_rate_from_previous);
      });
    });
  });

  describe('Pattern detection', () => {
    it('detects steep drop-offs', () => {
      const metrics = {
        tenant_context: tenantContext,
        computed_at: new Date().toISOString(),
        funnel_name: 'Test',
        stages: [
          {
            name: 'landing',
            event_name: 'page_view',
            unique_users: 100,
            total_events: 100,
            conversion_rate_from_previous: null,
            conversion_rate_from_start: 100,
            avg_time_to_convert_seconds: null,
            drop_off_count: 0,
            drop_off_rate: 0,
          },
          {
            name: 'signup',
            event_name: 'signup_start',
            unique_users: 20,
            total_events: 20,
            conversion_rate_from_previous: 20,
            conversion_rate_from_start: 20,
            avg_time_to_convert_seconds: 120,
            drop_off_count: 80,
            drop_off_rate: 80,
          },
        ],
        overall_conversion_rate: 20,
        total_users_entered: 100,
        total_users_completed: 20,
        biggest_drop_off_stage: 'signup',
        biggest_drop_off_rate: 80,
        time_window: {
          start: '2024-01-01T00:00:00Z',
          end: '2024-01-02T00:00:00Z',
        },
        evidence: [],
      };

      const patterns = detectFunnelPatterns(metrics);

      const steepDropoff = patterns.find((p) => p.pattern === 'steep_dropoff');
      expect(steepDropoff).toBeDefined();
      expect(steepDropoff?.severity).toBe('critical');
    });

    it('detects slow conversions', () => {
      const metrics = {
        tenant_context: tenantContext,
        computed_at: new Date().toISOString(),
        funnel_name: 'Test',
        stages: [
          {
            name: 'landing',
            event_name: 'page_view',
            unique_users: 100,
            total_events: 100,
            conversion_rate_from_previous: null,
            conversion_rate_from_start: 100,
            avg_time_to_convert_seconds: null,
            drop_off_count: 0,
            drop_off_rate: 0,
          },
          {
            name: 'signup',
            event_name: 'signup_start',
            unique_users: 50,
            total_events: 50,
            conversion_rate_from_previous: 50,
            conversion_rate_from_start: 50,
            avg_time_to_convert_seconds: 60, // 1 minute - fast
            drop_off_count: 50,
            drop_off_rate: 50,
          },
          {
            name: 'activation',
            event_name: 'activation',
            unique_users: 25,
            total_events: 25,
            conversion_rate_from_previous: 50,
            conversion_rate_from_start: 25,
            avg_time_to_convert_seconds: 3600, // 60 minutes - very slow
            drop_off_count: 25,
            drop_off_rate: 50,
          },
        ],
        overall_conversion_rate: 25,
        total_users_entered: 100,
        total_users_completed: 25,
        biggest_drop_off_stage: 'signup',
        biggest_drop_off_rate: 50,
        time_window: {
          start: '2024-01-01T00:00:00Z',
          end: '2024-01-02T00:00:00Z',
        },
        evidence: [],
      };

      const patterns = detectFunnelPatterns(metrics);

      const slowConversion = patterns.find((p) => p.pattern === 'slow_conversion');
      expect(slowConversion).toBeDefined();
    });

    it('detects healthy stages', () => {
      const metrics = {
        tenant_context: tenantContext,
        computed_at: new Date().toISOString(),
        funnel_name: 'Test',
        stages: [
          {
            name: 'landing',
            event_name: 'page_view',
            unique_users: 100,
            total_events: 100,
            conversion_rate_from_previous: null,
            conversion_rate_from_start: 100,
            avg_time_to_convert_seconds: null,
            drop_off_count: 0,
            drop_off_rate: 0,
          },
          {
            name: 'signup',
            event_name: 'signup_start',
            unique_users: 90,
            total_events: 90,
            conversion_rate_from_previous: 90,
            conversion_rate_from_start: 90,
            avg_time_to_convert_seconds: 60,
            drop_off_count: 10,
            drop_off_rate: 10,
          },
          {
            name: 'activation',
            event_name: 'activation',
            unique_users: 85,
            total_events: 85,
            conversion_rate_from_previous: 94,
            conversion_rate_from_start: 85,
            avg_time_to_convert_seconds: 120,
            drop_off_count: 5,
            drop_off_rate: 5,
          },
        ],
        overall_conversion_rate: 85,
        total_users_entered: 100,
        total_users_completed: 85,
        biggest_drop_off_stage: 'signup',
        biggest_drop_off_rate: 10,
        time_window: {
          start: '2024-01-01T00:00:00Z',
          end: '2024-01-02T00:00:00Z',
        },
        evidence: [],
      };

      const patterns = detectFunnelPatterns(metrics);

      const healthyStage = patterns.find((p) => p.pattern === 'healthy_conversion');
      expect(healthyStage).toBeDefined();
    });
  });
});
