/**
 * Canonicalization and stable hashing utilities
 * 
 * These utilities ensure that data can be consistently serialized
 * and hashed for deduplication, caching, and integrity verification.
 */

import { createHash } from 'crypto';

/**
 * Canonical JSON serialization
 * 
 * Produces a deterministic, sorted JSON representation suitable
 * for hashing and comparison. Handles nested objects consistently.
 * 
 * @param value - Value to serialize
 * @returns Canonical JSON string
 */
export function canonicalizeJSON(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'null';
  
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return JSON.stringify(value);
  
  if (Array.isArray(value)) {
    const items = value.map(canonicalizeJSON);
    return '[' + items.join(',') + ']';
  }
  
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    const pairs = keys.map((key) => {
      const canonicalKey = JSON.stringify(key);
      const canonicalValue = canonicalizeJSON(obj[key]);
      return `${canonicalKey}:${canonicalValue}`;
    });
    return '{' + pairs.join(',') + '}';
  }
  
  return 'null';
}

/**
 * Compute stable hash of a value
 * 
 * Uses SHA-256 of the canonical JSON representation.
 * 
 * @param value - Value to hash
 * @returns Hex-encoded SHA-256 hash
 */
export function stableHash(value: unknown): string {
  const canonical = canonicalizeJSON(value);
  return createHash('sha256').update(canonical).digest('hex');
}

/**
 * Compute short hash (first 16 chars) for display/IDs
 * 
 * @param value - Value to hash
 * @returns Short hash string
 */
export function shortHash(value: unknown): string {
  return stableHash(value).slice(0, 16);
}

/**
 * Deep equality check using canonical comparison
 * 
 * @param a - First value
 * @param b - Second value
 * @returns True if values are deeply equal
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  return canonicalizeJSON(a) === canonicalizeJSON(b);
}

/**
 * Create a content-addressable identifier
 * 
 * Generates an ID based on the content hash of the data.
 * Useful for deduplication and caching.
 * 
 * @param value - Value to identify
 * @param prefix - Optional prefix for the ID
 * @returns Content-addressable ID
 */
export function contentAddressableId(value: unknown, prefix?: string): string {
  const hash = shortHash(value);
  return prefix ? `${prefix}-${hash}` : hash;
}

/**
 * Sort object keys recursively for consistent serialization
 * 
 * @param obj - Object to sort
 * @returns New object with sorted keys
 */
export function sortKeys<T extends Record<string, unknown>>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(sortKeys) as T;
  }
  
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    const value = obj[key];
    sorted[key] = typeof value === 'object' && value !== null
      ? sortKeys(value as Record<string, unknown>)
      : value;
  }
  
  return sorted as T;
}

/**
 * Remove undefined values from object recursively
 * 
 * @param obj - Object to clean
 * @returns Cleaned object
 */
export function removeUndefined<T extends Record<string, unknown>>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj
      .filter((v) => v !== undefined)
      .map((v) => typeof v === 'object' && v !== null ? removeUndefined(v as Record<string, unknown>) : v) as T;
  }
  
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      cleaned[key] = typeof value === 'object' && value !== null
        ? removeUndefined(value as Record<string, unknown>)
        : value;
    }
  }
  
  return cleaned as T;
}

/**
 * Canonical object for storage/comparison
 * 
 * Removes undefined values and sorts keys for consistent representation.
 * 
 * @param obj - Object to canonicalize
 * @returns Canonical object
 */
export function canonicalize<T extends Record<string, unknown>>(obj: T): T {
  return sortKeys(removeUndefined(obj));
}