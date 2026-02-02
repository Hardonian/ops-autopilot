import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { scanSEO } from '../src/seo/index.js';
import type { TenantContext } from '../src/contracts/index.js';

describe('SEO Scanner', () => {
  let tempDir: string;
  const tenantContext: TenantContext = {
    tenant_id: 'test-tenant',
    project_id: 'test-project',
  };

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'seo-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Deterministic output', () => {
    it('produces stable output for same input', async () => {
      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Test Page</title>
            <meta name="description" content="Test description">
            <meta property="og:title" content="Test">
            <meta property="og:description" content="Test OG">
            <meta property="og:image" content="test.jpg">
            <link rel="canonical" href="https://example.com/test">
            <meta name="viewport" content="width=device-width, initial-scale=1">
          </head>
          <body>
            <h1>Test Heading</h1>
            <a href="/other">Link</a>
          </body>
        </html>
      `;

      await fs.writeFile(path.join(tempDir, 'index.html'), htmlContent);
      await fs.writeFile(path.join(tempDir, 'other.html'), htmlContent);

      const config = {
        tenant_context: tenantContext,
        source_path: tempDir,
        source_type: 'html_export' as const,
      };

      // Run scan twice
      const result1 = await scanSEO(config);
      const result2 = await scanSEO(config);

      // Should have identical issues (excluding timestamps)
      expect(result1.summary.total_pages).toBe(result2.summary.total_pages);
      expect(result1.summary.total_issues).toBe(result2.summary.total_issues);
      expect(result1.health_score.overall).toBe(result2.health_score.overall);
      expect(result1.issues.length).toBe(result2.issues.length);
    });

    it('detects missing title as critical issue', async () => {
      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta name="description" content="Test description">
          </head>
          <body>
            <h1>Test Heading</h1>
          </body>
        </html>
      `;

      await fs.writeFile(path.join(tempDir, 'index.html'), htmlContent);

      const config = {
        tenant_context: tenantContext,
        source_path: tempDir,
        source_type: 'html_export' as const,
      };

      const result = await scanSEO(config);

      const missingTitleIssue = result.issues.find((i) => i.type === 'missing_title');
      expect(missingTitleIssue).toBeDefined();
      expect(missingTitleIssue?.severity).toBe('critical');
    });

    it('detects missing meta description as warning', async () => {
      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Test Page</title>
          </head>
          <body>
            <h1>Test Heading</h1>
          </body>
        </html>
      `;

      await fs.writeFile(path.join(tempDir, 'index.html'), htmlContent);

      const config = {
        tenant_context: tenantContext,
        source_path: tempDir,
        source_type: 'html_export' as const,
      };

      const result = await scanSEO(config);

      const missingMetaIssue = result.issues.find((i) => i.type === 'missing_meta_description');
      expect(missingMetaIssue).toBeDefined();
      expect(missingMetaIssue?.severity).toBe('warning');
    });

    it('detects missing OG tags as warning', async () => {
      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Test Page</title>
            <meta name="description" content="Test description">
          </head>
          <body>
            <h1>Test Heading</h1>
          </body>
        </html>
      `;

      await fs.writeFile(path.join(tempDir, 'index.html'), htmlContent);

      const config = {
        tenant_context: tenantContext,
        source_path: tempDir,
        source_type: 'html_export' as const,
      };

      const result = await scanSEO(config);

      const missingOgIssue = result.issues.find((i) => i.type === 'missing_og_tags');
      expect(missingOgIssue).toBeDefined();
      expect(missingOgIssue?.severity).toBe('warning');
    });

    it('detects title that is too long', async () => {
      const longTitle = 'A'.repeat(70);
      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>${longTitle}</title>
            <meta name="description" content="Test description">
          </head>
          <body>
            <h1>Test Heading</h1>
          </body>
        </html>
      `;

      await fs.writeFile(path.join(tempDir, 'index.html'), htmlContent);

      const config = {
        tenant_context: tenantContext,
        source_path: tempDir,
        source_type: 'html_export' as const,
      };

      const result = await scanSEO(config);

      const longTitleIssue = result.issues.find((i) => i.type === 'title_too_long');
      expect(longTitleIssue).toBeDefined();
    });

    it('detects broken internal links', async () => {
      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Test Page</title>
            <meta name="description" content="Test description">
          </head>
          <body>
            <a href="/nonexistent">Broken Link</a>
            <a href="/existing">Good Link</a>
          </body>
        </html>
      `;

      await fs.writeFile(path.join(tempDir, 'index.html'), htmlContent);
      await fs.writeFile(path.join(tempDir, 'existing.html'), htmlContent);

      const config = {
        tenant_context: tenantContext,
        source_path: tempDir,
        source_type: 'html_export' as const,
      };

      const result = await scanSEO(config);

      const brokenLinkIssue = result.issues.find((i) => i.type === 'broken_link');
      expect(brokenLinkIssue).toBeDefined();
      expect(brokenLinkIssue?.page).toBeDefined(); // Page URL is '/' or '' for index
      expect(brokenLinkIssue?.message).toContain('nonexistent');
    });

    it('detects missing viewport meta tag', async () => {
      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Test Page</title>
            <meta name="description" content="Test description">
          </head>
          <body>
            <h1>Test Heading</h1>
          </body>
        </html>
      `;

      await fs.writeFile(path.join(tempDir, 'index.html'), htmlContent);

      const config = {
        tenant_context: tenantContext,
        source_path: tempDir,
        source_type: 'html_export' as const,
      };

      const result = await scanSEO(config);

      const viewportIssue = result.issues.find((i) => i.type === 'mobile_viewport_missing');
      expect(viewportIssue).toBeDefined();
    });

    it('detects noindex directive', async () => {
      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Test Page</title>
            <meta name="description" content="Test description">
            <meta name="robots" content="noindex, nofollow">
          </head>
          <body>
            <h1>Test Heading</h1>
          </body>
        </html>
      `;

      await fs.writeFile(path.join(tempDir, 'index.html'), htmlContent);

      const config = {
        tenant_context: tenantContext,
        source_path: tempDir,
        source_type: 'html_export' as const,
      };

      const result = await scanSEO(config);

      const noindexIssue = result.issues.find((i) => i.type === 'noindex_detected');
      expect(noindexIssue).toBeDefined();
    });

    it('calculates health score correctly', async () => {
      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Test Page</title>
          </head>
          <body>
            <h1>Test Heading</h1>
          </body>
        </html>
      `;

      await fs.writeFile(path.join(tempDir, 'index.html'), htmlContent);

      const config = {
        tenant_context: tenantContext,
        source_path: tempDir,
        source_type: 'html_export' as const,
      };

      const result = await scanSEO(config);

      expect(result.health_score.overall).toBeGreaterThanOrEqual(0);
      expect(result.health_score.overall).toBeLessThanOrEqual(100);
      expect(result.health_score.total_pages).toBe(1);
      expect(result.health_score.issues_by_severity.critical).toBeGreaterThanOrEqual(0);
    });

    it('generates opportunities', async () => {
      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Test Page</title>
          </head>
          <body>
            <h1>Test Heading</h1>
          </body>
        </html>
      `;

      await fs.writeFile(path.join(tempDir, 'index.html'), htmlContent);

      const config = {
        tenant_context: tenantContext,
        source_path: tempDir,
        source_type: 'html_export' as const,
      };

      const result = await scanSEO(config);

      expect(result.summary.opportunities).toBeDefined();
      expect(Array.isArray(result.summary.opportunities)).toBe(true);
    });
  });

  describe('Link checker', () => {
    it('correctly identifies valid internal links', async () => {
      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head><title>Test</title></head>
          <body>
            <a href="/about">About</a>
            <a href="/contact">Contact</a>
          </body>
        </html>
      `;

      await fs.writeFile(path.join(tempDir, 'index.html'), htmlContent);
      await fs.writeFile(path.join(tempDir, 'about.html'), htmlContent);
      await fs.writeFile(path.join(tempDir, 'contact.html'), htmlContent);

      const config = {
        tenant_context: tenantContext,
        source_path: tempDir,
        source_type: 'html_export' as const,
      };

      const result = await scanSEO(config);

      // Should not report broken links for existing pages
      const brokenAbout = result.issues.find(
        (i) => i.type === 'broken_link' && i.message.includes('about')
      );
      const brokenContact = result.issues.find(
        (i) => i.type === 'broken_link' && i.message.includes('contact')
      );

      expect(brokenAbout).toBeUndefined();
      expect(brokenContact).toBeUndefined();
    });

    it('correctly identifies broken internal links', async () => {
      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head><title>Test</title></head>
          <body>
            <a href="/missing">Missing Page</a>
          </body>
        </html>
      `;

      await fs.writeFile(path.join(tempDir, 'index.html'), htmlContent);

      const config = {
        tenant_context: tenantContext,
        source_path: tempDir,
        source_type: 'html_export' as const,
      };

      const result = await scanSEO(config);

      const brokenLink = result.issues.find((i) => i.type === 'broken_link');
      expect(brokenLink).toBeDefined();
      expect(brokenLink?.message).toContain('missing');
    });
  });
});
