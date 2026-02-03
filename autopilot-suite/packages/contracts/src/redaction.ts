import { z } from 'zod';

/**
 * Redaction hints for sensitive data
 *
 * Autopilot modules must never log secrets or sensitive information.
 * Redaction hints mark fields that should be redacted in logs and outputs.
 */

/** Redaction severity level */
export const RedactionSeveritySchema = z.enum([
  'low', // Can log with masking
  'medium', // Should redact in most contexts
  'high', // Must always redact
  'critical', // Never persist, memory only
]);

export type RedactionSeverity = z.infer<typeof RedactionSeveritySchema>;

/** Redaction hint for a field */
export const RedactionHintSchema = z.object({
  /** Field path (dot notation) */
  field: z.string(),

  /** Reason for redaction */
  reason: z.string(),

  /** Severity level */
  severity: RedactionSeveritySchema,

  /** Redaction strategy */
  strategy: z
    .enum([
      'mask', // Replace with ***
      'hash', // Replace with hash
      'omit', // Remove entirely
      'encrypt', // Encrypt with key
    ])
    .default('mask'),

  /** Pattern to match (for regex-based redaction) */
  pattern: z.string().optional(),
});

export type RedactionHint = z.infer<typeof RedactionHintSchema>;

/** Redaction configuration */
export const RedactionConfigSchema = z.object({
  /** Whether redaction is enabled */
  enabled: z.boolean().default(true),

  /** Hints for specific fields */
  hints: z.array(RedactionHintSchema).default([]),

  /** Global patterns to redact */
  global_patterns: z
    .array(
      z.object({
        pattern: z.string(),
        replacement: z.string(),
      })
    )
    .default([]),

  /** Fields to always redact (default list) */
  default_sensitive_fields: z
    .array(z.string())
    .default([
      'password',
      'secret',
      'token',
      'api_key',
      'private_key',
      'credential',
      'auth',
      'authorization',
      'access_token',
      'refresh_token',
    ]),
});

export type RedactionConfig = z.infer<typeof RedactionConfigSchema>;

/**
 * Default redaction configuration
 */
export const defaultRedactionConfig: RedactionConfig = {
  enabled: true,
  hints: [],
  global_patterns: [
    { pattern: 'Bearer [a-zA-Z0-9_\-\.]+', replacement: 'Bearer ***' },
    { pattern: 'Basic [a-zA-Z0-9=]+', replacement: 'Basic ***' },
    { pattern: 'api[_-]?key[=:]\s*[^\s&]+', replacement: 'api_key=***' },
  ],
  default_sensitive_fields: [
    'password',
    'secret',
    'token',
    'api_key',
    'private_key',
    'credential',
    'auth',
    'authorization',
  ],
};

/**
 * Redact sensitive data from an object
 * @param obj - Object to redact
 * @param config - Redaction configuration
 * @returns Redacted object
 */
export function redact<T extends Record<string, unknown>>(
  obj: T,
  config: RedactionConfig = defaultRedactionConfig
): T {
  if (!config.enabled) {
    return obj;
  }

  const redacted = { ...obj };

  // Redact default sensitive fields
  for (const field of config.default_sensitive_fields) {
    if (field in redacted) {
      (redacted as Record<string, unknown>)[field] = '***';
    }
  }

  // Apply specific hints
  for (const hint of config.hints) {
    const value = getNestedValue(redacted, hint.field);
    if (value !== undefined) {
      const redactedValue = applyRedactionStrategy(value, hint.strategy);
      setNestedValue(redacted, hint.field, redactedValue);
    }
  }

  return redacted;
}

/**
 * Redact a string value
 * @param value - String to redact
 * @param config - Redaction configuration
 * @returns Redacted string
 */
export function redactString(
  value: string,
  config: RedactionConfig = defaultRedactionConfig
): string {
  if (!config.enabled) {
    return value;
  }

  let redacted = value;

  // Apply global patterns
  for (const { pattern, replacement } of config.global_patterns) {
    redacted = redacted.replace(new RegExp(pattern, 'gi'), replacement);
  }

  return redacted;
}

/**
 * Get nested value by dot notation path
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }

  return current;
}

/**
 * Set nested value by dot notation path
 */
function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let current: Record<string, unknown> = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!(part in current)) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }

  current[parts[parts.length - 1]] = value;
}

/**
 * Apply redaction strategy to a value
 */
function applyRedactionStrategy(
  value: unknown,
  strategy: 'mask' | 'hash' | 'omit' | 'encrypt'
): unknown {
  switch (strategy) {
    case 'mask':
      return typeof value === 'string' ? '***' : '[REDACTED]';
    case 'hash':
      return `[HASH:${hashValue(String(value)).slice(0, 8)}]`;
    case 'omit':
      return undefined;
    case 'encrypt':
      return '[ENCRYPTED]';
    default:
      return '***';
  }
}

/**
 * Simple hash function for redaction
 */
function hashValue(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    const char = value.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}
