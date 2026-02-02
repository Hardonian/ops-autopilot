import { describe, it, expect } from 'vitest';
import {
  validateRequest,
  validateBatch,
  isValidRequest,
  isValidBatch,
} from '../src/validation.js';
import { createJobRequest } from '@autopilot/contracts';

describe('Validation', () => {
  const validTenant = {
    tenant_id: 'tenant-123',
    project_id: 'project-456',
  };
  
  describe('validateRequest', () => {
    it('should validate correct request', () => {
      const request = createJobRequest(
        'autopilot.growth.seo_scan',
        validTenant,
        { url: 'https://example.com' },
        {
          evidence_links: [{ type: 'test', id: '1', description: 'test' }],
          cost_estimate: { credits: 100, confidence: 'high' },
        }
      );
      
      const result = validateRequest(request);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should return errors for invalid schema', () => {
      const result = validateRequest({ invalid: true });
      
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'SCHEMA_VIOLATION')).toBe(true);
    });
    
    it('should warn about missing policy token', () => {
      const request = {
        version: '1.0.0',
        job_type: 'autopilot.growth.seo_scan',
        tenant_context: validTenant,
        priority: 'normal',
        requested_at: new Date().toISOString(),
        payload: {},
        evidence_links: [],
        policy: { requires_policy_token: false },
        metadata: {},
      };
      
      const result = validateRequest(request);
      
      // Still valid, but has warning
      expect(result.valid).toBe(true);
      expect(result.errors.some((e) => e.code === 'POLICY_WARNING')).toBe(true);
    });
    
    it('should error for short expiration', () => {
      const request = createJobRequest(
        'autopilot.growth.seo_scan',
        validTenant,
        {},
        { expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString() } // 30 minutes
      );
      
      const result = validateRequest(request);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'EXPIRATION_ERROR')).toBe(true);
    });
    
    it('should warn about long expiration', () => {
      const request = createJobRequest(
        'autopilot.growth.seo_scan',
        validTenant,
        {},
        { expires_at: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString() } // 10 days
      );
      
      const result = validateRequest(request);
      
      expect(result.valid).toBe(true);
      expect(result.errors.some((e) => e.code === 'EXPIRATION_WARNING')).toBe(true);
    });
  });
  
  describe('validateBatch', () => {
    it('should validate correct batch', () => {
      const requests = [
        createJobRequest('autopilot.growth.seo_scan', validTenant, {}),
        createJobRequest('autopilot.growth.content_draft', validTenant, {}),
      ];
      
      const batch = {
        batch_id: '550e8400-e29b-41d4-a716-446655440000',
        tenant_context: validTenant,
        requests,
        created_at: new Date().toISOString(),
      };
      
      const result = validateBatch(batch);
      
      expect(result.valid).toBe(true);
    });
    
    it('should return errors for invalid batch', () => {
      const result = validateBatch({ invalid: true });
      
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'SCHEMA_VIOLATION')).toBe(true);
    });
  });
  
  describe('isValidRequest', () => {
    it('should return true for valid request', () => {
      const request = createJobRequest(
        'autopilot.growth.seo_scan',
        validTenant,
        {}
      );
      
      expect(isValidRequest(request)).toBe(true);
    });
    
    it('should return false for invalid request', () => {
      expect(isValidRequest({ invalid: true })).toBe(false);
    });
  });
  
  describe('isValidBatch', () => {
    it('should return true for valid batch', () => {
      const batch = {
        batch_id: '550e8400-e29b-41d4-a716-446655440000',
        tenant_context: validTenant,
        requests: [createJobRequest('autopilot.growth.seo_scan', validTenant, {})],
        created_at: new Date().toISOString(),
      };
      
      expect(isValidBatch(batch)).toBe(true);
    });
    
    it('should return false for invalid batch', () => {
      expect(isValidBatch({ invalid: true })).toBe(false);
    });
  });
});