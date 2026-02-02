import { describe, it, expect } from 'vitest';
import {
  proposeExperiments,
  rankProposals,
} from '../src/experiments/index.js';
import type { ProposerConfig } from '../src/experiments/index.js';
import type { FunnelMetrics, TenantContext } from '../src/contracts/index.js';

describe('Experiment Proposer', () => {
  const tenantContext: TenantContext = {
    tenant_id: 'test-tenant',
    project_id: 'test-project',
  };

  describe('Propose experiments', () => {
    it('outputs stable structure for same input', () => {
      const metrics: FunnelMetrics = {
        tenant_context: tenantContext,
        computed_at: new Date().toISOString(),
        funnel_name: 'Signup Funnel',
        stages: [
          {
            name: 'landing_page',
            event_name: 'page_view',
            unique_users: 1000,
            total_events: 1000,
            conversion_rate_from_previous: null,
            conversion_rate_from_start: 100,
            avg_time_to_convert_seconds: null,
            drop_off_count: 0,
            drop_off_rate: 0,
          },
          {
            name: 'signup',
            event_name: 'signup_start',
            unique_users: 500,
            total_events: 500,
            conversion_rate_from_previous: 50,
            conversion_rate_from_start: 50,
            avg_time_to_convert_seconds: 120,
            drop_off_count: 500,
            drop_off_rate: 50,
          },
          {
            name: 'activation',
            event_name: 'activation',
            unique_users: 250,
            total_events: 250,
            conversion_rate_from_previous: 50,
            conversion_rate_from_start: 25,
            avg_time_to_convert_seconds: 300,
            drop_off_count: 250,
            drop_off_rate: 50,
          },
        ],
        overall_conversion_rate: 25,
        total_users_entered: 1000,
        total_users_completed: 250,
        biggest_drop_off_stage: 'signup',
        biggest_drop_off_rate: 50,
        time_window: {
          start: '2024-01-01T00:00:00Z',
          end: '2024-01-02T00:00:00Z',
        },
        evidence: [],
      };

      const config: ProposerConfig = {
tenant_context: tenantContext,
        max_proposals: 3,
      };

      const result1 = proposeExperiments(metrics, config);
      const result2 = proposeExperiments(metrics, config);

      // Should have same structure
      expect(result1.length).toBe(result2.length);
      result1.forEach((proposal, idx) => {
        const proposal2 = result2[idx];
        expect(proposal.type).toBe(proposal2?.type);
        expect(proposal.effort).toBe(proposal2?.effort);
        expect(proposal.target_funnel_stage).toBe(proposal2?.target_funnel_stage);
        expect(proposal.variants.length).toBe(proposal2?.variants.length);
      });
    });

    it('proposes experiments for steep drop-offs', () => {
      const metrics: FunnelMetrics = {
        tenant_context: tenantContext,
        computed_at: new Date().toISOString(),
        funnel_name: 'Signup Funnel',
        stages: [
          {
            name: 'landing_page',
            event_name: 'page_view',
            unique_users: 1000,
            total_events: 1000,
            conversion_rate_from_previous: null,
            conversion_rate_from_start: 100,
            avg_time_to_convert_seconds: null,
            drop_off_count: 0,
            drop_off_rate: 0,
          },
          {
            name: 'signup',
            event_name: 'signup_start',
            unique_users: 300,
            total_events: 300,
            conversion_rate_from_previous: 30,
            conversion_rate_from_start: 30,
            avg_time_to_convert_seconds: 120,
            drop_off_count: 700,
            drop_off_rate: 70,
          },
        ],
        overall_conversion_rate: 30,
        total_users_entered: 1000,
        total_users_completed: 300,
        biggest_drop_off_stage: 'signup',
        biggest_drop_off_rate: 70,
        time_window: {
          start: '2024-01-01T00:00:00Z',
          end: '2024-01-02T00:00:00Z',
        },
        evidence: [],
      };

      const config: ProposerConfig = {
tenant_context: tenantContext,
        max_proposals: 5,
      };

      const proposals = proposeExperiments(metrics, config);

      expect(proposals.length).toBeGreaterThan(0);
      
      // Should include proposals targeting the drop-off stage
      const dropoffProposals = proposals.filter(
        (p) => p.target_funnel_stage === 'signup'
      );
      expect(dropoffProposals.length).toBeGreaterThan(0);
    });

    it('includes all required fields in proposals', () => {
      const metrics: FunnelMetrics = {
        tenant_context: tenantContext,
        computed_at: new Date().toISOString(),
        funnel_name: 'Test Funnel',
        stages: [
          {
            name: 'step1',
            event_name: 'event1',
            unique_users: 100,
            total_events: 100,
            conversion_rate_from_previous: null,
            conversion_rate_from_start: 100,
            avg_time_to_convert_seconds: null,
            drop_off_count: 0,
            drop_off_rate: 0,
          },
          {
            name: 'step2',
            event_name: 'event2',
            unique_users: 50,
            total_events: 50,
            conversion_rate_from_previous: 50,
            conversion_rate_from_start: 50,
            avg_time_to_convert_seconds: 60,
            drop_off_count: 50,
            drop_off_rate: 50,
          },
        ],
        overall_conversion_rate: 50,
        total_users_entered: 100,
        total_users_completed: 50,
        biggest_drop_off_stage: 'step2',
        biggest_drop_off_rate: 50,
        time_window: {
          start: '2024-01-01T00:00:00Z',
          end: '2024-01-02T00:00:00Z',
        },
        evidence: [],
      };

      const config: ProposerConfig = {
tenant_context: tenantContext,
        max_proposals: 3,
      };

      const proposals = proposeExperiments(metrics, config);

      proposals.forEach((proposal) => {
        // Required fields
        expect(proposal.proposal_id).toBeDefined();
        expect(proposal.tenant_context).toEqual(tenantContext);
        expect(proposal.created_at).toBeDefined();
        expect(proposal.name).toBeDefined();
        expect(proposal.description).toBeDefined();
        expect(proposal.type).toBeDefined();
        expect(proposal.hypothesis).toBeDefined();
        expect(proposal.hypothesis.belief).toBeDefined();
        expect(proposal.hypothesis.expected_outcome).toBeDefined();
        expect(proposal.hypothesis.success_metric).toBeDefined();
        expect(proposal.hypothesis.minimum_detectable_effect).toBeDefined();
        expect(proposal.effort).toBeDefined();
        expect(proposal.expected_impact).toBeDefined();
        expect(proposal.expected_impact.metric).toBeDefined();
        expect(proposal.expected_impact.lift_percentage).toBeGreaterThan(0);
        expect(proposal.expected_impact.confidence).toBeDefined();
        expect(proposal.variants).toBeDefined();
        expect(proposal.variants.length).toBeGreaterThan(0);
        expect(proposal.required_sample_size).toBeGreaterThan(0);
        expect(proposal.estimated_duration_days).toBeGreaterThan(0);
        expect(proposal.evidence).toBeDefined();
        expect(proposal.prerequisites).toBeDefined();
        expect(proposal.risks).toBeDefined();
      });
    });

    it('proposes low-effort experiments for quick wins', () => {
      const metrics: FunnelMetrics = {
        tenant_context: tenantContext,
        computed_at: new Date().toISOString(),
        funnel_name: 'Test Funnel',
        stages: [
          {
            name: 'landing_page',
            event_name: 'page_view',
            unique_users: 1000,
            total_events: 1000,
            conversion_rate_from_previous: null,
            conversion_rate_from_start: 100,
            avg_time_to_convert_seconds: null,
            drop_off_count: 0,
            drop_off_rate: 0,
          },
          {
            name: 'signup',
            event_name: 'signup_start',
            unique_users: 300,
            total_events: 300,
            conversion_rate_from_previous: 30,
            conversion_rate_from_start: 30,
            avg_time_to_convert_seconds: 120,
            drop_off_count: 700,
            drop_off_rate: 70,
          },
        ],
        overall_conversion_rate: 30,
        total_users_entered: 1000,
        total_users_completed: 300,
        biggest_drop_off_stage: 'signup',
        biggest_drop_off_rate: 70,
        time_window: {
          start: '2024-01-01T00:00:00Z',
          end: '2024-01-02T00:00:00Z',
        },
        evidence: [],
      };

      const config: ProposerConfig = {
tenant_context: tenantContext,
        max_proposals: 5,
      };

      const proposals = proposeExperiments(metrics, config);

      // Should include at least one low-effort experiment
      const lowEffort = proposals.filter((p) => p.effort === 'low');
      expect(lowEffort.length).toBeGreaterThan(0);
    });

    it('respects max_proposals limit', () => {
      const metrics: FunnelMetrics = {
        tenant_context: tenantContext,
        computed_at: new Date().toISOString(),
        funnel_name: 'Test Funnel',
        stages: [
          {
            name: 'step1',
            event_name: 'event1',
            unique_users: 100,
            total_events: 100,
            conversion_rate_from_previous: null,
            conversion_rate_from_start: 100,
            avg_time_to_convert_seconds: null,
            drop_off_count: 0,
            drop_off_rate: 0,
          },
          {
            name: 'step2',
            event_name: 'event2',
            unique_users: 50,
            total_events: 50,
            conversion_rate_from_previous: 50,
            conversion_rate_from_start: 50,
            avg_time_to_convert_seconds: 60,
            drop_off_count: 50,
            drop_off_rate: 50,
          },
        ],
        overall_conversion_rate: 50,
        total_users_entered: 100,
        total_users_completed: 50,
        biggest_drop_off_stage: 'step2',
        biggest_drop_off_rate: 50,
        time_window: {
          start: '2024-01-01T00:00:00Z',
          end: '2024-01-02T00:00:00Z',
        },
        evidence: [],
      };

      const config: ProposerConfig = {
tenant_context: tenantContext,
        max_proposals: 2,
      };

      const proposals = proposeExperiments(metrics, config);

      expect(proposals.length).toBeLessThanOrEqual(2);
    });

    it('includes variants with traffic percentages', () => {
      const metrics: FunnelMetrics = {
        tenant_context: tenantContext,
        computed_at: new Date().toISOString(),
        funnel_name: 'Test Funnel',
        stages: [
          {
            name: 'step1',
            event_name: 'event1',
            unique_users: 100,
            total_events: 100,
            conversion_rate_from_previous: null,
            conversion_rate_from_start: 100,
            avg_time_to_convert_seconds: null,
            drop_off_count: 0,
            drop_off_rate: 0,
          },
          {
            name: 'step2',
            event_name: 'event2',
            unique_users: 50,
            total_events: 50,
            conversion_rate_from_previous: 50,
            conversion_rate_from_start: 50,
            avg_time_to_convert_seconds: 60,
            drop_off_count: 50,
            drop_off_rate: 50,
          },
        ],
        overall_conversion_rate: 50,
        total_users_entered: 100,
        total_users_completed: 50,
        biggest_drop_off_stage: 'step2',
        biggest_drop_off_rate: 50,
        time_window: {
          start: '2024-01-01T00:00:00Z',
          end: '2024-01-02T00:00:00Z',
        },
        evidence: [],
      };

      const config: ProposerConfig = {
tenant_context: tenantContext,
        max_proposals: 3,
      };

      const proposals = proposeExperiments(metrics, config);

      proposals.forEach((proposal) => {
        proposal.variants.forEach((variant) => {
          expect(variant.name).toBeDefined();
          expect(variant.description).toBeDefined();
          expect(variant.traffic_percentage).toBeGreaterThan(0);
          expect(variant.traffic_percentage).toBeLessThanOrEqual(100);
        });

        // Traffic should roughly add up to 100
        const totalTraffic = proposal.variants.reduce(
          (sum, v) => sum + v.traffic_percentage,
          0
        );
        expect(totalTraffic).toBe(100);
      });
    });
  });

  describe('Rank proposals', () => {
    it('sorts proposals by priority score', () => {
      const proposals = [
        {
          proposal_id: '1',
          tenant_context: tenantContext,
          created_at: new Date().toISOString(),
          type: 'ab_test' as const,
          name: 'Low effort, high impact',
          description: 'Test',
          target_funnel_stage: 'landing',
          hypothesis: {
            belief: 'Test',
            expected_outcome: 'Test',
            success_metric: 'test',
            minimum_detectable_effect: '10%',
          },
          effort: 'low' as const,
          expected_impact: {
            metric: 'test',
            lift_percentage: 20,
            confidence: 'high' as const,
          },
          variants: [{ name: 'control', description: 'Current', traffic_percentage: 50 }],
          required_sample_size: 100,
          estimated_duration_days: 7,
          evidence: [],
          prerequisites: [],
          risks: [],
        },
        {
          proposal_id: '2',
          tenant_context: tenantContext,
          created_at: new Date().toISOString(),
          type: 'ab_test' as const,
          name: 'High effort, low impact',
          description: 'Test',
          target_funnel_stage: 'signup',
          hypothesis: {
            belief: 'Test',
            expected_outcome: 'Test',
            success_metric: 'test',
            minimum_detectable_effect: '5%',
          },
          effort: 'high' as const,
          expected_impact: {
            metric: 'test',
            lift_percentage: 5,
            confidence: 'low' as const,
          },
          variants: [{ name: 'control', description: 'Current', traffic_percentage: 50 }],
          required_sample_size: 500,
          estimated_duration_days: 30,
          evidence: [],
          prerequisites: [],
          risks: [],
        },
      ];

      const ranked = rankProposals(proposals);

      // Low effort, high impact should come first
      expect(ranked[0]?.name).toBe('Low effort, high impact');
      expect(ranked[1]?.name).toBe('High effort, low impact');
    });
  });
});
