import { describe, it, expect } from 'vitest';
import { draftContent } from '../src/content/index.js';
import { getProfile } from '../src/profiles/index.js';
import type { DrafterConfig } from '../src/content/index.js';
import type { TenantContext } from '../src/contracts/index.js';

describe('Content Drafter', () => {
  const tenantContext: TenantContext = {
    tenant_id: 'test-tenant',
    project_id: 'test-project',
  };

  describe('Draft content', () => {
    it('generates landing page content', () => {
      const profile = getProfile('base');
      const config: DrafterConfig = {
        tenant_context: tenantContext,
        content_type: 'landing_page',
        target_audience: 'Developers',
        goal: 'Increase signups',
        profile,
        variants_count: 2,
      };

      const draft = draftContent(config);

      expect(draft.content_type).toBe('landing_page');
      expect(draft.variants.length).toBe(2);
      expect(draft.profile_used).toBe('base');
      expect(draft.llm_provider).toBeNull();
    });

    it('generates onboarding email content', () => {
      const profile = getProfile('base');
      const config: DrafterConfig = {
        tenant_context: tenantContext,
        content_type: 'onboarding_email',
        target_audience: 'New users',
        goal: 'Activate users',
        profile,
        variants_count: 2,
      };

      const draft = draftContent(config);

      expect(draft.content_type).toBe('onboarding_email');
      expect(draft.variants.length).toBe(2);
      draft.variants.forEach((variant) => {
        expect(variant.headline).toBeDefined();
        expect(variant.body).toContain('{{first_name}}');
        expect(variant.cta).toBeDefined();
      });
    });

    it('generates changelog content', () => {
      const profile = getProfile('jobforge');
      const config: DrafterConfig = {
        tenant_context: tenantContext,
        content_type: 'changelog_note',
        target_audience: 'Existing users',
        goal: 'Announce new feature',
        profile,
        variants_count: 1,
      };

      const draft = draftContent(config);

      expect(draft.content_type).toBe('changelog_note');
      expect(draft.variants.length).toBe(1);
      expect(draft.variants[0]?.body).toContain(profile.features[0]?.name);
    });

    it('includes SEO keywords in variants', () => {
      const profile = getProfile('readylayer');
      const config: DrafterConfig = {
        tenant_context: tenantContext,
        content_type: 'landing_page',
        target_audience: 'DevOps engineers',
        goal: 'Get demo requests',
        profile,
        variants_count: 1,
      };

      const draft = draftContent(config);

      draft.variants.forEach((variant) => {
        expect(variant.seo_keywords.length).toBeGreaterThan(0);
        expect(variant.meta_description).toBeDefined();
      });
    });

    it('respects variants_count', () => {
      const profile = getProfile('base');
      const config: DrafterConfig = {
        tenant_context: tenantContext,
        content_type: 'landing_page',
        target_audience: 'Developers',
        goal: 'Increase signups',
        profile,
        variants_count: 3,
      };

      const draft = draftContent(config);

      expect(draft.variants.length).toBe(3);
    });

    it('includes evidence links', () => {
      const profile = getProfile('base');
      const config: DrafterConfig = {
        tenant_context: tenantContext,
        content_type: 'landing_page',
        target_audience: 'Developers',
        goal: 'Increase signups',
        profile,
      };

      const draft = draftContent(config);

      expect(draft.evidence.length).toBeGreaterThan(0);
      expect(draft.evidence.some((e) => e.signal === 'template_generation')).toBe(true);
      expect(draft.evidence.some((e) => e.signal === 'profile_applied')).toBe(true);
    });

    it('includes suggested experiments', () => {
      const profile = getProfile('base');
      const config: DrafterConfig = {
        tenant_context: tenantContext,
        content_type: 'landing_page',
        target_audience: 'Developers',
        goal: 'Increase signups',
        profile,
        variants_count: 2,
      };

      const draft = draftContent(config);

      expect(draft.suggested_experiments.length).toBeGreaterThan(0);
    });

    it('validates constraints', () => {
      const profile = getProfile('base');
      const config: DrafterConfig = {
        tenant_context: tenantContext,
        content_type: 'landing_page',
        target_audience: 'Developers',
        goal: 'Increase signups',
        profile,
      };

      const draft = draftContent(config);

      expect(draft.constraints_respected.prohibited_claims_checked).toBe(true);
      expect(draft.constraints_respected.brand_voice_matched).toBe(true);
      expect(draft.constraints_respected.character_limits_met).toBe(true);
    });

    it('recommends a variant', () => {
      const profile = getProfile('base');
      const config: DrafterConfig = {
        tenant_context: tenantContext,
        content_type: 'landing_page',
        target_audience: 'Developers',
        goal: 'Increase signups',
        profile,
        variants_count: 2,
      };

      const draft = draftContent(config);

      expect(draft.recommended_variant).toBeDefined();
      const variantNames = draft.variants.map((v) => v.name);
      expect(variantNames).toContain(draft.recommended_variant);
    });

    it('works with all profile types', () => {
      const profiles = ['base', 'jobforge', 'settler', 'readylayer', 'aias', 'keys'];
      
      profiles.forEach((profileId) => {
        const profile = getProfile(profileId);
        const config: DrafterConfig = {
          tenant_context: tenantContext,
          content_type: 'landing_page',
          target_audience: 'Test',
          goal: 'Test',
          profile,
        };

        expect(() => draftContent(config)).not.toThrow();
      });
    });

    it('generates different content for different content types', () => {
      const profile = getProfile('base');
      const types = ['landing_page', 'onboarding_email', 'changelog_note', 'blog_post'] as const;
      
      const drafts = types.map((type) =>
        draftContent({
          tenant_context: tenantContext,
          content_type: type,
          target_audience: 'Test',
          goal: 'Test',
          profile,
        })
      );

      // Each content type should have distinct structure
      drafts.forEach((draft, idx) => {
        expect(draft.content_type).toBe(types[idx]);
        expect(draft.variants[0]?.headline).toBeDefined();
        expect(draft.variants[0]?.body).toBeDefined();
      });
    });
  });
});
