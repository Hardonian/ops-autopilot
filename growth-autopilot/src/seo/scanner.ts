import * as cheerio from 'cheerio';
import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import type {
  SEOFindings,
  SEOIssue,
  SEOHealthScore,
  TenantContext,
  Evidence,
} from '../contracts/index.js';
import { SEOFindingsSchema } from '../contracts/index.js';
import { now, normalizePath, extractDomain, isAbsoluteUrl } from '../utils/index.js';

/**
 * SEO Scanner configuration
 */
export interface SEOScannerConfig {
  tenant_context: TenantContext;
  source_path: string;
  source_type: 'nextjs_routes' | 'html_export' | 'sitemap';
  base_url?: string;
  max_pages?: number;
  follow_links?: boolean;
}

/**
 * Page analysis result
 */
interface PageAnalysis {
  url: string;
  file_path: string;
  title: string | null;
  meta_description: string | null;
  og_title: string | null;
  og_description: string | null;
  og_image: string | null;
  canonical: string | null;
  robots: string | null;
  viewport: string | null;
  links: Array<{ href: string; text: string; is_external: boolean }>;
  headings: { h1: string[]; h2: string[]; h3: string[] };
  has_sitemap_hint: boolean;
  has_robots_hint: boolean;
}

/**
 * Scan a site for SEO issues
 * Works without LLM - pure deterministic analysis
 */
export async function scanSEO(config: SEOScannerConfig): Promise<SEOFindings> {
  const pages = await loadPages(config);
  const issues: SEOIssue[] = [];
  const titleMap = new Map<string, string[]>();
  const metaMap = new Map<string, string[]>();

  // Analyze each page
  for (const page of pages) {
    const pageIssues = analyzePage(page, config.base_url);
    issues.push(...pageIssues);

    // Track duplicates
    if (page.title) {
      const existing = titleMap.get(page.title) ?? [];
      existing.push(page.url);
      titleMap.set(page.title, existing);
    }
    if (page.meta_description) {
      const existing = metaMap.get(page.meta_description) ?? [];
      existing.push(page.url);
      metaMap.set(page.meta_description, existing);
    }
  }

  // Detect duplicate titles and meta descriptions
  for (const [title, urls] of titleMap) {
    if (urls.length > 1) {
      issues.push({
        type: 'duplicate_title',
        page: urls[0],
        severity: 'warning',
        message: `Duplicate title found on ${urls.length} pages`,
        evidence: {
          signal: 'duplicate_title',
          location: urls.join(', '),
          severity: 'warning',
          raw_value: title,
        },
        recommendation: `Make title unique across pages. Currently: "${title}"`,
      });
    }
  }

  for (const [meta, urls] of metaMap) {
    if (urls.length > 1) {
      issues.push({
        type: 'duplicate_meta',
        page: urls[0],
        severity: 'warning',
        message: `Duplicate meta description found on ${urls.length} pages`,
        evidence: {
          signal: 'duplicate_meta',
          location: urls.join(', '),
          severity: 'warning',
          raw_value: meta,
        },
        recommendation: 'Make meta description unique across pages',
      });
    }
  }

  // Check for broken internal links
  const pageUrls = new Set(pages.map((p) => normalizePath(p.url)));
  for (const page of pages) {
    for (const link of page.links) {
      if (!link.is_external && !isAbsoluteUrl(link.href)) {
        const normalizedLink = normalizePath(link.href);
        if (!pageUrls.has(normalizedLink) && normalizedLink !== '/') {
          issues.push({
            type: 'broken_link',
            page: page.url,
            severity: 'warning',
            message: `Broken internal link: ${link.href}`,
            evidence: {
              signal: 'broken_link',
              location: `${page.url} -> ${link.href}`,
              severity: 'warning',
            },
            recommendation: `Fix or remove link to "${link.href}"`,
          });
        }
      }
    }
  }

  // Calculate health score
  const healthScore = calculateHealthScore(pages.length, issues);

  // Build findings
  const findings: SEOFindings = {
    tenant_context: config.tenant_context,
    scanned_at: now(),
    source_type: config.source_type,
    source_path: config.source_path,
    health_score: healthScore,
    issues,
    summary: {
      total_pages: pages.length,
      total_issues: issues.length,
      actionable_items: issues.filter((i) => i.severity !== 'info').length,
      opportunities: generateOpportunities(pages, issues),
    },
  };

  // Validate output
  const validated = SEOFindingsSchema.parse(findings);
  return validated;
}

/**
 * Load pages from HTML export or Next.js routes
 */
async function loadPages(config: SEOScannerConfig): Promise<PageAnalysis[]> {
  const pages: PageAnalysis[] = [];

  if (config.source_type === 'html_export') {
    // Scan HTML files in directory
    const htmlFiles = await glob('**/*.html', {
      cwd: config.source_path,
      absolute: true,
    });

    for (const file of htmlFiles.slice(0, config.max_pages ?? 1000)) {
      const content = await fs.readFile(file, 'utf-8');
      const relativePath = path.relative(config.source_path, file);
      const url = relativePath.replace(/index\.html$/, '').replace(/\.html$/, '');
      const page = parseHTML(content, url, file);
      pages.push(page);
    }
  } else if (config.source_type === 'nextjs_routes') {
    // Scan Next.js app directory for page files
    const pageFiles = await glob('**/page.{tsx,jsx,ts,js}', {
      cwd: config.source_path,
      absolute: true,
    });

    for (const file of pageFiles.slice(0, config.max_pages ?? 1000)) {
      // For Next.js routes, we can't parse the actual HTML without building
      // Create placeholder analysis based on file structure
      const relativePath = path.relative(config.source_path, file);
      const route = relativePath
        .replace(/\/?page\.(tsx|jsx|ts|js)$/, '')
        .replace(/\[([^\]]+)\]/g, ':$1');

      pages.push({
        url: route || '/',
        file_path: file,
        title: null, // Would need metadata extraction
        meta_description: null,
        og_title: null,
        og_description: null,
        og_image: null,
        canonical: null,
        robots: null,
        viewport: null,
        links: [],
        headings: { h1: [], h2: [], h3: [] },
        has_sitemap_hint: false,
        has_robots_hint: false,
      });
    }
  }

  return pages;
}

/**
 * Parse HTML content and extract SEO-relevant data
 */
function parseHTML(
  html: string,
  url: string,
  file_path: string
): PageAnalysis {
  const $ = cheerio.load(html);

  // Extract meta tags
  const title = $('title').text() || null;
  const meta_description = $('meta[name="description"]').attr('content') || null;
  const og_title = $('meta[property="og:title"]').attr('content') || null;
  const og_description = $('meta[property="og:description"]').attr('content') || null;
  const og_image = $('meta[property="og:image"]').attr('content') || null;
  const canonical = $('link[rel="canonical"]').attr('href') || null;
  const robots = $('meta[name="robots"]').attr('content') || null;
  const viewport = $('meta[name="viewport"]').attr('content') || null;

  // Extract links
  const links: Array<{ href: string; text: string; is_external: boolean }> = [];
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const text = $(el).text().trim();
    const is_external = isAbsoluteUrl(href) && !href.includes(url);
    links.push({ href, text, is_external });
  });

  // Extract headings
  const headings = {
    h1: $('h1')
      .map((_, el) => $(el).text().trim())
      .get(),
    h2: $('h2')
      .map((_, el) => $(el).text().trim())
      .get(),
    h3: $('h3')
      .map((_, el) => $(el).text().trim())
      .get(),
  };

  // Check for sitemap/robots hints in comments
  const htmlComments = html.match(/<!--[\s\S]*?-->/g) || [];
  const has_sitemap_hint = htmlComments.some((c) =>
    c.toLowerCase().includes('sitemap')
  );
  const has_robots_hint = htmlComments.some((c) =>
    c.toLowerCase().includes('robots')
  );

  return {
    url,
    file_path,
    title,
    meta_description,
    og_title,
    og_description,
    og_image,
    canonical,
    robots,
    viewport,
    links,
    headings,
    has_sitemap_hint,
    has_robots_hint,
  };
}

/**
 * Analyze a single page for SEO issues
 */
function analyzePage(
  page: PageAnalysis,
  baseUrl?: string
): SEOIssue[] {
  const issues: SEOIssue[] = [];

  // Check for missing title
  if (!page.title) {
    issues.push({
      type: 'missing_title',
      page: page.url,
      severity: 'critical',
      message: 'Missing page title',
      evidence: {
        signal: 'missing_tag',
        location: page.file_path,
        severity: 'critical',
        raw_value: null,
      },
      recommendation: 'Add a descriptive <title> tag (50-60 characters)',
    });
  } else if (page.title.length > 60) {
    issues.push({
      type: 'title_too_long',
      page: page.url,
      severity: 'warning',
      message: `Title too long (${page.title.length} chars)`,
      evidence: {
        signal: 'length_exceeded',
        location: page.url,
        severity: 'warning',
        raw_value: page.title.length,
      },
      recommendation: 'Shorten title to 50-60 characters for optimal display',
    });
  }

  // Check for missing meta description
  if (!page.meta_description) {
    issues.push({
      type: 'missing_meta_description',
      page: page.url,
      severity: 'warning',
      message: 'Missing meta description',
      evidence: {
        signal: 'missing_tag',
        location: page.file_path,
        severity: 'warning',
        raw_value: null,
      },
      recommendation: 'Add a meta description (150-160 characters)',
    });
  } else if (page.meta_description.length > 160) {
    issues.push({
      type: 'meta_too_long',
      page: page.url,
      severity: 'info',
      message: `Meta description too long (${page.meta_description.length} chars)`,
      evidence: {
        signal: 'length_exceeded',
        location: page.url,
        severity: 'info',
        raw_value: page.meta_description.length,
      },
      recommendation: 'Shorten meta description to 150-160 characters',
    });
  }

  // Check for missing OG tags
  if (!page.og_title || !page.og_description || !page.og_image) {
    const missingOgTags = [];
    if (!page.og_title) missingOgTags.push('og:title');
    if (!page.og_description) missingOgTags.push('og:description');
    if (!page.og_image) missingOgTags.push('og:image');

    issues.push({
      type: 'missing_og_tags',
      page: page.url,
      severity: 'warning',
      message: `Missing Open Graph tags: ${missingOgTags.join(', ')}`,
      evidence: {
        signal: 'missing_tag',
        location: page.file_path,
        severity: 'warning',
        raw_value: missingOgTags,
      },
      recommendation: 'Add Open Graph tags for better social sharing',
    });
  }

  // Check for missing canonical
  if (!page.canonical) {
    issues.push({
      type: 'missing_canonical',
      page: page.url,
      severity: 'info',
      message: 'Missing canonical URL',
      evidence: {
        signal: 'missing_tag',
        location: page.file_path,
        severity: 'info',
        raw_value: null,
      },
      recommendation: 'Add canonical link tag to prevent duplicate content issues',
    });
  }

  // Check for noindex
  if (page.robots?.toLowerCase().includes('noindex')) {
    issues.push({
      type: 'noindex_detected',
      page: page.url,
      severity: 'warning',
      message: 'Page has noindex directive',
      evidence: {
        signal: 'blocking_tag',
        location: page.url,
        severity: 'warning',
        raw_value: page.robots,
      },
      recommendation: 'Verify this page should not be indexed by search engines',
    });
  }

  // Check for mobile viewport
  if (!page.viewport) {
    issues.push({
      type: 'mobile_viewport_missing',
      page: page.url,
      severity: 'warning',
      message: 'Missing mobile viewport meta tag',
      evidence: {
        signal: 'missing_tag',
        location: page.file_path,
        severity: 'warning',
        raw_value: null,
      },
      recommendation: 'Add viewport meta tag for mobile responsiveness',
    });
  }

  return issues;
}

/**
 * Calculate overall health score
 */
function calculateHealthScore(
  totalPages: number,
  issues: SEOIssue[]
): SEOHealthScore {
  const critical = issues.filter((i) => i.severity === 'critical').length;
  const warning = issues.filter((i) => i.severity === 'warning').length;
  const info = issues.filter((i) => i.severity === 'info').length;
  const opportunity = issues.filter((i) => i.severity === 'opportunity').length;

  // Calculate weighted score
  const criticalWeight = 10;
  const warningWeight = 3;
  const infoWeight = 1;
  const opportunityWeight = 0;

  const maxScore = totalPages * 20; // Assume 20 points possible per page
  const deductions =
    critical * criticalWeight +
    warning * warningWeight +
    info * infoWeight +
    opportunity * opportunityWeight;

  const overall = Math.max(0, Math.min(100, 100 - (deductions / maxScore) * 100));

  // Calculate category scores
  const categories: Record<string, number> = {};
  const issueTypes = new Set(issues.map((i) => i.type));

  for (const type of issueTypes) {
    const typeIssues = issues.filter((i) => i.type === type);
    const typeCritical = typeIssues.filter((i) => i.severity === 'critical').length;
    const typeWarning = typeIssues.filter((i) => i.severity === 'warning').length;
    const typeInfo = typeIssues.filter((i) => i.severity === 'info').length;

    const typeDeductions =
      typeCritical * criticalWeight +
      typeWarning * warningWeight +
      typeInfo * infoWeight;

    categories[type] = Math.max(0, 100 - (typeDeductions / totalPages) * 10);
  }

  return {
    overall: Math.round(overall),
    categories,
    total_pages: totalPages,
    issues_by_severity: {
      critical,
      warning,
      info,
      opportunity,
    },
  };
}

/**
 * Generate opportunities list from findings
 */
function generateOpportunities(
  pages: PageAnalysis[],
  issues: SEOIssue[]
): string[] {
  const opportunities: string[] = [];

  // Check for quick wins
  const missingOg = issues.filter((i) => i.type === 'missing_og_tags').length;
  if (missingOg > 0) {
    opportunities.push(`Add Open Graph tags to ${missingOg} pages for better social sharing`);
  }

  const missingMeta = issues.filter((i) => i.type === 'missing_meta_description').length;
  if (missingMeta > 0) {
    opportunities.push(`Write meta descriptions for ${missingMeta} pages to improve CTR`);
  }

  // Check for content opportunities
  const pagesWithoutH1 = pages.filter((p) => p.headings.h1.length === 0).length;
  if (pagesWithoutH1 > 0) {
    opportunities.push(`${pagesWithoutH1} pages lack H1 headings - add primary keywords`);
  }

  // Suggest internal linking
  const avgLinks = pages.reduce((sum, p) => sum + p.links.length, 0) / pages.length;
  if (avgLinks < 3) {
    opportunities.push('Improve internal linking - avg 3+ links per page recommended');
  }

  return opportunities;
}

export { type PageAnalysis };
