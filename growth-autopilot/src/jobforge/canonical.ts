import { createHash } from 'crypto';

export type CanonicalJsonValue = string | number | boolean | null | CanonicalJsonValue[] | { [key: string]: CanonicalJsonValue };

export function canonicalizeValue(value: unknown): CanonicalJsonValue | undefined {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalizeValue(item) ?? null);
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const sortedKeys = Object.keys(record).sort();
    const result: Record<string, CanonicalJsonValue> = {};

    for (const key of sortedKeys) {
      const converted = canonicalizeValue(record[key]);
      if (converted !== undefined) {
        result[key] = converted;
      }
    }

    return result;
  }

  if (value === undefined) {
    return undefined;
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null) {
    return value;
  }

  return String(value);
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(canonicalizeValue(value));
}

export function stablePrettyStringify(value: unknown): string {
  return JSON.stringify(canonicalizeValue(value), null, 2);
}

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function hashCanonicalJson(value: unknown): { canonical_json: string; hash: string } {
  const canonical_json = stableStringify(value);
  return {
    canonical_json,
    hash: sha256Hex(canonical_json),
  };
}
