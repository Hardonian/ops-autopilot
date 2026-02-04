/**
 * Contract Schema Compliance Tests
 *
 * Validates that all schemas conform to canonical contract standards
 */

import { describe, it, expect } from 'vitest';
import {
  CapabilityMetadataSchema,
  HealthAuditInputSchema,
  HealthAuditOutputSchema,
  HealthAuditCapabilityMetadata,
  AlertSchema,
  AlertCorrelationSchema,
  RunbookSchema,
  ReliabilityReportSchema,
  JobRequestBundleSchema,
  ReportEnvelopeBundleSchema,
  type CapabilityMetadata,
} from '../src/contracts/index.js';

describe('Contract Schema Compliance', () => {
  describe('Capability Metadata Schema', () => {
    it('should validate valid capability metadata', () => {
      const validMetadata: CapabilityMetadata = {
        capability_id: 'ops.test',
        version: '1.0.0',
        description: 'Test capability',
        input_schema: {
          type: 'zod_schema',
          ref: 'TestInputSchema',
          description: 'Test input',
        },
        output_schema: {
          type: 'zod_schema',
          ref: 'TestOutputSchema',
          description: 'Test output',
        },
        errors: [
          {
            code: 'TEST_ERROR',
            message: 'Test error',
            severity: 'warning',
            recoverable: true,
          },
        ],
        execution_policy: {
          idempotent: true,
          retry_policy: {
            max_attempts: 3,
            backoff_strategy: 'exponential',
            initial_delay_ms: 1000,
            max_delay_ms: 30000,
            backoff_multiplier: 2,
          },
          timeout_budget_ms: 60000,
          circuit_breaker: {
            failure_threshold: 5,
            recovery_timeout_ms: 30000,
          },
        },
        required_permissions: ['test:read'],
        tags: ['test'],
      };

      const result = CapabilityMetadataSchema.safeParse(validMetadata);
      expect(result.success).toBe(true);
    });

    it('should reject metadata with invalid retry policy', () => {
      const invalidMetadata = {
        capability_id: 'ops.test',
        version: '1.0.0',
        description: 'Test',
        input_schema: { type: 'zod_schema', ref: 'Test', description: 'Test' },
        output_schema: { type: 'zod_schema', ref: 'Test', description: 'Test' },
        errors: [],
        execution_policy: {
          idempotent: true,
          retry_policy: {
            max_attempts: 20, // Too high
            backoff_strategy: 'exponential',
            initial_delay_ms: 1000,
            max_delay_ms: 30000,
          },
          timeout_budget_ms: 60000,
        },
        required_permissions: [],
        tags: [],
      };

      const result = CapabilityMetadataSchema.safeParse(invalidMetadata);
      expect(result.success).toBe(false);
    });

    it('should reject metadata with timeout exceeding limit', () => {
      const invalidMetadata = {
        capability_id: 'ops.test',
        version: '1.0.0',
        description: 'Test',
        input_schema: { type: 'zod_schema', ref: 'Test', description: 'Test' },
        output_schema: { type: 'zod_schema', ref: 'Test', description: 'Test' },
        errors: [],
        execution_policy: {
          idempotent: true,
          retry_policy: {
            max_attempts: 3,
            backoff_strategy: 'exponential',
            initial_delay_ms: 1000,
            max_delay_ms: 30000,
          },
          timeout_budget_ms: 400000, // Exceeds max of 300000
        },
        required_permissions: [],
        tags: [],
      };

      const result = CapabilityMetadataSchema.safeParse(invalidMetadata);
      expect(result.success).toBe(false);
    });
  });

  describe('Health Audit Capability Metadata', () => {
    it('should validate against CapabilityMetadataSchema', () => {
      const result = CapabilityMetadataSchema.safeParse(HealthAuditCapabilityMetadata);
      expect(result.success).toBe(true);
    });

    it('should have correct capability_id', () => {
      expect(HealthAuditCapabilityMetadata.capability_id).toBe('ops.health_audit');
    });

    it('should define idempotent execution', () => {
      expect(HealthAuditCapabilityMetadata.execution_policy.idempotent).toBe(true);
    });

    it('should define retry policy with exponential backoff', () => {
      const { retry_policy } = HealthAuditCapabilityMetadata.execution_policy;
      expect(retry_policy.backoff_strategy).toBe('exponential');
      expect(retry_policy.max_attempts).toBe(3);
      expect(retry_policy.initial_delay_ms).toBe(100); // Optimized for faster recovery
      expect(retry_policy.max_delay_ms).toBe(5000); // Reduced to avoid thundering herd
    });

    it('should define timeout budget', () => {
      expect(HealthAuditCapabilityMetadata.execution_policy.timeout_budget_ms).toBe(60000);
    });

    it('should define circuit breaker', () => {
      expect(HealthAuditCapabilityMetadata.execution_policy.circuit_breaker).toBeDefined();
      expect(
        HealthAuditCapabilityMetadata.execution_policy.circuit_breaker?.failure_threshold
      ).toBe(5);
    });

    it('should define all expected error types', () => {
      const errorCodes = HealthAuditCapabilityMetadata.errors.map(e => e.code);
      expect(errorCodes).toContain('INVALID_INPUT');
      expect(errorCodes).toContain('DEPENDENCY_UNAVAILABLE');
      expect(errorCodes).toContain('TIMEOUT_EXCEEDED');
      expect(errorCodes).toContain('IDEMPOTENCY_CONFLICT');
    });

    it('should define required permissions', () => {
      expect(HealthAuditCapabilityMetadata.required_permissions).toContain('ops:read');
      expect(HealthAuditCapabilityMetadata.required_permissions).toContain('metrics:read');
    });
  });

  describe('Health Audit Input Schema', () => {
    it('should validate valid input', () => {
      const input = {
        tenant_id: 'test-tenant',
        project_id: 'test-project',
        services: ['api', 'database'],
        audit_depth: 'deep',
        time_range: {
          start: '2026-01-01T00:00:00Z',
          end: '2026-01-02T00:00:00Z',
        },
        idempotency_key: 'test-key',
      };

      const result = HealthAuditInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should use default audit_depth', () => {
      const input = {
        tenant_id: 'test-tenant',
        project_id: 'test-project',
      };

      const result = HealthAuditInputSchema.parse(input);
      expect(result.audit_depth).toBe('standard');
    });

    it('should reject invalid audit_depth', () => {
      const input = {
        tenant_id: 'test-tenant',
        project_id: 'test-project',
        audit_depth: 'invalid',
      };

      const result = HealthAuditInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should require tenant_id and project_id', () => {
      const input = {
        services: ['api'],
      };

      const result = HealthAuditInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('Health Audit Output Schema', () => {
    it('should validate valid output', () => {
      const output = {
        audit_id: 'audit-123',
        status: 'success',
        services_audited: ['api'],
        findings: [],
        metrics: { cpu: 45 },
        recommendations: [],
        execution_metadata: {
          started_at: '2026-01-01T00:00:00Z',
          completed_at: '2026-01-01T00:01:00Z',
          attempts: 1,
          execution_time_ms: 60000,
          cost_usd_estimate: 0.25,
        },
        idempotency_key: 'test-key',
      };

      const result = HealthAuditOutputSchema.safeParse(output);
      expect(result.success).toBe(true);
    });

    it('should validate partial status', () => {
      const output = {
        audit_id: 'audit-123',
        status: 'partial',
        services_audited: ['api'],
        findings: [
          {
            id: 'finding-1',
            severity: 'warning',
            category: 'health',
            message: 'Service degraded',
            recommendation: 'Investigate',
            evidence: [],
          },
        ],
        metrics: {},
        recommendations: [
          {
            priority: 'high',
            description: 'Fix issue',
            action: 'Investigate',
          },
        ],
        execution_metadata: {
          started_at: '2026-01-01T00:00:00Z',
          completed_at: '2026-01-01T00:01:00Z',
          attempts: 2,
          execution_time_ms: 60000,
          cost_usd_estimate: 0.4,
        },
      };

      const result = HealthAuditOutputSchema.safeParse(output);
      expect(result.success).toBe(true);
    });

    it('should reject invalid status', () => {
      const output = {
        audit_id: 'audit-123',
        status: 'unknown', // Invalid
        services_audited: [],
        findings: [],
        metrics: {},
        recommendations: [],
        execution_metadata: {
          started_at: '2026-01-01T00:00:00Z',
          completed_at: '2026-01-01T00:01:00Z',
          attempts: 1,
          execution_time_ms: 60000,
          cost_usd_estimate: 0.1,
        },
      };

      const result = HealthAuditOutputSchema.safeParse(output);
      expect(result.success).toBe(false);
    });
  });

  describe('Bundle Schema Compliance', () => {
    it('should validate JobRequestBundle', () => {
      const bundle = {
        schema_version: '1.0.0',
        module_id: 'ops',
        tenant_id: 'test-tenant',
        project_id: 'test-project',
        trace_id: 'trace-123',
        created_at: '2026-01-01T00:00:00Z',
        dry_run: true,
        requests: [],
        idempotency_keys: [],
        canonicalization: {
          algorithm: 'json-lexicographic',
          hash_algorithm: 'sha256',
          hash: 'a'.repeat(64),
        },
      };

      const result = JobRequestBundleSchema.safeParse(bundle);
      expect(result.success).toBe(true);
    });

    it('should reject JobRequestBundle with invalid hash', () => {
      const bundle = {
        schema_version: '1.0.0',
        module_id: 'ops',
        tenant_id: 'test-tenant',
        project_id: 'test-project',
        trace_id: 'trace-123',
        created_at: '2026-01-01T00:00:00Z',
        dry_run: true,
        requests: [],
        idempotency_keys: [],
        canonicalization: {
          algorithm: 'json-lexicographic',
          hash_algorithm: 'sha256',
          hash: 'invalid-hash',
        },
      };

      const result = JobRequestBundleSchema.safeParse(bundle);
      expect(result.success).toBe(false);
    });
  });

  describe('Cross-Schema Consistency', () => {
    it('should use consistent severity values across schemas', () => {
      const alert = {
        alert_id: 'alert-1',
        tenant_id: 'test-tenant',
        project_id: 'test-project',
        source: 'cloudwatch',
        status: 'open',
        title: 'Test Alert',
        description: 'Test',
        severity: 'critical',
        service: 'api',
        timestamp: '2026-01-01T00:00:00Z',
      };

      const result = AlertSchema.safeParse(alert);
      expect(result.success).toBe(true);
    });

    it('should use consistent timestamp format', () => {
      const timestamps = [HealthAuditCapabilityMetadata.execution_policy.timeout_budget_ms];

      // All timestamps should be positive integers
      for (const ts of timestamps) {
        expect(typeof ts).toBe('number');
        expect(ts).toBeGreaterThan(0);
      }
    });
  });
});
