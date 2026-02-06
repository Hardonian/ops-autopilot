/**
 * Runner Standard Library
 *
 * Shared infrastructure for all runners:
 * - Error envelopes with standard exit codes
 * - Structured JSONL logging with redaction
 * - Artifact layout management
 * - Retry/backoff with idempotency keys
 * - Secret redaction
 */

export {
  type ErrorEnvelope,
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
} from './errors.js';

export {
  Logger,
  type LogLevel,
  type LogEntry,
  type LoggerOptions,
} from './logger.js';

export {
  ArtifactWriter,
  loadArtifacts,
  type ArtifactSummary,
  type ArtifactWriterOptions,
} from './artifacts.js';

export {
  redact,
  redactString,
  DEFAULT_DENY_KEYS,
  REDACTED,
  type RedactOptions,
} from './redact.js';

export {
  withRetry,
  generateIdempotencyKey,
  DEFAULT_RETRY_POLICY,
  type RetryPolicy,
  type RetryResult,
} from './retry.js';
