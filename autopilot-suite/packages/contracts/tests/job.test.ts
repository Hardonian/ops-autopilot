import { describe, it, expect } from 'vitest';
import {
  JobRequestSchema,
  createJobRequest,
  batchJobRequests,
  serializeJobRequest,
  JobTypeSchema,
} from '../src/job.js';

describe('JobRequest', () => {
  const validTenantContext = {
    tenant_id: 'tenant-123',
    project_id: 'project-456',
  };
  
  describe('schema validation', () => {
    it('should accept valid job request', () => {
      const request = {
        version: '1.0.0',
        job_type: 'autopilot.growth.seo_scan',
        tenant_context: validTenantContext,
        priority: 'normal',
        requested_at: new Date().toISOString(),
        payload: { url: 'https://example.com' },
        evidence_links: [],
        policy: { requires_policy_token: true },
        metadata: {},
      };
      
      const result = JobRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });
    
    it('should require policy token by default', () => {
      const request = {
        version: '1.0.0',
        job_type: 'autopilot.growth.seo_scan',
        tenant_context: validTenantContext,
        priority: 'normal',
        requested_at: new Date().toISOString(),
        payload: {},
        evidence_links: [],
        metadata: {},
      };
      
      const result = JobRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.policy.requires_policy_token).toBe(true);
      }
    });
    
    it('should reject invalid job type', () => {
      const request = {
        version: '1.0.0',
        job_type: 'invalid.job.type',
        tenant_context: validTenantContext,
        priority: 'normal',
        requested_at: new Date().toISOString(),
        payload: {},
        evidence_links: [],
        metadata: {},
      };
      
      const result = JobRequestSchema.safeParse(request);
      expect(result.success).toBe(false);
    });
  });
  
  describe('createJobRequest', () => {
    it('should create valid job request', () => {
      const request = createJobRequest(
        'autopilot.growth.seo_scan',
        validTenantContext,
        { url: 'https://example.com' }
      );
      
      expect(request.job_type).toBe('autopilot.growth.seo_scan');
      expect(request.tenant_context).toEqual(validTenantContext);
      expect(request.payload).toEqual({ url: 'https://example.com' });
      expect(request.policy.requires_policy_token).toBe(true);
    });
    
    it('should include evidence links when provided', () => {
      const evidence = [
        { type: 'finding', id: 'f-1', description: 'Test finding' },
      ];
      
      const request = createJobRequest(
        'autopilot.growth.seo_scan',
        validTenantContext,
        {},
        { evidence_links: evidence }
      );
      
      expect(request.evidence_links).toEqual(evidence);
    });
  });
  
  describe('batchJobRequests', () => {
    it('should batch requests with same tenant', () => {
      const requests = [
        createJobRequest('autopilot.growth.seo_scan', validTenantContext, {}),
        createJobRequest('autopilot.growth.content_draft', validTenantContext, {}),
      ];
      
      const batch = batchJobRequests(requests);
      
      expect(batch.requests).toHaveLength(2);
      expect(batch.tenant_context).toEqual(validTenantContext);
      expect(batch.batch_id).toBeDefined();
    });
    
    it('should reject empty batch', () => {
      expect(() => batchJobRequests([])).toThrow('Cannot create empty batch');
    });
    
    it('should reject requests with different tenants', () => {
      const requests = [
        createJobRequest('autopilot.growth.seo_scan', validTenantContext, {}),
        createJobRequest(
          'autopilot.growth.content_draft',
          { tenant_id: 'other', project_id: 'project' },
          {}
        ),
      ];
      
      expect(() => batchJobRequests(requests)).toThrow('same tenant_context');
    });
  });
  
  describe('serializeJobRequest', () => {
    it('should produce valid JSON', () => {
      const request = createJobRequest(
        'autopilot.growth.seo_scan',
        validTenantContext,
        { test: true }
      );
      
      const json = serializeJobRequest(request);
      const parsed = JSON.parse(json);
      
      expect(parsed.job_type).toBe('autopilot.growth.seo_scan');
      expect(parsed.payload).toEqual({ test: true });
    });
    
    it('should pretty-print JSON', () => {
      const request = createJobRequest(
        'autopilot.growth.seo_scan',
        validTenantContext,
        {}
      );
      
      const json = serializeJobRequest(request);
      expect(json).toContain('\n');
      expect(json).toContain('  ');
    });
  });
  
  describe('JobTypeSchema', () => {
    it('should include all autopilot job types', () => {
      const validTypes = [
        'autopilot.growth.seo_scan',
        'autopilot.growth.experiment_propose',
        'autopilot.growth.content_draft',
        'autopilot.ops.health_check',
        'autopilot.support.ticket_classify',
        'autopilot.finops.cost_optimize',
      ];
      
      for (const type of validTypes) {
        const result = JobTypeSchema.safeParse(type);
        expect(result.success).toBe(true);
      }
    });
  });
});