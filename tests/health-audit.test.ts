/**
 * Health Audit Capability Tests
 *
 * Tests for: happy path, dependency down, invalid input, idempotency, retry logic
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  executeHealthAudit,
  getCapabilityMetadata,
  validateHealthAuditInput,
  _resetCircuitBreakerForTesting,
} from '../src/capabilities/health-audit.js';
import { HealthAuditCapabilityMetadata, MAX_SERVICES_PER_AUDIT } from '../src/contracts/index.js';

describe('Health Audit Capability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetCircuitBreakerForTesting();
  });

  describe('Capability Metadata', () => {
    it('should return metadata matching contract schema', () => {
      const metadata = getCapabilityMetadata();

      expect(metadata.capability_id).toBe('ops.health_audit');
      expect(metadata.version).toBe('1.0.0');
      expect(metadata.execution_policy.idempotent).toBe(true);
      expect(metadata.execution_policy.retry_policy.max_attempts).toBe(3);
      expect(metadata.execution_policy.retry_policy.backoff_strategy).toBe('exponential');
      expect(metadata.execution_policy.timeout_budget_ms).toBe(60000);
      expect(metadata.errors).toHaveLength(4);
      expect(metadata.required_permissions).toContain('ops:read');
    });

    it('should define all error types with correct severity', () => {
      const metadata = getCapabilityMetadata();

      const invalidInput = metadata.errors.find(e => e.code === 'INVALID_INPUT');
      expect(invalidInput?.severity).toBe('warning');
      expect(invalidInput?.recoverable).toBe(false);

      const dependencyDown = metadata.errors.find(e => e.code === 'DEPENDENCY_UNAVAILABLE');
      expect(dependencyDown?.severity).toBe('critical');
      expect(dependencyDown?.recoverable).toBe(true);

      const timeout = metadata.errors.find(e => e.code === 'TIMEOUT_EXCEEDED');
      expect(timeout?.severity).toBe('warning');
      expect(timeout?.recoverable).toBe(true);

      const idempotency = metadata.errors.find(e => e.code === 'IDEMPOTENCY_CONFLICT');
      expect(idempotency?.severity).toBe('info');
      expect(idempotency?.recoverable).toBe(false);
    });
  });

  describe('Input Validation', () => {
    it('should validate correct input', () => {
      const input = {
        tenant_id: 'test-tenant',
        project_id: 'test-project',
        services: ['api', 'database'],
        audit_depth: 'standard',
      };

      const validated = validateHealthAuditInput(input);
      expect(validated.tenant_id).toBe('test-tenant');
      expect(validated.project_id).toBe('test-project');
      expect(validated.services).toEqual(['api', 'database']);
      expect(validated.audit_depth).toBe('standard');
    });

    it('should reject invalid input with ZodError', () => {
      const input = {
        tenant_id: '', // Empty string should fail
        project_id: 'test-project',
      };

      expect(() => validateHealthAuditInput(input)).toThrow();
    });

    it('should use default values for optional fields', () => {
      const input = {
        tenant_id: 'test-tenant',
        project_id: 'test-project',
      };

      const validated = validateHealthAuditInput(input);
      expect(validated.audit_depth).toBe('standard');
      expect(validated.services).toBeUndefined();
    });

    it('should enforce service count limits to bound cost', () => {
      const input = {
        tenant_id: 'test-tenant',
        project_id: 'test-project',
        services: Array.from({ length: MAX_SERVICES_PER_AUDIT + 1 }, (_, index) => `svc-${index}`),
      };

      expect(() => validateHealthAuditInput(input)).toThrow();
    });
  });

  describe('Happy Path', () => {
    it('should complete audit successfully', async () => {
      const input = {
        tenant_id: 'test-tenant',
        project_id: 'test-project',
        services: ['api'],
        idempotency_key: 'test-key-1',
      };

      const deps = {
        checkServiceHealth: vi.fn().mockResolvedValue({
          status: 'healthy',
          availability: 99.9,
        }),
      };

      const result = await executeHealthAudit(input, { dependencies: deps });

      expect(result.status).toBe('success');
      expect(result.services_audited).toContain('api');
      expect(result.findings).toHaveLength(0);
      expect(result.execution_metadata.attempts).toBe(1);
      expect(result.execution_metadata.execution_time_ms).toBeGreaterThanOrEqual(0);
      expect(result.execution_metadata.cost_usd_estimate).toBeGreaterThan(0);
      expect(result.idempotency_key).toBe('test-key-1');
    });

    it('should detect unhealthy services', async () => {
      const input = {
        tenant_id: 'test-tenant',
        project_id: 'test-project',
        services: ['api', 'database'],
      };

      const deps = {
        checkServiceHealth: vi.fn().mockResolvedValue({
          status: 'unhealthy',
          availability: 85.0,
        }),
      };

      const result = await executeHealthAudit(input, { dependencies: deps });

      expect(result.status).toBe('partial');
      expect(result.findings).toHaveLength(2);
      expect(result.findings[0].severity).toBe('critical');
      expect(result.recommendations).toHaveLength(2);
    });

    it('should fetch metrics when include_metrics is set', async () => {
      const input = {
        tenant_id: 'test-tenant',
        project_id: 'test-project',
        services: ['api'],
        include_metrics: ['cpu', 'memory'],
        time_range: {
          start: '2026-01-01T00:00:00Z',
          end: '2026-01-02T00:00:00Z',
        },
      };

      const deps = {
        checkServiceHealth: vi.fn().mockResolvedValue({
          status: 'healthy',
          availability: 99.9,
        }),
        fetchServiceMetrics: vi.fn().mockResolvedValue({
          status: 'healthy',
          metrics: { cpu: 45, memory: 60 },
        }),
      };

      const result = await executeHealthAudit(input, { dependencies: deps });

      expect(result.status).toBe('success');
      expect(deps.fetchServiceMetrics).toHaveBeenCalledWith('api', {
        start: '2026-01-01T00:00:00Z',
        end: '2026-01-02T00:00:00Z',
      });
      expect(result.metrics).toEqual({ cpu: 45, memory: 60 });
    });
  });

  describe('Idempotency', () => {
    it('should return cached result for same idempotency key', async () => {
      const input = {
        tenant_id: 'test-tenant',
        project_id: 'test-project',
        services: ['api'],
        idempotency_key: 'duplicate-key',
      };

      const deps = {
        checkServiceHealth: vi.fn().mockResolvedValue({
          status: 'healthy',
          availability: 99.9,
        }),
      };

      // First call
      const result1 = await executeHealthAudit(input, { dependencies: deps });
      expect(result1.execution_metadata.attempts).toBe(1);

      // Second call with same key - should skip execution
      const result2 = await executeHealthAudit(input, { dependencies: deps });
      expect(result2.execution_metadata.attempts).toBe(0); // Cached result shows 0 attempts
      expect(result2.audit_id).toBe(result1.audit_id);

      // Service should only be called once
      expect(deps.checkServiceHealth).toHaveBeenCalledTimes(1);
    });

    it('should generate idempotency key if not provided', async () => {
      const input = {
        tenant_id: 'test-tenant',
        project_id: 'test-project',
      };

      const deps = {
        checkServiceHealth: vi.fn().mockResolvedValue({
          status: 'healthy',
          availability: 99.9,
        }),
      };

      const result = await executeHealthAudit(input, { dependencies: deps });

      expect(result.idempotency_key).toBeDefined();
      expect(typeof result.idempotency_key).toBe('string');
    });
  });

  describe('Retry Logic', () => {
    it('should retry on failure and succeed', async () => {
      const input = {
        tenant_id: 'test-tenant',
        project_id: 'test-project',
        services: ['api'],
        idempotency_key: 'retry-test',
      };

      const deps = {
        checkServiceHealth: vi
          .fn()
          .mockRejectedValueOnce(new Error('Service temporarily unavailable'))
          .mockResolvedValueOnce({
            status: 'healthy',
            availability: 99.9,
          }),
      };

      const result = await executeHealthAudit(input, {
        dependencies: deps,
        skipIdempotency: true,
      });

      expect(result.status).toBe('success');
      expect(result.execution_metadata.attempts).toBe(2);
      expect(deps.checkServiceHealth).toHaveBeenCalledTimes(2);
    });

    it('should fail after exhausting retries', async () => {
      const input = {
        tenant_id: 'test-tenant',
        project_id: 'test-project',
        services: ['api'],
        idempotency_key: 'retry-exhausted-test',
      };

      const deps = {
        checkServiceHealth: vi.fn().mockRejectedValue(new Error('Persistent failure')),
      };

      const result = await executeHealthAudit(input, {
        dependencies: deps,
        skipIdempotency: true,
      });

      expect(result.status).toBe('failure');
      expect(result.execution_metadata.attempts).toBe(3); // Max attempts
      expect(result.findings[0].category).toBe('execution_failure');
      expect(result.findings[0].message).toContain('All 3 retry attempts failed');
    });
  });

  describe('Dependency Down', () => {
    it('should handle dependency unavailable gracefully', async () => {
      const input = {
        tenant_id: 'test-tenant',
        project_id: 'test-project',
        services: ['api'],
      };

      const deps = {
        checkServiceHealth: vi.fn().mockRejectedValue(new Error('Connection refused')),
      };

      const result = await executeHealthAudit(input, {
        dependencies: deps,
        skipIdempotency: true,
      });

      expect(result.status).toBe('failure');
      expect(result.findings).toHaveLength(1);
      expect(result.findings[0].severity).toBe('critical');
      expect(result.findings[0].category).toBe('execution_failure');
    });

    it('should audit multiple services with partial failures', async () => {
      const input = {
        tenant_id: 'test-tenant',
        project_id: 'test-project',
        services: ['api', 'database', 'cache'],
      };

      const deps = {
        checkServiceHealth: vi
          .fn()
          .mockResolvedValueOnce({ status: 'healthy', availability: 99.9 })
          .mockRejectedValueOnce(new Error('Database connection failed'))
          .mockResolvedValueOnce({ status: 'healthy', availability: 99.5 }),
      };

      const result = await executeHealthAudit(input, { dependencies: deps });

      expect(result.services_audited).toContain('api');
      expect(result.services_audited).toContain('cache');
      expect(result.findings).toHaveLength(1); // Only database error
      expect(result.findings[0].category).toBe('dependency_failure');
      expect(result.status).toBe('partial');
    });
  });

  describe('Circuit Breaker', () => {
    it('should open circuit breaker after threshold failures', async () => {
      const input = {
        tenant_id: 'test-tenant',
        project_id: 'test-project',
        services: ['api'],
      };

      const deps = {
        checkServiceHealth: vi.fn().mockRejectedValue(new Error('Service down')),
      };

      // First 5 calls should trigger circuit breaker
      for (let i = 0; i < 5; i++) {
        await executeHealthAudit(
          { ...input, idempotency_key: `cb-test-${i}` },
          { dependencies: deps, skipIdempotency: true }
        );
      }

      // Next call should be blocked by circuit breaker
      const result = await executeHealthAudit(
        { ...input, idempotency_key: 'cb-test-blocked' },
        { dependencies: deps, skipIdempotency: true }
      );

      expect(result.status).toBe('failure');
      expect(result.findings[0].message).toContain('Circuit breaker is open');
    });
  });

  describe('Timeout Budget', () => {
    it('should respect timeout budget', async () => {
      const input = {
        tenant_id: 'test-tenant',
        project_id: 'test-project',
        services: ['api'],
      };

      const deps = {
        checkServiceHealth: vi.fn().mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return { status: 'healthy', availability: 99.9 };
        }),
      };

      const startTime = Date.now();
      const result = await executeHealthAudit(input, { dependencies: deps });
      const elapsedMs = Date.now() - startTime;

      expect(result.status).toBe('success');
      expect(elapsedMs).toBeLessThan(1000); // Should complete within reasonable time
    });
  });
});
