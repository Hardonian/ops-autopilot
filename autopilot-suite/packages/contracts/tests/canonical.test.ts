import { describe, it, expect } from 'vitest';
import {
  canonicalizeJSON,
  stableHash,
  shortHash,
  deepEqual,
  contentAddressableId,
  sortKeys,
  removeUndefined,
  canonicalize,
} from '../src/canonical.js';

describe('Canonicalization', () => {
  describe('canonicalizeJSON', () => {
    it('should serialize primitives consistently', () => {
      expect(canonicalizeJSON(null)).toBe('null');
      expect(canonicalizeJSON(true)).toBe('true');
      expect(canonicalizeJSON(false)).toBe('false');
      expect(canonicalizeJSON(42)).toBe('42');
      expect(canonicalizeJSON('hello')).toBe('"hello"');
    });
    
    it('should serialize arrays consistently', () => {
      expect(canonicalizeJSON([1, 2, 3])).toBe('[1,2,3]');
      expect(canonicalizeJSON(['a', 'b'])).toBe('["a","b"]');
    });
    
    it('should serialize objects with sorted keys', () => {
      const obj1 = { z: 1, a: 2, m: 3 };
      const obj2 = { a: 2, m: 3, z: 1 };
      
      expect(canonicalizeJSON(obj1)).toBe(canonicalizeJSON(obj2));
      expect(canonicalizeJSON(obj1)).toBe('{"a":2,"m":3,"z":1}');
    });
    
    it('should handle nested objects', () => {
      const obj = { b: { d: 1, c: 2 }, a: 3 };
      expect(canonicalizeJSON(obj)).toBe('{"a":3,"b":{"c":2,"d":1}}');
    });
  });
  
  describe('stableHash', () => {
    it('should produce consistent hashes', () => {
      const obj1 = { z: 1, a: 2 };
      const obj2 = { a: 2, z: 1 };
      
      expect(stableHash(obj1)).toBe(stableHash(obj2));
    });
    
    it('should produce different hashes for different data', () => {
      expect(stableHash({ a: 1 })).not.toBe(stableHash({ a: 2 }));
    });
    
    it('should produce 64-character hex string', () => {
      const hash = stableHash({ test: true });
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });
  
  describe('shortHash', () => {
    it('should produce 16-character string', () => {
      const hash = shortHash({ test: true });
      expect(hash).toHaveLength(16);
    });
    
    it('should be prefix of full hash', () => {
      const data = { test: true };
      expect(stableHash(data).startsWith(shortHash(data))).toBe(true);
    });
  });
  
  describe('deepEqual', () => {
    it('should return true for equal objects', () => {
      expect(deepEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
    });
    
    it('should return false for different objects', () => {
      expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false);
    });
    
    it('should handle nested objects', () => {
      expect(deepEqual(
        { a: { b: 1 } },
        { a: { b: 1 } }
      )).toBe(true);
      
      expect(deepEqual(
        { a: { b: 1 } },
        { a: { b: 2 } }
      )).toBe(false);
    });
  });
  
  describe('contentAddressableId', () => {
    it('should generate ID with prefix', () => {
      const id = contentAddressableId({ test: true }, 'doc');
      expect(id.startsWith('doc-')).toBe(true);
    });
    
    it('should generate consistent IDs', () => {
      const data = { a: 1, b: 2 };
      expect(contentAddressableId(data)).toBe(contentAddressableId(data));
    });
  });
  
  describe('sortKeys', () => {
    it('should sort object keys', () => {
      const sorted = sortKeys({ z: 1, a: 2 });
      expect(Object.keys(sorted)).toEqual(['a', 'z']);
    });
    
    it('should sort nested objects', () => {
      const sorted = sortKeys({ b: { d: 1, c: 2 }, a: 3 });
      expect(Object.keys(sorted.b as Record<string, unknown>)).toEqual(['c', 'd']);
    });
  });
  
  describe('removeUndefined', () => {
    it('should remove undefined values', () => {
      const cleaned = removeUndefined({ a: 1, b: undefined, c: 2 });
      expect(cleaned).toEqual({ a: 1, c: 2 });
    });
    
    it('should handle nested objects', () => {
      const cleaned = removeUndefined({
        a: { b: undefined, c: 1 },
        d: undefined,
      });
      expect(cleaned).toEqual({ a: { c: 1 } });
    });
    
    it('should preserve null values', () => {
      const cleaned = removeUndefined({ a: null, b: undefined });
      expect(cleaned).toEqual({ a: null });
    });
  });
  
  describe('canonicalize', () => {
    it('should sort keys and remove undefined', () => {
      const canonical = canonicalize({
        z: { b: undefined, a: 1 },
        a: 2,
      });
      
      expect(canonical).toEqual({
        a: 2,
        z: { a: 1 },
      });
    });
  });
});