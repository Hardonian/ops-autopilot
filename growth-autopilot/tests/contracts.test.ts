import { describe, it, expect } from 'vitest';
import {
  TenantContextSchema,
  SEOFindingsSchema,
  FunnelMetricsSchema,
  ExperimentProposalSchema,
  ContentDraftSchema,
  JobForgeRequestSchema,
  ProfileSchema,
} from '../src/contracts/index.js';

describe('Contracts', () => {
  describe('TenantContextSchema', () => {
    it('validates valid tenant context', () => {
      const valid = {
        tenant_id: 'tenant-123',
        project_id: 'project-456',
      };
      expect(() => TenantContextSchema.parse(valid)).not.toThrow();
    });

    it('rejects missing tenant_id', () => {
      const invalid = {
        project_id: 'project-456',
      };
      expect(() => TenantContextSchema.parse(invalid)).toThrow();
    });

    it('rejects missing project_id', () => {
      const invalid = {
        tenant_id: 'tenant-123',
      };
      expect(() => TenantContextSchema.parse(invalid)).toThrow();
    });

    it('rejects empty tenant_id', () => {
      const invalid = {
        tenant_id: '',
        project_id: 'project-456',
      };
      expect(() => TenantContextSchema.parse(invalid)).toThrow();
    });
  });

  describe('SEOFindingsSchema', () => {
    it('validates complete SEO findings', () => {
      const valid = {
        tenant_context: { tenant_id: 't1', project_id: 'p1' },
        scanned_at: new Date().toISOString(),
        source_type: 'html_export',
        source_path: '/path/to/export',
        health_score: {
          overall: 85,
          categories: { meta_tags: 90 },
          total_pages: 10,
          issues_by_severity: {
            critical: 0,
            warning: 2,
            info: 5,
            opportunity: 3,
          },
        },
        issues: [
          {
            type: 'missing_meta_description',
            page: '/about',
            severity: 'warning',
            message: 'Missing meta description',
            evidence: {
              signal: 'missing_tag',
              location: '/about',
              severity: 'warning',
            },
            recommendation: 'Add a meta description',
          },
        ],
        summary: {
          total_pages: 10,
          total_issues: 1,
          actionable_items: 1,
          opportunities: ['Add meta descriptions'],
        },
      };
      expect(() => SEOFindingsSchema.parse(valid)).not.toThrow();
    });
  });

  describe('FunnelMetricsSchema', () => {
    it('validates complete funnel metrics', () => {
      const valid = {
        tenant_context: { tenant_id: 't1', project_id: 'p1' },
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
        ],
        overall_conversion_rate: 50,
        total_users_entered: 1000,
        total_users_completed: 500,
        biggest_drop_off_stage: 'signup',
        biggest_drop_off_rate: 50,
        time_window: {
          start: new Date().toISOString(),
          end: new Date().toISOString(),
        },
        evidence: [
          {
            signal: 'dropoff_detected',
            location: 'stage:signup',
            severity: 'critical',
            raw_value: 50,
          },
        ],
      };
      expect(() => FunnelMetricsSchema.parse(valid)).not.toThrow();
    });
  });

  describe('ExperimentProposalSchema', () => {
    it('validates complete experiment proposal', () => {
      const valid = {
        tenant_context: { tenant_id: 't1', project_id: 'p1' },
        proposal_id: 'exp-123',
        created_at: new Date().toISOString(),
        type: 'ab_test',
        name: 'Landing Page Test',
        description: 'Test new headline',
        target_funnel_stage: 'landing_page',
        hypothesis: {
          belief: 'Users will convert better with benefit-focused headline',
          expected_outcome: 'Increase conversion by 15%',
          success_metric: 'signup_conversion_rate',
          minimum_detectable_effect: '15% relative improvement',
        },
        effort: 'low',
        expected_impact: {
          metric: 'signup_conversion_rate',
          lift_percentage: 15,
          confidence: 'medium',
        },
        variants: [
          { name: 'control', description: 'Current headline', traffic_percentage: 50 },
          { name: 'test', description: 'New headline', traffic_percentage: 50 },
        ],
        required_sample_size: 1000,
        estimated_duration_days: 14,
        evidence: [
          {
            signal: 'conversion_drop',
            location: 'funnel:landing_page',
            severity: 'warning',
          },
        ],
        prerequisites: ['Analytics tracking'],
        risks: ['Low traffic volume'],
      };
      expect(() => ExperimentProposalSchema.parse(valid)).not.toThrow();
    });
  });

  describe('ContentDraftSchema', () => {
    it('validates complete content draft', () => {
      const valid = {
        tenant_context: { tenant_id: 't1', project_id: 'p1' },
        draft_id: 'draft-123',
        created_at: new Date().toISOString(),
        content_type: 'landing_page',
        target_audience: 'Developers',
        goal: 'Increase signups',
        profile_used: 'base',
        llm_provider: null,
        llm_model: null,
        variants: [
          {
            name: 'variant-1',
            headline: 'Build faster with our platform',
            body: 'Our platform helps you ship code faster...',
            cta: 'Get Started',
            meta_description: 'Build faster with our developer platform',
            seo_keywords: ['developer tools', 'productivity'],
          },
        ],
        recommended_variant: 'variant-1',
        evidence: [
          {
            signal: 'template_generation',
            location: 'type:landing_page',
            severity: 'info',
          },
        ],
        suggested_experiments: ['Test headline variations'],
        constraints_respected: {
          prohibited_claims_checked: true,
          brand_voice_matched: true,
          character_limits_met: true,
        },
      };
      expect(() => ContentDraftSchema.parse(valid)).not.toThrow();
    });
  });

  describe('JobForgeRequestSchema', () => {
    it('validates complete job request', () => {
      const valid = {
        job_type: 'autopilot.growth.seo_scan',
        tenant_context: { tenant_id: 't1', project_id: 'p1' },
        priority: 'normal',
        requested_at: new Date().toISOString(),
        payload: { summary: 'test' },
        evidence_links: [
          { type: 'finding', id: 'f1', description: 'Test finding' },
        ],
        estimated_cost_credits: 10,
        expires_at: new Date().toISOString(),
      };
      expect(() => JobForgeRequestSchema.parse(valid)).not.toThrow();
    });
  });

  describe('ProfileSchema', () => {
    it('validates complete profile', () => {
      const valid = {
        id: 'test-profile',
        name: 'Test Profile',
        description: 'A test profile',
        icp: {
          title: 'Developer',
          company_size: '10-100',
          pain_points: ['Slow builds'],
          goals: ['Fast CI/CD'],
        },
        voice: {
          tone: 'technical',
          style_notes: ['Be concise'],
          vocabulary: {
            preferred: ['fast', 'reliable'],
            avoid: ['slow', 'unstable'],
          },
        },
        keywords: {
          primary: ['ci', 'cd'],
          secondary: ['automation'],
          negative: ['manual'],
        },
        prohibited_claims: ['100% guarantee'],
        features: [
          {
            name: 'Fast Builds',
            description: 'Builds run in parallel',
            benefit: 'Ship code faster',
          },
        ],
      };
      expect(() => ProfileSchema.parse(valid)).not.toThrow();
    });
  });
});
