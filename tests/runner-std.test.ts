/**
 * Runner Standard Library Tests
 *
 * Tests for:
 * - Error envelopes and exit codes
 * - Structured logging with redaction
 * - Artifact layout
 * - Secret redaction (denylist)
 * - Retry with idempotency
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import {
  // Errors
  RunnerError,
  validationError,
  dependencyError,
  bugError,
  toErrorEnvelope,
  exitCodeForError,
  EXIT_SUCCESS,
  EXIT_VALIDATION,
  EXIT_DEPENDENCY,
  EXIT_BUG,
  // Logger
  Logger,
  // Artifacts
  ArtifactWriter,
  loadArtifacts,
  // Redaction
  redact,
  redactString,
  DEFAULT_DENY_KEYS,
  REDACTED,
  // Retry
  withRetry,
  generateIdempotencyKey,
} from '../src/runner-std/index.js';

// ============================================================================
// Error Envelope Tests
// ============================================================================

describe('Error Envelopes', () => {
  it('should have correct exit codes', () => {
    expect(EXIT_SUCCESS).toBe(0);
    expect(EXIT_VALIDATION).toBe(2);
    expect(EXIT_DEPENDENCY).toBe(3);
    expect(EXIT_BUG).toBe(4);
  });

  it('should create validation error with correct fields', () => {
    const err = validationError('bad input', { field: 'name' });
    expect(err).toBeInstanceOf(RunnerError);
    expect(err.exitCode).toBe(EXIT_VALIDATION);
    expect(err.envelope.code).toBe('VALIDATION_ERROR');
    expect(err.envelope.retryable).toBe(false);
    expect(err.envelope.userMessage).toContain('validation failed');
    expect(err.envelope.context).toEqual({ field: 'name' });
  });

  it('should create dependency error with retryable=true', () => {
    const err = dependencyError('timeout', 'connection refused');
    expect(err.exitCode).toBe(EXIT_DEPENDENCY);
    expect(err.envelope.code).toBe('DEPENDENCY_FAILURE');
    expect(err.envelope.retryable).toBe(true);
    expect(err.envelope.cause).toBe('connection refused');
  });

  it('should create bug error', () => {
    const err = bugError('null pointer', 'stack trace here');
    expect(err.exitCode).toBe(EXIT_BUG);
    expect(err.envelope.code).toBe('UNEXPECTED_BUG');
    expect(err.envelope.retryable).toBe(false);
  });

  it('should convert ZodError to envelope', () => {
    const zodLike = Object.assign(new Error('validation'), {
      name: 'ZodError',
      errors: [{ path: ['field'], message: 'required' }],
    });
    const envelope = toErrorEnvelope(zodLike);
    expect(envelope.code).toBe('VALIDATION_ERROR');
    expect(envelope.userMessage).toContain('field');
  });

  it('should convert plain Error to envelope', () => {
    const envelope = toErrorEnvelope(new Error('oops'));
    expect(envelope.code).toBe('UNEXPECTED_BUG');
    expect(envelope.message).toBe('oops');
  });

  it('should convert string to envelope', () => {
    const envelope = toErrorEnvelope('something broke');
    expect(envelope.code).toBe('UNEXPECTED_BUG');
    expect(envelope.message).toBe('something broke');
  });

  it('should return correct exit codes for error types', () => {
    expect(exitCodeForError(validationError('x'))).toBe(EXIT_VALIDATION);
    expect(exitCodeForError(dependencyError('x'))).toBe(EXIT_DEPENDENCY);
    expect(exitCodeForError(bugError('x'))).toBe(EXIT_BUG);
    expect(exitCodeForError(new Error('x'))).toBe(EXIT_BUG);

    const zodLike = Object.assign(new Error('z'), { name: 'ZodError' });
    expect(exitCodeForError(zodLike)).toBe(EXIT_VALIDATION);
  });
});

// ============================================================================
// Logger Tests
// ============================================================================

describe('Structured Logger', () => {
  it('should emit JSONL lines to sink', () => {
    const lines: string[] = [];
    const logger = new Logger({ runId: 'test-run', json: true, sink: line => lines.push(line) });

    logger.info('hello', { extra: 'data' });

    expect(lines.length).toBe(1);
    const parsed = JSON.parse(lines[0]);
    expect(parsed.level).toBe('info');
    expect(parsed.msg).toBe('hello');
    expect(parsed.runId).toBe('test-run');
    expect(parsed.extra).toBe('data');
    expect(parsed.ts).toBeDefined();
  });

  it('should redact sensitive keys in log entries', () => {
    const lines: string[] = [];
    const logger = new Logger({
      json: true,
      sink: line => lines.push(line),
    });

    logger.info('config loaded', { password: 'secret123', api_key: 'key-abc' });

    const parsed = JSON.parse(lines[0]);
    expect(parsed.password).toBe(REDACTED);
    expect(parsed.api_key).toBe(REDACTED);
    expect(parsed.msg).toBe('config loaded');
  });

  it('should track lines array', () => {
    const logger = new Logger({ json: true, sink: () => {} });
    logger.info('one');
    logger.warn('two');
    logger.error('three');
    expect(logger.lines.length).toBe(3);
  });
});

// ============================================================================
// Redaction Tests - SECURITY CRITICAL
// ============================================================================

describe('Redaction', () => {
  describe('Object redaction', () => {
    it('should redact password fields', () => {
      const result = redact({ password: 'hunter2', name: 'test' });
      expect(result).toEqual({ password: REDACTED, name: 'test' });
    });

    it('should redact api_key fields', () => {
      const result = redact({ api_key: 'sk-1234', data: 'ok' });
      expect(result).toEqual({ api_key: REDACTED, data: 'ok' });
    });

    it('should redact nested secret fields', () => {
      const result = redact({
        config: {
          database_url: 'postgres://user:pass@host/db',
          host: 'localhost',
        },
      }) as { config: { database_url: string; host: string } };
      expect(result.config.database_url).toBe(REDACTED);
      expect(result.config.host).toBe('localhost');
    });

    it('should redact all default deny keys', () => {
      for (const key of DEFAULT_DENY_KEYS) {
        const obj = { [key]: 'secret-value' };
        const result = redact(obj) as Record<string, string>;
        expect(result[key]).toBe(REDACTED);
      }
    });

    it('should redact case-insensitively', () => {
      const result = redact({
        PASSWORD: 'secret',
        Api_Key: 'key123',
        SECRET_KEY: 'sk',
      }) as Record<string, string>;
      expect(result.PASSWORD).toBe(REDACTED);
      expect(result.Api_Key).toBe(REDACTED);
      expect(result.SECRET_KEY).toBe(REDACTED);
    });

    it('should handle arrays', () => {
      const result = redact([
        { name: 'a', token: 'tok1' },
        { name: 'b', token: 'tok2' },
      ]) as Array<{ name: string; token: string }>;
      expect(result[0].name).toBe('a');
      expect(result[0].token).toBe(REDACTED);
      expect(result[1].token).toBe(REDACTED);
    });

    it('should handle null and primitives', () => {
      expect(redact(null)).toBe(null);
      expect(redact(undefined)).toBe(undefined);
      expect(redact(42)).toBe(42);
      expect(redact('hello')).toBe('hello');
      expect(redact(true)).toBe(true);
    });

    it('should support custom deny keys', () => {
      const result = redact(
        { my_secret_field: 'value', normal: 'ok' },
        { extraDenyKeys: ['my_secret_field'] }
      ) as Record<string, string>;
      expect(result.my_secret_field).toBe(REDACTED);
      expect(result.normal).toBe('ok');
    });

    it('should support custom replacement', () => {
      const result = redact({ password: 'x' }, { replacement: '***' }) as Record<string, string>;
      expect(result.password).toBe('***');
    });
  });

  describe('String redaction', () => {
    it('should redact key=value patterns', () => {
      const input = 'password=hunter2 name=test';
      const result = redactString(input);
      expect(result).not.toContain('hunter2');
      expect(result).toContain(REDACTED);
      expect(result).toContain('name=test');
    });

    it('should redact JSON-like patterns', () => {
      const input = '{"api_key": "sk-1234", "name": "test"}';
      const result = redactString(input);
      expect(result).not.toContain('sk-1234');
      expect(result).toContain(REDACTED);
    });

    it('should redact AWS keys', () => {
      const input = 'aws_secret_access_key=ABCDEF123 aws_access_key_id=KEYID123';
      const result = redactString(input);
      expect(result).not.toContain('ABCDEF123');
      expect(result).not.toContain('KEYID123');
    });
  });

  describe('Forbidden patterns must not appear', () => {
    const FORBIDDEN_PATTERNS = [
      /password\s*[=:]\s*[^\s\[REDACTED\]]/i,
      /api[_-]?key\s*[=:]\s*(?!"\[REDACTED\]")[^\s]+/i,
      /secret[_-]?key\s*[=:]\s*(?!"\[REDACTED\]")[^\s]+/i,
      /bearer\s+[a-z0-9]/i,
      /aws_secret_access_key\s*[=:]\s*(?!"\[REDACTED\]")[^\s]+/i,
    ];

    it('should not leak secrets through object redaction', () => {
      const sensitiveData = {
        password: 'supersecret123',
        api_key: 'sk-prod-live-key',
        aws_secret_access_key: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        secret_key: 'my-secret-key',
        normal_field: 'this is fine',
      };

      const result = JSON.stringify(redact(sensitiveData));

      for (const pattern of FORBIDDEN_PATTERNS) {
        expect(result).not.toMatch(pattern);
      }
      expect(result).not.toContain('supersecret123');
      expect(result).not.toContain('sk-prod-live-key');
      expect(result).not.toContain('wJalrXUtnFEMI');
    });

    it('should not leak secrets through string redaction', () => {
      const logLine =
        'Connecting with password=supersecret api_key=sk-123 token=bearer-abc';
      const result = redactString(logLine);

      expect(result).not.toContain('supersecret');
      expect(result).not.toContain('sk-123');
      expect(result).not.toContain('bearer-abc');
    });

    it('should not leak secrets in nested structures', () => {
      const nested = {
        level1: {
          level2: {
            credentials: { password: 'deep-secret', user: 'admin' },
            connection_string: 'mongodb://user:pass@host',
          },
        },
      };

      const result = JSON.stringify(redact(nested));
      expect(result).not.toContain('deep-secret');
      expect(result).not.toContain('mongodb://user:pass@host');
    });
  });
});

// ============================================================================
// Artifact Layout Tests
// ============================================================================

describe('Artifact Layout', () => {
  const testBaseDir = '/tmp/ops-autopilot-test-artifacts';

  beforeEach(() => {
    rmSync(testBaseDir, { recursive: true, force: true });
  });

  afterEach(() => {
    rmSync(testBaseDir, { recursive: true, force: true });
  });

  it('should create standard directory structure', () => {
    const writer = new ArtifactWriter('run-123', { baseDir: testBaseDir });
    writer.init();

    expect(existsSync(join(testBaseDir, 'run-123'))).toBe(true);
    expect(existsSync(join(testBaseDir, 'run-123', 'evidence'))).toBe(true);
  });

  it('should write evidence files with redaction', () => {
    const writer = new ArtifactWriter('run-456', { baseDir: testBaseDir });
    writer.init();

    writer.writeEvidence('result', {
      data: 'ok',
      password: 'should-be-redacted',
    });

    const filePath = join(testBaseDir, 'run-456', 'evidence', 'result.json');
    expect(existsSync(filePath)).toBe(true);

    const content = JSON.parse(readFileSync(filePath, 'utf-8'));
    expect(content.data).toBe('ok');
    expect(content.password).toBe(REDACTED);
  });

  it('should write logs.jsonl', () => {
    const writer = new ArtifactWriter('run-789', { baseDir: testBaseDir });
    writer.init();

    writer.appendLog('{"level":"info","msg":"test1"}');
    writer.appendLog('{"level":"info","msg":"test2"}');
    writer.flushLogs();

    const logsPath = join(testBaseDir, 'run-789', 'logs.jsonl');
    expect(existsSync(logsPath)).toBe(true);

    const lines = readFileSync(logsPath, 'utf-8').split('\n').filter(Boolean);
    expect(lines.length).toBe(2);
  });

  it('should write summary.json', () => {
    const writer = new ArtifactWriter('run-abc', { baseDir: testBaseDir });
    writer.init();

    writer.writeSummary({
      runId: 'run-abc',
      command: 'plan',
      status: 'success',
      startedAt: '2026-01-01T00:00:00Z',
      completedAt: '2026-01-01T00:01:00Z',
      dryRun: true,
      evidenceFiles: [],
      logLineCount: 0,
    });

    const summaryPath = join(testBaseDir, 'run-abc', 'summary.json');
    expect(existsSync(summaryPath)).toBe(true);

    const content = JSON.parse(readFileSync(summaryPath, 'utf-8'));
    expect(content.runId).toBe('run-abc');
    expect(content.command).toBe('plan');
    expect(content.status).toBe('success');
  });

  it('should enforce layout: logs.jsonl + evidence/*.json + summary.json', () => {
    const writer = new ArtifactWriter('run-full', { baseDir: testBaseDir });
    writer.init();

    writer.writeEvidence('bundle', { requests: [] });
    writer.writeEvidence('report', { score: 100 });
    writer.appendLog('{"ts":"...","level":"info","msg":"start"}');
    writer.flushLogs();
    writer.writeSummary({
      runId: 'run-full',
      command: 'run',
      status: 'success',
      startedAt: '2026-01-01T00:00:00Z',
      completedAt: '2026-01-01T00:01:00Z',
      dryRun: false,
      evidenceFiles: writer.getEvidenceFiles(),
      logLineCount: 1,
    });

    const dir = join(testBaseDir, 'run-full');
    expect(existsSync(join(dir, 'logs.jsonl'))).toBe(true);
    expect(existsSync(join(dir, 'evidence', 'bundle.json'))).toBe(true);
    expect(existsSync(join(dir, 'evidence', 'report.json'))).toBe(true);
    expect(existsSync(join(dir, 'summary.json'))).toBe(true);
  });

  it('should load artifacts for replay', () => {
    const writer = new ArtifactWriter('run-replay', { baseDir: testBaseDir });
    writer.init();

    writer.writeEvidence('data', { foo: 'bar' });
    writer.appendLog('line1');
    writer.flushLogs();
    writer.writeSummary({
      runId: 'run-replay',
      command: 'test',
      status: 'success',
      startedAt: '2026-01-01T00:00:00Z',
      completedAt: '2026-01-01T00:01:00Z',
      dryRun: false,
      evidenceFiles: ['data.json'],
      logLineCount: 1,
    });

    const loaded = loadArtifacts(join(testBaseDir, 'run-replay'));
    expect(loaded.summary).not.toBeNull();
    expect(loaded.summary?.runId).toBe('run-replay');
    expect(loaded.logs.length).toBe(1);
    expect(loaded.evidence['data.json']).toEqual({ foo: 'bar' });
  });
});

// ============================================================================
// Retry Tests
// ============================================================================

describe('Retry with Idempotency', () => {
  it('should succeed on first attempt', async () => {
    const result = await withRetry(async () => 'ok');
    expect(result.success).toBe(true);
    expect(result.value).toBe('ok');
    expect(result.attempts).toBe(1);
    expect(result.idempotencyKey).toBeDefined();
  });

  it('should retry on failure and succeed', async () => {
    let callCount = 0;
    const result = await withRetry(
      async () => {
        callCount++;
        if (callCount < 3) throw new Error('fail');
        return 'ok';
      },
      { initialDelayMs: 1, maxDelayMs: 10 }
    );

    expect(result.success).toBe(true);
    expect(result.attempts).toBe(3);
    expect(callCount).toBe(3);
  });

  it('should fail after max attempts', async () => {
    const result = await withRetry(
      async () => {
        throw new Error('always fails');
      },
      { maxAttempts: 2, initialDelayMs: 1, maxDelayMs: 10 }
    );

    expect(result.success).toBe(false);
    expect(result.attempts).toBe(2);
    expect(result.lastError?.message).toBe('always fails');
  });

  it('should pass idempotency key to function', async () => {
    let receivedKey: string | undefined;
    await withRetry(
      async (key) => {
        receivedKey = key;
        return 'ok';
      },
      { idempotencyKey: 'my-key' }
    );

    expect(receivedKey).toBe('my-key');
  });

  it('should generate unique idempotency keys', () => {
    const key1 = generateIdempotencyKey('test');
    const key2 = generateIdempotencyKey('test');
    expect(key1).not.toBe(key2);
    expect(key1.startsWith('test-')).toBe(true);
  });
});
