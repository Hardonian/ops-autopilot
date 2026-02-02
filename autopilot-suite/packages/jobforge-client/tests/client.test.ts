import { describe, it, expect } from 'vitest';
import { JobForgeClient, createClient } from '../src/client.js';
import {
  buildRequest,
  RequestBuilder,
  QuickBuilders,
} from '../src/builders.js';

describe('JobForgeClient', () => {
  const defaultTenant = {
    tenant_id: 'tenant-123',
    project_id: 'project-456',
  };
  
  describe('createRequest', () => {
    it('should create valid request with tenant context', () => {
      const client = createClient({ defaultTenantContext: defaultTenant });
      
      const request = client.createRequest(
        'autopilot.growth.seo_scan',
        { url: 'https://example.com' }
      );
      
      expect(request.job_type).toBe('autopilot.growth.seo_scan');
      expect(request.tenant_context).toEqual(defaultTenant);
      expect(request.payload).toEqual({ url: 'https://example.com' });
    });
    
    it('should override tenant context from options', () => {
      const client = createClient({ defaultTenantContext: defaultTenant });
      const otherTenant = { tenant_id: 'other', project_id: 'proj' };
      
      const request = client.createRequest(
        'autopilot.growth.seo_scan',
        {},
        { tenantContext: otherTenant }
      );
      
      expect(request.tenant_context).toEqual(otherTenant);
    });
    
    it('should throw without tenant context', () => {
      const client = createClient();
      
      expect(() => {
        client.createRequest('autopilot.growth.seo_scan', {});
      }).toThrow('Tenant context is required');
    });
    
    it('should set expiration from config', () => {
      const client = createClient({
        defaultTenantContext: defaultTenant,
        defaultExpirationHours: 48,
      });
      
      const request = client.createRequest(
        'autopilot.growth.seo_scan',
        {}
      );
      
      expect(request.expires_at).toBeDefined();
      const expiresAt = new Date(request.expires_at!);
      const now = new Date();
      const hoursUntilExpiry = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);
      
      expect(hoursUntilExpiry).toBeGreaterThan(47);
      expect(hoursUntilExpiry).toBeLessThan(49);
    });
  });
  
  describe('batchRequests', () => {
    it('should batch requests', () => {
      const client = createClient({ defaultTenantContext: defaultTenant });
      
      const requests = [
        client.createRequest('autopilot.growth.seo_scan', {}),
        client.createRequest('autopilot.growth.content_draft', {}),
      ];
      
      const batch = client.batchRequests(requests);
      
      expect(batch.requests).toHaveLength(2);
      expect(batch.tenant_context).toEqual(defaultTenant);
      expect(batch.batch_id).toBeDefined();
    });
  });
  
  describe('serialize', () => {
    it('should produce pretty-printed JSON', () => {
      const client = createClient({ defaultTenantContext: defaultTenant });
      const request = client.createRequest('autopilot.growth.seo_scan', {});
      
      const json = client.serialize(request);
      
      expect(json).toContain('\n');
      expect(json).toContain('  ');
      expect(JSON.parse(json).job_type).toBe('autopilot.growth.seo_scan');
    });
  });
  
  describe('validate', () => {
    it('should return valid=true for valid request', () => {
      const client = createClient({ defaultTenantContext: defaultTenant });
      const request = client.createRequest('autopilot.growth.seo_scan', {});
      
      const result = client.validate(request);
      
      expect(result.valid).toBe(true);
    });
    
    it('should return valid=false for invalid request', () => {
      const client = createClient();
      
      const result = client.validate({ invalid: true });
      
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });
  });
});

describe('RequestBuilder', () => {
  describe('buildRequest', () => {
    it('should build request with fluent API', () => {
      const request = buildRequest()
        .forJob('autopilot.growth.seo_scan')
        .forTenant('acme-corp', 'production')
        .withPayload({ url: 'https://example.com' })
        .withPriority('high')
        .withEvidence('finding', 'f-1', 'Missing meta description')
        .withCostEstimate(100, 'high')
        .expiresIn(24)
        .withMetadata('source', 'cli')
        .build();
      
      expect(request.job_type).toBe('autopilot.growth.seo_scan');
      expect(request.tenant_context).toEqual({
        tenant_id: 'acme-corp',
        project_id: 'production',
      });
      expect(request.payload).toEqual({ url: 'https://example.com' });
      expect(request.priority).toBe('high');
      expect(request.evidence_links).toHaveLength(1);
      expect(request.cost_estimate?.credits).toBe(100);
      expect(request.expires_at).toBeDefined();
    });
    
    it('should throw without job type', () => {
      expect(() => {
        buildRequest()
          .forTenant('acme-corp', 'production')
          .build();
      }).toThrow('Job type is required');
    });
    
    it('should throw without tenant', () => {
      expect(() => {
        buildRequest()
          .forJob('autopilot.growth.seo_scan')
          .build();
      }).toThrow('Tenant context is required');
    });
  });
});

describe('QuickBuilders', () => {
  const tenantContext = {
    tenant_id: 'tenant-123',
    project_id: 'project-456',
  };
  
  describe('seoScan', () => {
    it('should create SEO scan request', () => {
      const request = QuickBuilders.seoScan(
        tenantContext,
        'https://example.com',
        { priority: 'high' }
      );
      
      expect(request.job_type).toBe('autopilot.growth.seo_scan');
      expect(request.payload.url).toBe('https://example.com');
      expect(request.priority).toBe('high');
    });
  });
  
  describe('contentDraft', () => {
    it('should create content draft request', () => {
      const request = QuickBuilders.contentDraft(
        tenantContext,
        'landing_page',
        'Increase signups',
        { variants: 5 }
      );
      
      expect(request.job_type).toBe('autopilot.growth.content_draft');
      expect(request.payload.content_type).toBe('landing_page');
      expect(request.payload.variants).toBe(5);
    });
  });
  
  describe('experimentProposal', () => {
    it('should create experiment proposal request', () => {
      const funnelData = { conversion_rate: 0.25 };
      const request = QuickBuilders.experimentProposal(
        tenantContext,
        funnelData,
        { maxProposals: 3 }
      );
      
      expect(request.job_type).toBe('autopilot.growth.experiment_propose');
      expect(request.payload.funnel_data).toEqual(funnelData);
      expect(request.payload.max_proposals).toBe(3);
    });
  });
});