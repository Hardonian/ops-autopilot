/**
 * Health Audit Capability
 *
 * Implements ops.health_audit with:
 * - Idempotent execution
 * - Backoff retry policy
 * - Timeout budget
 * - Circuit breaker pattern
 * - Optimized validation with caching
 */

import { randomUUID } from 'crypto';
import {
  HealthAuditInputSchema,
  HealthAuditOutputSchema,
  HealthAuditCapabilityMetadata,
  type HealthAuditInput,
  type HealthAuditOutput,
  type CapabilityMetadata,
  generateId,
} from '../contracts/index.js';

// ============================================================================
// Optimized Validation Cache
// ============================================================================

class ValidationCache<T> {
  private cache = new Map<string, { result: T; expiresAt: number }>();
  private readonly ttlMs: number;

  constructor(ttlMinutes: number = 5) {
    this.ttlMs = ttlMinutes * 60 * 1000;
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.result;
  }

  set(key: string, result: T): void {
    this.cache.set(key, { result, expiresAt: Date.now() + this.ttlMs });
  }

  clear(): void {
    this.cache.clear();
  }
}

// Input validation cache with stable keys
const inputValidationCache = new ValidationCache<HealthAuditInput>();

// ============================================================================
// Types
// ============================================================================

export interface RetryState {
  attempt: number;
  lastError?: Error;
  nextDelayMs: number;
}

export interface CircuitBreakerState {
  status: 'closed' | 'open' | 'half-open';
  failureCount: number;
  lastFailureTime?: number;
}

export interface ExecutionContext {
  idempotencyKey: string;
  startTime: number;
  timeoutBudgetMs: number;
  retryState: RetryState;
  circuitBreaker: CircuitBreakerState;
}

// ============================================================================
// Circuit Breaker
// ============================================================================

class CircuitBreaker {
  private state: CircuitBreakerState = { status: 'closed', failureCount: 0 };

  constructor(
    private failureThreshold: number,
    private recoveryTimeoutMs: number
  ) {}

  canExecute(): boolean {
    if (this.state.status === 'closed') {
      return true;
    }

    if (this.state.status === 'open') {
      const now = Date.now();
      if (
        this.state.lastFailureTime &&
        now - this.state.lastFailureTime >= this.recoveryTimeoutMs
      ) {
        this.state.status = 'half-open';
        this.state.failureCount = 0;
        return true;
      }
      return false;
    }

    return this.state.status === 'half-open';
  }

  recordSuccess(): void {
    this.state.status = 'closed';
    this.state.failureCount = 0;
    this.state.lastFailureTime = undefined;
  }

  recordFailure(): void {
    this.state.failureCount++;
    this.state.lastFailureTime = Date.now();

    if (this.state.failureCount >= this.failureThreshold) {
      this.state.status = 'open';
    }
  }

  getState(): CircuitBreakerState {
    return { ...this.state };
  }

  reset(): void {
    this.state = { status: 'closed', failureCount: 0 };
    this.state.lastFailureTime = undefined;
  }
}

// ============================================================================
// Idempotency Store (in-memory with TTL)
// ============================================================================

interface IdempotencyEntry {
  output: HealthAuditOutput;
  expiresAt: number;
}

class IdempotencyStore {
  private store = new Map<string, IdempotencyEntry>();
  private readonly ttlMs: number;

  constructor(ttlMinutes: number = 60) {
    this.ttlMs = ttlMinutes * 60 * 1000;
  }

  get(key: string): HealthAuditOutput | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }

    return entry.output;
  }

  set(key: string, output: HealthAuditOutput): void {
    this.store.set(key, {
      output,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }
}

// Global idempotency store
const idempotencyStore = new IdempotencyStore();

// Global circuit breaker shared across all executions
const globalCircuitBreaker = new CircuitBreaker(
  HealthAuditCapabilityMetadata.execution_policy.circuit_breaker?.failure_threshold ?? 5,
  HealthAuditCapabilityMetadata.execution_policy.circuit_breaker?.recovery_timeout_ms ?? 10000
);

// ============================================================================
// Retry Logic
// ============================================================================

function calculateBackoffDelay(
  attempt: number,
  policy: CapabilityMetadata['execution_policy']['retry_policy']
): number {
  const { backoff_strategy, initial_delay_ms, max_delay_ms, backoff_multiplier = 2 } = policy;

  let delay: number;

  switch (backoff_strategy) {
    case 'fixed':
      delay = initial_delay_ms;
      break;
    case 'linear':
      delay = initial_delay_ms * attempt;
      break;
    case 'exponential':
      delay = initial_delay_ms * Math.pow(backoff_multiplier, attempt - 1);
      break;
    default:
      delay = initial_delay_ms;
  }

  return Math.min(delay, max_delay_ms);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// Audit Execution
// ============================================================================

interface AuditDependencies {
  fetchServiceMetrics: (
    service: string,
    timeRange?: { start: string; end: string }
  ) => Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    metrics: Record<string, number>;
  }>;
  checkServiceHealth: (service: string) => Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    availability: number;
    latencyP95?: number;
    errorRate?: number;
  }>;
}

async function performAudit(
  input: HealthAuditInput,
  deps: AuditDependencies,
  attempt: number,
  idempotencyKey: string
): Promise<HealthAuditOutput> {
  const startedAt = new Date().toISOString();
  const startTime = Date.now();
  const auditId = generateId();

  const services = input.services ?? ['api', 'database', 'cache', 'queue'];
  const servicesAudited: string[] = [];
  const findings: HealthAuditOutput['findings'] = [];
  const metrics: Record<string, number> = {};
  const recommendations: HealthAuditOutput['recommendations'] = [];

  // Track if we have any dependency failures that should trigger retry
  let hasDependencyFailure = false;
  let dependencyError: Error | undefined;

  // Batch service health checks for better I/O efficiency
  const healthResults = await Promise.allSettled(
    services.map(async service => {
      const health = await deps.checkServiceHealth(service);
      return { service, health };
    })
  );

  for (let i = 0; i < healthResults.length; i++) {
    const result = healthResults[i];
    const service = services[i];

    if (result.status === 'rejected') {
      // Track dependency failure for potential retry, but continue auditing other services
      hasDependencyFailure = true;
      const error =
        result.reason instanceof Error ? result.reason : new Error(String(result.reason));
      if (!dependencyError) {
        dependencyError = error;
      }

      // Add finding for this service failure
      findings.push({
        id: `finding-${service}-error-${Date.now()}`,
        severity: 'critical',
        category: 'dependency_failure',
        message: `Failed to audit ${service}: ${error.message}`,
        recommendation: 'Verify monitoring infrastructure connectivity',
        evidence: [
          {
            type: 'error',
            path: `services/${service}`,
            value: error.message,
            description: `Error during ${service} audit`,
          },
        ],
      });
      continue;
    }

    // Extract health data from the wrapped result
    const health = result.value?.health;
    if (!health) {
      // Malformed result - skip this service
      continue;
    }
    servicesAudited.push(service);

    if (health.status !== 'healthy') {
      findings.push({
        id: `finding-${service}-${Date.now()}`,
        severity: health.status === 'unhealthy' ? 'critical' : 'warning',
        category: 'service_health',
        message: `${service} is ${health.status}`,
        recommendation: `Investigate ${service} degradation and consider scaling or restarting`,
        evidence: [
          {
            type: 'health_check',
            path: `services/${service}/health`,
            value: health,
            description: `Health status for ${service}`,
          },
        ],
      });

      recommendations.push({
        priority: health.status === 'unhealthy' ? 'critical' : 'high',
        description: `${service} requires attention`,
        action: `Check ${service} logs and metrics`,
      });
    }
  }

  // If all services failed due to dependency issues, throw to trigger retry
  if (hasDependencyFailure && servicesAudited.length === 0 && dependencyError) {
    throw dependencyError;
  }

  // Fetch metrics only for successfully audited services with include_metrics
  if (input.include_metrics && servicesAudited.length > 0) {
    const timeRange =
      input.time_range?.start && input.time_range?.end
        ? { start: input.time_range.start, end: input.time_range.end }
        : undefined;

    // Batch metric requests
    const metricsResults = await Promise.allSettled(
      servicesAudited.map(service => deps.fetchServiceMetrics(service, timeRange))
    );

    for (const result of metricsResults) {
      if (result.status === 'fulfilled') {
        Object.assign(metrics, result.value.metrics);
      }
    }
  }

  const completedAt = new Date().toISOString();
  const executionTimeMs = Date.now() - startTime;

  return HealthAuditOutputSchema.parse({
    audit_id: auditId,
    status: findings.some(f => f.severity === 'critical') ? 'partial' : 'success',
    services_audited: servicesAudited,
    findings,
    metrics,
    recommendations,
    execution_metadata: {
      started_at: startedAt,
      completed_at: completedAt,
      attempts: attempt,
      execution_time_ms: executionTimeMs,
    },
    idempotency_key: idempotencyKey,
  });
}

// ============================================================================
// Main Capability Function
// ============================================================================

export interface ExecuteHealthAuditOptions {
  /** Mock dependencies for testing */
  dependencies?: Partial<AuditDependencies>;
  /** Skip idempotency check (for testing) */
  skipIdempotency?: boolean;
}

/**
 * Execute health audit with idempotency, retry, and circuit breaker
 *
 * @param input - Health audit input
 * @param options - Execution options
 * @returns Health audit output
 */
export async function executeHealthAudit(
  input: unknown,
  options: ExecuteHealthAuditOptions = {}
): Promise<HealthAuditOutput> {
  // Validate input with caching for deterministic inputs
  let validatedInput: HealthAuditInput;
  const cacheKey = typeof input === 'object' && input !== null ? JSON.stringify(input) : undefined;
  if (cacheKey) {
    const cached = inputValidationCache.get(cacheKey);
    if (cached) {
      validatedInput = cached;
    } else {
      validatedInput = HealthAuditInputSchema.parse(input);
      inputValidationCache.set(cacheKey, validatedInput);
    }
  } else {
    validatedInput = HealthAuditInputSchema.parse(input);
  }

  // Generate or use provided idempotency key
  const idempotencyKey = validatedInput.idempotency_key ?? randomUUID();

  // Check idempotency store (unless skipped for testing)
  if (!options.skipIdempotency) {
    const cached = idempotencyStore.get(idempotencyKey);
    if (cached) {
      return {
        ...cached,
        execution_metadata: {
          ...cached.execution_metadata,
          attempts: 0,
        },
      };
    }
  }

  // Use global circuit breaker for cross-call state management
  if (!globalCircuitBreaker.canExecute()) {
    return HealthAuditOutputSchema.parse({
      audit_id: generateId(),
      status: 'failure',
      services_audited: [],
      findings: [
        {
          id: `finding-circuit-breaker-${Date.now()}`,
          severity: 'critical',
          category: 'execution_failure',
          message: 'Circuit breaker is open - too many recent failures',
          recommendation: 'Wait for circuit breaker recovery period',
          evidence: [],
        },
      ],
      metrics: {},
      recommendations: [
        {
          priority: 'critical',
          description: 'Circuit breaker triggered - execution blocked',
          action: 'Investigate underlying issues and wait for recovery',
        },
      ],
      execution_metadata: {
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        attempts: 0,
        execution_time_ms: 0,
      },
      idempotency_key: idempotencyKey,
    });
  }

  // Setup dependencies
  const defaultDeps: AuditDependencies = {
    fetchServiceMetrics: async () => ({
      status: 'healthy',
      metrics: { cpu: 45, memory: 60, disk: 30 },
    }),
    checkServiceHealth: async () => ({
      status: 'healthy',
      availability: 99.9,
      latencyP95: 150,
      errorRate: 0.1,
    }),
  };

  const deps = { ...defaultDeps, ...options.dependencies };

  // Execute with retry
  const { retry_policy, timeout_budget_ms } = HealthAuditCapabilityMetadata.execution_policy;
  const startTime = Date.now();
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= retry_policy.max_attempts; attempt++) {
    // Check timeout budget
    if (Date.now() - startTime > timeout_budget_ms) {
      globalCircuitBreaker.recordFailure();
      return HealthAuditOutputSchema.parse({
        audit_id: generateId(),
        status: 'failure',
        services_audited: [],
        findings: [
          {
            id: `finding-timeout-${Date.now()}`,
            severity: 'warning',
            category: 'timeout',
            message: 'Audit exceeded timeout budget',
            recommendation: 'Consider increasing timeout or reducing audit scope',
            evidence: [
              {
                type: 'timeout',
                path: 'execution',
                value: { budget_ms: timeout_budget_ms, elapsed_ms: Date.now() - startTime },
                description: 'Timeout budget exceeded',
              },
            ],
          },
        ],
        metrics: {},
        recommendations: [
          {
            priority: 'high',
            description: 'Audit timed out',
            action: 'Retry with increased timeout or reduced scope',
          },
        ],
        execution_metadata: {
          started_at: new Date(startTime).toISOString(),
          completed_at: new Date().toISOString(),
          attempts: attempt,
          execution_time_ms: Date.now() - startTime,
        },
        idempotency_key: idempotencyKey,
      });
    }

    try {
      const output = await performAudit(validatedInput, deps, attempt, idempotencyKey);
      globalCircuitBreaker.recordSuccess();

      // Store in idempotency store (unless skipped for testing)
      if (!options.skipIdempotency) {
        idempotencyStore.set(idempotencyKey, output);
      }

      return output;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      globalCircuitBreaker.recordFailure();

      // If not the last attempt, wait and retry
      if (attempt < retry_policy.max_attempts) {
        const delay = calculateBackoffDelay(attempt, retry_policy);
        await sleep(delay);
      }
    }
  }

  // All retries exhausted
  return HealthAuditOutputSchema.parse({
    audit_id: generateId(),
    status: 'failure',
    services_audited: [],
    findings: [
      {
        id: `finding-retry-exhausted-${Date.now()}`,
        severity: 'critical',
        category: 'execution_failure',
        message: `All ${retry_policy.max_attempts} retry attempts failed: ${lastError?.message}`,
        recommendation: 'Investigate underlying infrastructure issues',
        evidence: [
          {
            type: 'error',
            path: 'execution',
            value: lastError?.message,
            description: 'Last retry attempt error',
          },
        ],
      },
    ],
    metrics: {},
    recommendations: [
      {
        priority: 'critical',
        description: 'Audit failed after all retries',
        action: 'Investigate and fix underlying issues before retrying',
      },
    ],
    execution_metadata: {
      started_at: new Date(startTime).toISOString(),
      completed_at: new Date().toISOString(),
      attempts: retry_policy.max_attempts,
      execution_time_ms: Date.now() - startTime,
    },
    idempotency_key: idempotencyKey,
  });
}

// ============================================================================
// Metadata Export
// ============================================================================

export { HealthAuditCapabilityMetadata };
export type { CapabilityMetadata };

/**
 * Get capability metadata
 */
export function getCapabilityMetadata(): CapabilityMetadata {
  return HealthAuditCapabilityMetadata;
}

/**
 * Validate that an input conforms to the capability schema
 */
export function validateHealthAuditInput(input: unknown): HealthAuditInput {
  return HealthAuditInputSchema.parse(input);
}
