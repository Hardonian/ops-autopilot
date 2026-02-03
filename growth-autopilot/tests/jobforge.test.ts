import { describe, it, expect } from 'vitest';
import {
  createSEOScanJob,
  createExperimentJob,
  createContentDraftJob,
  validateJobRequest,
  batchJobRequests,
} from '../src/jobforge/index.js';
import { proposeExperiments } from '../src/experiments/index.js';
import { draftContent } from '../src/content/index.js';
import { getProfile } from '../src/profiles/index.js';
import type { TenantContext, SEOFindings, FunnelMetrics } from '../src/contracts/index.js';
import type { ProposerConfig } from '../src/experiments/index.js';
import type { DrafterConfig } from '../src/content/index.js';

describe('JobForge Integration', () => {
  const tenantContext: TenantContext = {
    tenant_id: 'test-tenant',
    project_id: 'test-project',
  };

  describe('Create SEO scan job', () => {
    it('creates valid SEO scan job request', () => {
      const findings: SEOFindings = {
        tenant_context: tenantContext,
        scanned_at: new Date().toISOString(),
        source_type: 'html_export',
        source_path: '/test/export',
        health_score: {
          overall: 75,
          categories: {},
          total_pages: 10,
          issues_by_severity: {
            critical: 1,
            warning: 3,
            info: 5,
            opportunity: 2,
          },
        },
        issues: [
          {
            type: 'missing_title',
            page: '/about',
            severity: 'critical',
            message: 'Missing title',
            evidence: {
              signal: 'missing_tag',
              location: '/about',
              severity: 'critical',
            },
            recommendation: 'Add title',
          },
        ],
        summary: {
          total_pages: 10,
          total_issues: 1,
          actionable_items: 1,
          opportunities: ['Fix titles'],
        },
      };

      const config = { tenant_context: tenantContext };
      const job = createSEOScanJob(findings, config);

      expect(job.job_type).toBe('autopilot.growth.seo_scan');
      expect(job.tenant_context).toEqual(tenantContext);
      expect(job.priority).toBe('normal');
      expect(job.payload.findings_summary).toBeDefined();
      expect(job.evidence_links.length).toBeGreaterThan(0);
      expect(job.cost_estimate?.credits).toBeGreaterThan(0);
      expect(job.expires_at).toBeDefined();
      expect(job.policy.requires_policy_token).toBe(true);
      expect(job.policy.requires_approval).toBe(true);
    });

    it('includes correct job type', () => {
      const findings: SEOFindings = {
        tenant_context: tenantContext,
        scanned_at: new Date().toISOString(),
        source_type: 'html_export',
        source_path: '/test',
        health_score: {
          overall: 100,
          categories: {},
          total_pages: 1,
          issues_by_severity: { critical: 0, warning: 0, info: 0, opportunity: 0 },
        },
        issues: [],
        summary: {
          total_pages: 1,
          total_issues: 0,
          actionable_items: 0,
          opportunities: [],
        },
      };

      const config = { tenant_context: tenantContext };
      const job = createSEOScanJob(findings, config);

      expect(job.job_type).toBe('autopilot.growth.seo_scan');
    });
  });

  describe('Create experiment job', () => {
    it('creates valid experiment job request', () => {
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

      const proposerConfig: ProposerConfig = {
        tenant_context: tenantContext,
        max_proposals: 2,
      };

      const proposals = proposeExperiments(metrics, proposerConfig);
      const config = { tenant_context: tenantContext };
      const job = createExperimentJob(proposals, metrics, config);

      expect(job.job_type).toBe('autopilot.growth.experiment_propose');
      expect(job.payload.funnel_name).toBe('Test Funnel');
      expect(job.payload.proposals_count).toBeGreaterThan(0);
      expect(job.payload.proposals_summary).toBeDefined();
      expect(job.evidence_links.length).toBeGreaterThan(0);
      expect(job.policy.requires_policy_token).toBe(true);
      expect(job.policy.requires_approval).toBe(true);
    });

    it('includes proposal summaries in payload', () => {
      const metrics: FunnelMetrics = {
        tenant_context: tenantContext,
        computed_at: new Date().toISOString(),
        funnel_name: 'Test',
        stages: [
          {
            name: 'landing',
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

      const proposerConfig: ProposerConfig = {
        tenant_context: tenantContext,
        max_proposals: 3,
      };

      const proposals = proposeExperiments(metrics, proposerConfig);
      const config = { tenant_context: tenantContext };
      const job = createExperimentJob(proposals, metrics, config);

      expect(job.payload.proposals_summary.length).toBeGreaterThan(0);
      job.payload.proposals_summary.forEach((summary: { id: string; name: string; type: string; effort: string }) => {
        expect(summary.id).toBeDefined();
        expect(summary.name).toBeDefined();
        expect(summary.type).toBeDefined();
        expect(summary.effort).toBeDefined();
      });
    });
  });

  describe('Create content draft job', () => {
    it('creates valid content job request', () => {
      const profile = getProfile('base');
      const config: DrafterConfig = {
        tenant_context: tenantContext,
        content_type: 'landing_page',
        target_audience: 'Developers',
        goal: 'Increase signups',
        profile,
      };

      const draft = draftContent(config);
      const jobConfig = { tenant_context: tenantContext };
      const job = createContentDraftJob(draft, jobConfig);

      expect(job.job_type).toBe('autopilot.growth.content_draft');
      expect(job.payload.content_type).toBe('landing_page');
      expect(job.payload.variants_count).toBeGreaterThan(0);
      expect(job.evidence_links.length).toBeGreaterThan(0);
      expect(job.policy.requires_policy_token).toBe(true);
      expect(job.policy.requires_approval).toBe(true);
    });

    it('indicates if content was LLM-enhanced', () => {
      const profile = getProfile('base');
      const config: DrafterConfig = {
        tenant_context: tenantContext,
        content_type: 'landing_page',
        target_audience: 'Developers',
        goal: 'Increase signups',
        profile,
      };

      const draft = draftContent(config);
      const jobConfig = { tenant_context: tenantContext };
      const job = createContentDraftJob(draft, jobConfig);

      expect(job.payload.llm_enhanced).toBe(false);
    });
  });

  describe('Validate job requests', () => {
    it('validates correct SEO job', () => {
      const validJob = {
        job_type: 'autopilot.growth.seo_scan',
        tenant_context: tenantContext,
        priority: 'normal',
        requested_at: new Date().toISOString(),
        payload: {},
        evidence_links: [],
      };

      const result = validateJobRequest(validJob);
      expect(result.valid).toBe(true);
    });

    it('rejects job with missing tenant_context', () => {
      const invalidJob = {
        job_type: 'autopilot.growth.seo_scan',
        priority: 'normal',
        requested_at: new Date().toISOString(),
        payload: {},
        evidence_links: [],
      };

      const result = validateJobRequest(invalidJob);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('rejects job with invalid priority', () => {
      const invalidJob = {
        job_type: 'autopilot.growth.seo_scan',
        tenant_context: tenantContext,
        priority: 'invalid',
        requested_at: new Date().toISOString(),
        payload: {},
        evidence_links: [],
      };

      const result = validateJobRequest(invalidJob);
      expect(result.valid).toBe(false);
    });
  });

  describe('Batch job requests', () => {
    it('batches multiple jobs', () => {
      const job1 = createSEOScanJob(
        {
          tenant_context: tenantContext,
          scanned_at: new Date().toISOString(),
          source_type: 'html_export',
          source_path: '/test',
          health_score: {
            overall: 80,
            categories: {},
            total_pages: 1,
            issues_by_severity: { critical: 0, warning: 0, info: 0, opportunity: 0 },
          },
          issues: [],
          summary: {
            total_pages: 1,
            total_issues: 0,
            actionable_items: 0,
            opportunities: [],
          },
        },
        { tenant_context: tenantContext }
      );

      const job2 = createContentDraftJob(
        draftContent({
          tenant_context: tenantContext,
          content_type: 'landing_page',
          target_audience: 'Test',
          goal: 'Test',
          profile: getProfile('base'),
        }),
        { tenant_context: tenantContext }
      );

      const batch = batchJobRequests([job1, job2]);

      expect(batch.batch_id).toBeDefined();
      expect(batch.requests.length).toBe(2);
      expect(batch.total_cost?.credits).toBeGreaterThan(0);
    });

    it('calculates total cost correctly', () => {
      const job1 = createSEOScanJob(
        {
          tenant_context: tenantContext,
          scanned_at: new Date().toISOString(),
          source_type: 'html_export',
          source_path: '/test',
          health_score: {
            overall: 80,
            categories: {},
            total_pages: 1,
            issues_by_severity: { critical: 0, warning: 0, info: 0, opportunity: 0 },
          },
          issues: [],
          summary: {
            total_pages: 1,
            total_issues: 0,
            actionable_items: 0,
            opportunities: [],
          },
        },
        { tenant_context: tenantContext }
      );

      const job2 = createSEOScanJob(
        {
          tenant_context: tenantContext,
          scanned_at: new Date().toISOString(),
          source_type: 'html_export',
          source_path: '/test2',
          health_score: {
            overall: 80,
            categories: {},
            total_pages: 1,
            issues_by_severity: { critical: 0, warning: 0, info: 0, opportunity: 0 },
          },
          issues: [],
          summary: {
            total_pages: 1,
            total_issues: 0,
            actionable_items: 0,
            opportunities: [],
          },
        },
        { tenant_context: tenantContext }
      );

      const batch = batchJobRequests([job1, job2]);

      expect(batch.total_cost?.credits).toBe(
        (job1.cost_estimate?.credits ?? 0) + (job2.cost_estimate?.credits ?? 0)
      );
    });
  });
});
