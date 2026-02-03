import { describe, it, expect } from 'vitest';
import {
  createAlertCorrelationRequest,
  createRunbookGenerationRequest,
  createReliabilityReportRequest,
  validateJobRequest,
} from '../src/jobforge/index.js';
import type { TenantContext } from '../src/contracts/index.js';

describe('JobForge Request Generation', () => {
  const tenantContext: TenantContext = {
    tenant_id: 'test-tenant',
    project_id: 'test-project',
  };

  describe('createAlertCorrelationRequest', () => {
    it('should create valid alert correlation request', () => {
      const request = createAlertCorrelationRequest(tenantContext, {
        alert_ids: ['alert-1', 'alert-2'],
        time_window_minutes: 10,
        profile_id: 'ops-base',
      });

      expect(request.tenant_context.tenant_id).toBe('test-tenant');
      expect(request.tenant_context.project_id).toBe('test-project');
      expect(request.job_type).toBe('autopilot.ops.alert_correlate');
      expect(request.payload.alert_ids).toHaveLength(2);
    });

    it('should enforce runnerless policy constraints', () => {
      const request = createAlertCorrelationRequest(tenantContext, {
        alert_ids: ['alert-1'],
        profile_id: 'ops-base',
      });

      expect(request.policy.requires_approval).toBe(true);
      expect(request.policy.requires_policy_token).toBe(true);
      expect(request.metadata.runnerless).toBe(true);
    });
  });

  describe('createRunbookGenerationRequest', () => {
    it('should create valid runbook generation request', () => {
      const request = createRunbookGenerationRequest(tenantContext, {
        alert_group_id: 'group-1',
        alert_ids: ['alert-1', 'alert-2'],
        root_cause: 'Resource exhaustion',
        affected_services: ['api-service'],
        severity: 'warning',
        include_rollback: true,
        include_automation: false,
        profile_id: 'ops-base',
      });

      expect(request.job_type).toBe('autopilot.ops.runbook_generate');
      expect(request.payload.alert_ids).toHaveLength(2);
      expect(request.payload.root_cause).toBe('Resource exhaustion');
    });

    it('should enforce runnerless policy constraints', () => {
      const request = createRunbookGenerationRequest(tenantContext, {
        alert_group_id: 'group-1',
        alert_ids: ['alert-1'],
        root_cause: 'Test',
        affected_services: ['svc'],
        severity: 'critical',
        include_rollback: true,
        include_automation: false,
        profile_id: 'ops-base',
      });

      expect(request.policy.requires_approval).toBe(true);
      expect(request.policy.requires_policy_token).toBe(true);
      expect(request.metadata.runnerless).toBe(true);
    });
  });

  describe('createReliabilityReportRequest', () => {
    it('should create valid reliability report request', () => {
      const request = createReliabilityReportRequest(tenantContext, {
        report_type: 'health_check',
        period_start: '2026-01-01T00:00:00Z',
        period_end: '2026-01-31T23:59:59Z',
        include_anomalies: true,
        include_recommendations: true,
        profile_id: 'ops-base',
      });

      expect(request.job_type).toBe('autopilot.ops.reliability_report');
      expect(request.payload.report_type).toBe('health_check');
      expect(request.payload.period_start).toBe('2026-01-01T00:00:00Z');
    });

    it('should support different report types', () => {
      const reportTypes = [
        'incident_postmortem',
        'health_check',
        'trend_analysis',
        'compliance',
      ] as const;

      for (const reportType of reportTypes) {
        const request = createReliabilityReportRequest(tenantContext, {
          report_type: reportType,
          period_start: '2026-01-01T00:00:00Z',
          period_end: '2026-01-31T23:59:59Z',
          include_anomalies: true,
          include_recommendations: true,
          profile_id: 'ops-base',
        });

        expect(request.payload.report_type).toBe(reportType);
      }
    });

    it('should enforce runnerless policy constraints', () => {
      const request = createReliabilityReportRequest(tenantContext, {
        report_type: 'health_check',
        period_start: '2026-01-01T00:00:00Z',
        period_end: '2026-01-31T23:59:59Z',
        include_anomalies: true,
        include_recommendations: true,
        profile_id: 'ops-base',
      });

      expect(request.policy.requires_approval).toBe(true);
      expect(request.policy.requires_policy_token).toBe(true);
      expect(request.metadata.runnerless).toBe(true);
    });
  });

  describe('validateJobRequest', () => {
    it('should validate correct job request', () => {
      const request = createAlertCorrelationRequest(tenantContext, {
        alert_ids: ['alert-1'],
        profile_id: 'ops-base',
      });

      const result = validateJobRequest(request);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid job type', () => {
      const request = {
        version: '1.0.0',
        job_type: 'autopilot.ops.unknown',
        tenant_context: tenantContext,
        priority: 'normal',
        requested_at: new Date().toISOString(),
        payload: {},
        evidence_links: [],
        policy: {
          requires_policy_token: true,
          requires_approval: true,
          risk_level: 'low',
          required_scopes: [],
          compliance_tags: [],
        },
        metadata: {},
      };

      const result = validateJobRequest(request);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});
