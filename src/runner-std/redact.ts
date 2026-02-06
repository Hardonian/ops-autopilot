/**
 * Redaction Utility
 *
 * Denylist-based key redaction for logs and evidence artifacts.
 * Prevents secrets from leaking into output.
 */

const DEFAULT_DENY_KEYS = new Set([
  'password',
  'secret',
  'token',
  'api_key',
  'apikey',
  'api-key',
  'authorization',
  'auth_token',
  'access_token',
  'refresh_token',
  'private_key',
  'privatekey',
  'secret_key',
  'secretkey',
  'credential',
  'credentials',
  'aws_secret_access_key',
  'aws_access_key_id',
  'database_url',
  'connection_string',
  'session_token',
  'cookie',
  'x-api-key',
  'bearer',
  'client_secret',
]);

const REDACTED = '[REDACTED]';

export interface RedactOptions {
  /** Extra keys to redact (merged with defaults) */
  extraDenyKeys?: string[];
  /** Replacement string */
  replacement?: string;
}

function normKey(key: string): string {
  return key.toLowerCase().replace(/[-_\s]/g, '');
}

function isDenied(key: string, denySet: Set<string>): boolean {
  const norm = normKey(key);
  for (const denied of denySet) {
    if (norm === normKey(denied)) {
      return true;
    }
    if (norm.includes(normKey(denied))) {
      return true;
    }
  }
  return false;
}

export function redact(obj: unknown, opts: RedactOptions = {}): unknown {
  const denySet = new Set([...DEFAULT_DENY_KEYS, ...(opts.extraDenyKeys ?? [])]);
  const replacement = opts.replacement ?? REDACTED;
  return redactInner(obj, denySet, replacement, new WeakSet());
}

function redactInner(
  obj: unknown,
  denySet: Set<string>,
  replacement: string,
  seen: WeakSet<object>
): unknown {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') return obj;
  if (typeof obj === 'number' || typeof obj === 'boolean') return obj;

  if (Array.isArray(obj)) {
    return obj.map(item => redactInner(item, denySet, replacement, seen));
  }

  if (typeof obj === 'object') {
    if (seen.has(obj)) return replacement;
    seen.add(obj);

    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (isDenied(key, denySet)) {
        result[key] = replacement;
      } else {
        result[key] = redactInner(value, denySet, replacement, seen);
      }
    }
    return result;
  }

  return obj;
}

/**
 * Redact a string, replacing any value that looks like
 * key=value or "key": "value" for denied keys.
 */
export function redactString(input: string, opts: RedactOptions = {}): string {
  const denySet = new Set([...DEFAULT_DENY_KEYS, ...(opts.extraDenyKeys ?? [])]);
  const replacement = opts.replacement ?? REDACTED;

  let output = input;
  for (const key of denySet) {
    // key=value patterns (env vars, query strings)
    const envRegex = new RegExp(`(${escapeRegex(key)}\\s*[=:]\\s*)([^\\s,;"'\\}\\]]+)`, 'gi');
    output = output.replace(envRegex, `$1${replacement}`);

    // JSON "key": "value" patterns
    const jsonRegex = new RegExp(
      `("${escapeRegex(key)}"\\s*:\\s*)"[^"]*"`,
      'gi'
    );
    output = output.replace(jsonRegex, `$1"${replacement}"`);
  }
  return output;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export { DEFAULT_DENY_KEYS, REDACTED };
