import { describe, it, expect } from 'vitest';
import {
  redact,
  redactString,
  defaultRedactionConfig,
} from '../src/redaction.js';

describe('Redaction', () => {
  describe('redact', () => {
    it('should redact default sensitive fields', () => {
      const obj = {
        username: 'john',
        password: 'secret123',
        api_key: 'key-abc',
      };
      
      const redacted = redact(obj);
      
      expect(redacted.username).toBe('john');
      expect(redacted.password).toBe('***');
      expect(redacted.api_key).toBe('***');
    });
    
    it('should not redact when disabled', () => {
      const obj = { password: 'secret' };
      const config = { ...defaultRedactionConfig, enabled: false };
      
      const redacted = redact(obj, config);
      
      expect(redacted.password).toBe('secret');
    });
    
    it('should apply hint-based redaction', () => {
      const obj = {
        public: 'visible',
        sensitive: 'secret data',
      };
      
      const config = {
        ...defaultRedactionConfig,
        hints: [
          { field: 'sensitive', reason: 'test', severity: 'high', strategy: 'mask' },
        ],
      };
      
      const redacted = redact(obj, config);
      
      expect(redacted.public).toBe('visible');
      expect(redacted.sensitive).toBe('***');
    });
    
    it('should handle nested field hints', () => {
      const obj = {
        user: {
          name: 'John',
          ssn: '123-45-6789',
        },
      };
      
      const config = {
        ...defaultRedactionConfig,
        hints: [
          { field: 'user.ssn', reason: 'PII', severity: 'critical', strategy: 'mask' },
        ],
      };
      
      const redacted = redact(obj, config);
      
      expect((redacted.user as Record<string, unknown>).name).toBe('John');
      expect((redacted.user as Record<string, unknown>).ssn).toBe('***');
    });
  });
  
  describe('redactString', () => {
    it('should redact Bearer tokens', () => {
      const str = 'Authorization: Bearer eyJhbGciOiJIUzI1NiIs';
      const redacted = redactString(str);
      
      expect(redacted).toBe('Authorization: Bearer ***');
    });
    
    it('should redact Basic auth', () => {
      const str = 'Authorization: Basic dXNlcjpwYXNz';
      const redacted = redactString(str);
      
      expect(redacted).toBe('Authorization: Basic ***');
    });
    
    it('should redact API keys', () => {
      const str = 'api_key=secret123&other=value';
      const redacted = redactString(str);
      
      expect(redacted).toContain('api_key=***');
    });
    
    it('should handle multiple patterns', () => {
      const str = 'Bearer token123 and api_key=secret456';
      const redacted = redactString(str);
      
      expect(redacted).toContain('Bearer ***');
      expect(redacted).toContain('api_key=***');
    });
  });
});