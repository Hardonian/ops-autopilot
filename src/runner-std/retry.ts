/**
 * Retry / Backoff with Idempotency Key
 *
 * Every external action gets:
 * - An idempotency key
 * - A retry/backoff policy
 * - Safe re-run behavior
 */

import { randomUUID } from 'crypto';

export interface RetryPolicy {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 3,
  initialDelayMs: 200,
  maxDelayMs: 5000,
  backoffMultiplier: 2,
};

export function generateIdempotencyKey(prefix?: string): string {
  const id = randomUUID();
  return prefix ? `${prefix}-${id}` : id;
}

function delayMs(attempt: number, policy: RetryPolicy): number {
  const delay = policy.initialDelayMs * Math.pow(policy.backoffMultiplier, attempt - 1);
  return Math.min(delay, policy.maxDelayMs);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export interface RetryResult<T> {
  success: boolean;
  value?: T;
  attempts: number;
  lastError?: Error;
  idempotencyKey: string;
}

/**
 * Execute a function with retry and idempotency key.
 * The idempotency key is passed to the function so it can
 * forward it to external services.
 */
export async function withRetry<T>(
  fn: (idempotencyKey: string, attempt: number) => Promise<T>,
  opts?: Partial<RetryPolicy> & { idempotencyKey?: string }
): Promise<RetryResult<T>> {
  const policy = { ...DEFAULT_RETRY_POLICY, ...opts };
  const idempotencyKey = opts?.idempotencyKey ?? generateIdempotencyKey();
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= policy.maxAttempts; attempt++) {
    try {
      const value = await fn(idempotencyKey, attempt);
      return { success: true, value, attempts: attempt, idempotencyKey };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < policy.maxAttempts) {
        await sleep(delayMs(attempt, policy));
      }
    }
  }

  return { success: false, attempts: policy.maxAttempts, lastError, idempotencyKey };
}
