import { describe, it, expect } from 'vitest';
import {
  TenantContextSchema,
  validateTenantContext,
  createTenantContext,
} from '../src/tenant.js';

describe('TenantContext', () => {
  describe('schema validation', () => {
    it('should accept valid tenant context', () => {
      const context = {
        tenant_id: 'tenant-123',
        project_id: 'project-456',
      };
      
      const result = TenantContextSchema.safeParse(context);
      expect(result.success).toBe(true);
    });
    
    it('should reject empty tenant_id', () => {
      const context = {
        tenant_id: '',
        project_id: 'project-456',
      };
      
      const result = TenantContextSchema.safeParse(context);
      expect(result.success).toBe(false);
    });
    
    it('should reject empty project_id', () => {
      const context = {
        tenant_id: 'tenant-123',
        project_id: '',
      };
      
      const result = TenantContextSchema.safeParse(context);
      expect(result.success).toBe(false);
    });
    
    it('should reject missing tenant_id', () => {
      const context = {
        project_id: 'project-456',
      };
      
      const result = TenantContextSchema.safeParse(context);
      expect(result.success).toBe(false);
    });
    
    it('should reject missing project_id', () => {
      const context = {
        tenant_id: 'tenant-123',
      };
      
      const result = TenantContextSchema.safeParse(context);
      expect(result.success).toBe(false);
    });
  });
  
  describe('validateTenantContext', () => {
    it('should return valid=true for valid context', () => {
      const result = validateTenantContext({
        tenant_id: 'tenant-123',
        project_id: 'project-456',
      });
      
      expect(result.valid).toBe(true);
      expect(result.context).toEqual({
        tenant_id: 'tenant-123',
        project_id: 'project-456',
      });
    });
    
    it('should return valid=false with errors for invalid context', () => {
      const result = validateTenantContext({
        tenant_id: '',
        project_id: 'project-456',
      });
      
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });
  });
  
  describe('createTenantContext', () => {
    it('should create valid context', () => {
      const context = createTenantContext('tenant-123', 'project-456');
      
      expect(context).toEqual({
        tenant_id: 'tenant-123',
        project_id: 'project-456',
      });
    });
    
    it('should throw for invalid input', () => {
      expect(() => createTenantContext('', 'project-456')).toThrow();
      expect(() => createTenantContext('tenant-123', '')).toThrow();
    });
  });
});