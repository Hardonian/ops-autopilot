import { describe, it, expect } from 'vitest';
import {
  generateId,
  now,
  safeJsonParse,
  truncate,
  calculatePercentageChange,
  deepClone,
  groupBy,
  percentile,
  isAbsoluteUrl,
  normalizePath,
  extractDomain,
} from '../src/utils/index.js';

describe('Utilities', () => {
  describe('generateId', () => {
    it('generates unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
    });

    it('includes prefix when provided', () => {
      const id = generateId('test');
      expect(id.startsWith('test-')).toBe(true);
    });

    it('generates string IDs', () => {
      const id = generateId();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });
  });

  describe('now', () => {
    it('returns ISO string', () => {
      const timestamp = now();
      expect(typeof timestamp).toBe('string');
      expect(new Date(timestamp).toISOString()).toBe(timestamp);
    });

    it('returns current time', () => {
      const before = new Date().getTime();
      const timestamp = now();
      const after = new Date().getTime();
      
      const timestampMs = new Date(timestamp).getTime();
      expect(timestampMs).toBeGreaterThanOrEqual(before - 1000);
      expect(timestampMs).toBeLessThanOrEqual(after + 1000);
    });
  });

  describe('safeJsonParse', () => {
    it('parses valid JSON', () => {
      const result = safeJsonParse('{"key": "value"}', {});
      expect(result).toEqual({ key: 'value' });
    });

    it('returns default on invalid JSON', () => {
      const defaultValue = { fallback: true };
      const result = safeJsonParse('invalid json', defaultValue);
      expect(result).toEqual(defaultValue);
    });

    it('returns default on empty string', () => {
      const defaultValue = [];
      const result = safeJsonParse('', defaultValue);
      expect(result).toEqual(defaultValue);
    });
  });

  describe('truncate', () => {
    it('truncates long strings', () => {
      const long = 'a'.repeat(100);
      const truncated = truncate(long, 50);
      expect(truncated.length).toBe(50);
      expect(truncated.endsWith('...')).toBe(true);
    });

    it('returns short strings unchanged', () => {
      const short = 'short';
      const result = truncate(short, 50);
      expect(result).toBe(short);
    });

    it('handles exact length', () => {
      const exact = 'a'.repeat(50);
      const result = truncate(exact, 50);
      expect(result).toBe(exact);
    });
  });

  describe('calculatePercentageChange', () => {
    it('calculates positive change', () => {
      const change = calculatePercentageChange(150, 100);
      expect(change).toBe(50);
    });

    it('calculates negative change', () => {
      const change = calculatePercentageChange(50, 100);
      expect(change).toBe(-50);
    });

    it('handles zero previous value', () => {
      const change = calculatePercentageChange(100, 0);
      expect(change).toBe(100);
    });

    it('handles zero current value', () => {
      const change = calculatePercentageChange(0, 100);
      expect(change).toBe(-100);
    });
  });

  describe('deepClone', () => {
    it('clones objects', () => {
      const original = { a: 1, b: { c: 2 } };
      const clone = deepClone(original);
      
      expect(clone).toEqual(original);
      expect(clone).not.toBe(original);
      expect(clone.b).not.toBe(original.b);
    });

    it('clones arrays', () => {
      const original = [1, 2, { a: 3 }];
      const clone = deepClone(original);
      
      expect(clone).toEqual(original);
      expect(clone).not.toBe(original);
    });
  });

  describe('groupBy', () => {
    it('groups by key function', () => {
      const items = [
        { type: 'a', value: 1 },
        { type: 'b', value: 2 },
        { type: 'a', value: 3 },
      ];
      
      const grouped = groupBy(items, (item) => item.type);
      
      expect(grouped.a).toHaveLength(2);
      expect(grouped.b).toHaveLength(1);
    });

    it('handles empty array', () => {
      const grouped = groupBy([], () => 'key');
      expect(Object.keys(grouped)).toHaveLength(0);
    });
  });

  describe('percentile', () => {
    it('calculates 50th percentile (median)', () => {
      const arr = [1, 2, 3, 4, 5];
      const p50 = percentile(arr, 50);
      expect(p50).toBe(3);
    });

    it('calculates 90th percentile', () => {
      const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const p90 = percentile(arr, 90);
      expect(p90).toBeCloseTo(9.1, 0);
    });

    it('handles empty array', () => {
      const p = percentile([], 50);
      expect(p).toBe(0);
    });

    it('handles single element', () => {
      const p = percentile([5], 50);
      expect(p).toBe(5);
    });
  });

  describe('isAbsoluteUrl', () => {
    it('detects http URLs', () => {
      expect(isAbsoluteUrl('http://example.com')).toBe(true);
    });

    it('detects https URLs', () => {
      expect(isAbsoluteUrl('https://example.com')).toBe(true);
    });

    it('returns false for relative paths', () => {
      expect(isAbsoluteUrl('/path/to/page')).toBe(false);
    });

    it('returns false for relative URLs', () => {
      expect(isAbsoluteUrl('page.html')).toBe(false);
    });
  });

  describe('normalizePath', () => {
    it('removes trailing slash', () => {
      expect(normalizePath('/path/')).toBe('/path');
    });

    it('handles root path', () => {
      expect(normalizePath('/')).toBe('/');
    });

    it('normalizes multiple slashes', () => {
      expect(normalizePath('//path//to//page')).toBe('/path/to/page');
    });
  });

  describe('extractDomain', () => {
    it('extracts domain from URL', () => {
      expect(extractDomain('https://example.com/path')).toBe('example.com');
    });

    it('handles www subdomain', () => {
      expect(extractDomain('https://www.example.com')).toBe('www.example.com');
    });

    it('returns null for invalid URL', () => {
      expect(extractDomain('not-a-url')).toBeNull();
    });

    it('handles URLs with ports', () => {
      expect(extractDomain('https://example.com:8080')).toBe('example.com');
    });
  });
});
