#!/usr/bin/env node
import { Command } from 'commander';
import * as fs from 'fs/promises';
import * as path from 'path';
import chalk from 'chalk';

import { scanSEO, type SEOScannerConfig } from './seo/index.js';
import { analyzeFunnel, loadEventsFromFile, detectFunnelPatterns, type FunnelConfig, type FunnelEvent } from './funnel/index.js';
import { proposeExperiments, rankProposals, type ProposerConfig } from './experiments/index.js';
import { draftContent, type DrafterConfig } from './content/index.js';
import { createSEOScanJob, createExperimentJob, createContentDraftJob, serializeJobRequest } from './jobforge/index.js';
import { getProfile, listProfiles } from './profiles/index.js';
import type { TenantContext } from './contracts/index.js';

const program = new Command();

program
  .name('growth')
  .description('Growth Autopilot - Runnerless growth automation')
  .version('0.1.0');

// Helper to get tenant context from options
function getTenantContext(options: { tenant?: string; project?: string }): TenantContext {
  const tenant_id = options.tenant ?? process.env.GROWTH_TENANT_ID ?? 'default';
  const project_id = options.project ?? process.env.GROWTH_PROJECT_ID ?? 'default';
  return { tenant_id, project_id };
}

// SEO Scan command
program
  .command('seo-scan')
  .description('Scan site structure for SEO issues')
  .requiredOption('--path <path>', 'Path to site export or Next.js routes')
  .option('--type <type>', 'Source type (nextjs_routes|html_export)', 'html_export')
  .option('--base-url <url>', 'Base URL for link checking')
  .option('--output <file>', 'Output file for findings')
  .option('--jobforge', 'Generate JobForge request')
  .option('--tenant <id>', 'Tenant ID')
  .option('--project <id>', 'Project ID')
  .action(async (options) => {
    try {
      console.log(chalk.blue('🔍 Starting SEO scan...'));

      const config: SEOScannerConfig = {
        tenant_context: getTenantContext(options),
        source_path: path.resolve(options.path),
        source_type: options.type as 'nextjs_routes' | 'html_export',
        base_url: options.baseUrl,
      };

      const findings = await scanSEO(config);

      console.log(chalk.green(`\n✓ Scanned ${findings.summary.total_pages} pages`));
      console.log(chalk.yellow(`  Health Score: ${findings.health_score.overall}/100`));
      console.log(chalk.red(`  Critical: ${findings.health_score.issues_by_severity.critical}`));
      console.log(chalk.orange(`  Warnings: ${findings.health_score.issues_by_severity.warning}`));
      console.log(chalk.blue(`  Info: ${findings.health_score.issues_by_severity.info}`));

      if (findings.summary.opportunities.length > 0) {
        console.log(chalk.cyan('\n📈 Opportunities:'));
        findings.summary.opportunities.forEach((opp) => {
          console.log(chalk.cyan(`  • ${opp}`));
        });
      }

      // Save findings
      const outputData = JSON.stringify(findings, null, 2);
      if (options.output) {
        await fs.writeFile(options.output, outputData);
        console.log(chalk.green(`\n✓ Findings saved to ${options.output}`));
      }

      // Generate JobForge request if requested
      if (options.jobforge) {
        const jobConfig = {
          tenant_context: getTenantContext(options),
        };
        const jobRequest = createSEOScanJob(findings, jobConfig);
        const jobFile = options.output
          ? options.output.replace('.json', '.job.json')
          : `seo-scan-${Date.now()}.job.json`;
        await fs.writeFile(jobFile, serializeJobRequest(jobRequest));
        console.log(chalk.green(`✓ JobForge request saved to ${jobFile}`));
      }

      // Print sample issues
      if (findings.issues.length > 0) {
        console.log(chalk.yellow('\n📝 Top Issues:'));
        findings.issues.slice(0, 5).forEach((issue) => {
          const color =
            issue.severity === 'critical'
              ? chalk.red
              : issue.severity === 'warning'
              ? chalk.orange
              : chalk.gray;
          console.log(color(`  [${issue.severity}] ${issue.type}: ${issue.message}`));
          console.log(chalk.gray(`    → ${issue.recommendation}`));
        });
      }
    } catch (error) {
      console.error(chalk.red(`\n✗ Error: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });

// Funnel analysis command
program
  .command('funnel')
  .description('Analyze event data to compute funnel metrics')
  .requiredOption('--events <file>', 'Path to events JSON file')
  .requiredOption('--stages <stages...>', 'Ordered list of funnel stage event names')
  .option('--name <name>', 'Funnel name', 'Primary Funnel')
  .option('--output <file>', 'Output file for metrics')
  .option('--jobforge', 'Generate JobForge request')
  .option('--tenant <id>', 'Tenant ID')
  .option('--project <id>', 'Project ID')
  .action(async (options) => {
    try {
      console.log(chalk.blue('📊 Analyzing funnel...'));

      const events = await loadEventsFromFile(options.events);
      console.log(chalk.gray(`  Loaded ${events.length} events`));

      const config: FunnelConfig = {
        tenant_context: getTenantContext(options),
        funnel_name: options.name,
        stages: options.stages,
      };

      const metrics = await analyzeFunnel(events, config);

      console.log(chalk.green(`\n✓ Funnel: ${metrics.funnel_name}`));
      console.log(chalk.blue(`  Users: ${metrics.total_users_entered} → ${metrics.total_users_completed}`));
      console.log(chalk.yellow(`  Overall Conversion: ${metrics.overall_conversion_rate.toFixed(2)}%`));

      if (metrics.biggest_drop_off_stage) {
        console.log(chalk.red(`  Biggest Drop-off: ${metrics.biggest_drop_off_stage} (${metrics.biggest_drop_off_rate?.toFixed(1)}%)`));
      }

      console.log(chalk.cyan('\n📈 Stage Breakdown:'));
      metrics.stages.forEach((stage) => {
        const arrow = stage.conversion_rate_from_previous !== null
          ? ` ← ${stage.conversion_rate_from_previous.toFixed(1)}%`
          : '';
        console.log(chalk.cyan(`  ${stage.name}: ${stage.unique_users} users${arrow}`));
        if (stage.drop_off_rate > 0) {
          console.log(chalk.orange(`    Drop-off: ${stage.drop_off_rate.toFixed(1)}%`));
        }
      });

      // Detect patterns
      const patterns = detectFunnelPatterns(metrics);
      if (patterns.length > 0) {
        console.log(chalk.magenta('\n🔍 Detected Patterns:'));
        patterns.forEach((pattern) => {
          const color = pattern.severity === 'critical' ? chalk.red : pattern.severity === 'warning' ? chalk.orange : chalk.gray;
          console.log(color(`  [${pattern.severity}] ${pattern.pattern}: ${pattern.description}`));
        });
      }

      // Save metrics
      const outputData = JSON.stringify(metrics, null, 2);
      if (options.output) {
        await fs.writeFile(options.output, outputData);
        console.log(chalk.green(`\n✓ Metrics saved to ${options.output}`));
      }

      // Generate JobForge request if requested
      if (options.jobforge) {
        const proposals = proposeExperiments(metrics, {
          tenant_context: getTenantContext(options),
          max_proposals: 3,
        });

        const jobConfig = {
          tenant_context: getTenantContext(options),
        };
        const jobRequest = createExperimentJob(proposals, metrics, jobConfig);
        const jobFile = options.output
          ? options.output.replace('.json', '.job.json')
          : `funnel-${Date.now()}.job.json`;
        await fs.writeFile(jobFile, serializeJobRequest(jobRequest));
        console.log(chalk.green(`✓ JobForge request saved to ${jobFile}`));
        console.log(chalk.blue(`  (Includes ${proposals.length} experiment proposals)`));
      }
    } catch (error) {
      console.error(chalk.red(`\n✗ Error: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });

// Propose experiments command
program
  .command('propose-experiments')
  .description('Propose experiments based on funnel metrics')
  .requiredOption('--funnel <file>', 'Path to funnel metrics JSON file')
  .option('--max <number>', 'Maximum proposals', '5')
  .option('--min-confidence <level>', 'Minimum confidence (low|medium|high)', 'low')
  .option('--output <file>', 'Output file for proposals')
  .option('--jobforge', 'Generate JobForge request')
  .option('--tenant <id>', 'Tenant ID')
  .option('--project <id>', 'Project ID')
  .action(async (options) => {
    try {
      console.log(chalk.blue('🧪 Generating experiment proposals...'));

      const funnelData = await fs.readFile(options.funnel, 'utf-8');
      const metrics = JSON.parse(funnelData);

      const config: ProposerConfig = {
        tenant_context: getTenantContext(options),
        max_proposals: parseInt(options.max, 10),
        min_confidence: options.minConfidence as 'low' | 'medium' | 'high',
      };

      const proposals = proposeExperiments(metrics, config);
      const ranked = rankProposals(proposals);

      console.log(chalk.green(`\n✓ Generated ${proposals.length} experiment proposals`));

      ranked.forEach((proposal, index) => {
        const priority = index === 0 ? chalk.green('★ ') : '  ';
        console.log(chalk.cyan(`${priority}${index + 1}. ${proposal.name}`));
        console.log(chalk.gray(`   Type: ${proposal.type} | Effort: ${proposal.effort} | Impact: ${proposal.expected_impact.lift_percentage}%`));
        console.log(chalk.gray(`   Target: ${proposal.target_funnel_stage ?? 'N/A'}`));
        console.log(chalk.white(`   ${proposal.hypothesis.belief}`));
        console.log(chalk.yellow(`   Expected: ${proposal.hypothesis.expected_outcome}`));
        console.log();
      });

      // Save proposals
      const outputData = JSON.stringify(ranked, null, 2);
      if (options.output) {
        await fs.writeFile(options.output, outputData);
        console.log(chalk.green(`✓ Proposals saved to ${options.output}`));
      }

      // Generate JobForge request if requested
      if (options.jobforge) {
        const jobConfig = {
          tenant_context: getTenantContext(options),
        };
        const jobRequest = createExperimentJob(ranked, metrics, jobConfig);
        const jobFile = options.output
          ? options.output.replace('.json', '.job.json')
          : `experiments-${Date.now()}.job.json`;
        await fs.writeFile(jobFile, serializeJobRequest(jobRequest));
        console.log(chalk.green(`✓ JobForge request saved to ${jobFile}`));
      }
    } catch (error) {
      console.error(chalk.red(`\n✗ Error: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });

// Draft content command
program
  .command('draft-content')
  .description('Draft content (landing copy, emails, changelog)')
  .requiredOption('--profile <id>', 'Profile ID (base, jobforge, settler, readylayer, aias, keys)')
  .requiredOption('--type <type>', 'Content type (landing_page|onboarding_email|changelog_note|blog_post|social_post|ad_copy|help_article)')
  .option('--goal <goal>', 'Content goal', 'Convert visitors to users')
  .option('--audience <audience>', 'Target audience', 'Technical decision makers')
  .option('--variants <count>', 'Number of variants to generate', '3')
  .option('--output <file>', 'Output file for draft')
  .option('--jobforge', 'Generate JobForge request')
  .option('--tenant <id>', 'Tenant ID')
  .option('--project <id>', 'Project ID')
  .action(async (options) => {
    try {
      console.log(chalk.blue('✍️  Drafting content...'));

      const profile = getProfile(options.profile);
      console.log(chalk.gray(`  Using profile: ${profile.name}`));

      const config: DrafterConfig = {
        tenant_context: getTenantContext(options),
        content_type: options.type,
        target_audience: options.audience,
        goal: options.goal,
        profile,
        variants_count: parseInt(options.variants, 10),
      };

      const draft = draftContent(config);

      console.log(chalk.green(`\n✓ Generated ${draft.variants.length} content variants`));
      console.log(chalk.blue(`  Type: ${draft.content_type}`));
      console.log(chalk.blue(`  Goal: ${draft.goal}`));
      console.log(chalk.blue(`  Audience: ${draft.target_audience}`));

      // Display variants
      draft.variants.forEach((variant, index) => {
        const isRecommended = variant.name === draft.recommended_variant;
        const marker = isRecommended ? chalk.green('★ Recommended') : '  ';
        console.log(chalk.cyan(`\n${marker} Variant ${index + 1}: ${variant.name}`));
        console.log(chalk.white(`  Headline: ${variant.headline}`));
        console.log(chalk.gray(`  CTA: ${variant.cta}`));
        if (variant.meta_description) {
          console.log(chalk.gray(`  Meta: ${variant.meta_description.slice(0, 60)}...`));
        }
        console.log(chalk.gray(`  Keywords: ${variant.seo_keywords.join(', ')}`));
        console.log(chalk.gray(`  Body: ${variant.body.slice(0, 100)}...`));
      });

      // Constraints check
      console.log(chalk.yellow('\n📋 Constraints Check:'));
      console.log(draft.constraints_respected.prohibited_claims_checked ? chalk.green('  ✓ Prohibited claims checked') : chalk.red('  ✗ Prohibited claims found'));
      console.log(draft.constraints_respected.brand_voice_matched ? chalk.green('  ✓ Brand voice matched') : chalk.red('  ✗ Brand voice issues'));
      console.log(draft.constraints_respected.character_limits_met ? chalk.green('  ✓ Character limits met') : chalk.red('  ✗ Character limits exceeded'));

      // Suggested experiments
      if (draft.suggested_experiments.length > 0) {
        console.log(chalk.magenta('\n🧪 Suggested Experiments:'));
        draft.suggested_experiments.forEach((exp) => {
          console.log(chalk.magenta(`  • ${exp}`));
        });
      }

      // Save draft
      const outputData = JSON.stringify(draft, null, 2);
      if (options.output) {
        await fs.writeFile(options.output, outputData);
        console.log(chalk.green(`\n✓ Draft saved to ${options.output}`));
      }

      // Generate JobForge request if requested
      if (options.jobforge) {
        const jobConfig = {
          tenant_context: getTenantContext(options),
        };
        const jobRequest = createContentDraftJob(draft, jobConfig);
        const jobFile = options.output
          ? options.output.replace('.json', '.job.json')
          : `content-${Date.now()}.job.json`;
        await fs.writeFile(jobFile, serializeJobRequest(jobRequest));
        console.log(chalk.green(`✓ JobForge request saved to ${jobFile}`));
      }
    } catch (error) {
      console.error(chalk.red(`\n✗ Error: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });

// List profiles command
program
  .command('profiles')
  .description('List available profiles')
  .action(() => {
    console.log(chalk.blue('📋 Available Profiles:'));
    const profiles = listProfiles();
    profiles.forEach((id) => {
      try {
        const profile = getProfile(id);
        console.log(chalk.cyan(`  ${id}: ${profile.name}`));
        console.log(chalk.gray(`    ${profile.description}`));
        console.log(chalk.gray(`    Tone: ${profile.voice.tone} | Features: ${profile.features.length}`));
      } catch {
        console.log(chalk.gray(`  ${id}: (loading error)`));
      }
    });
  });

// Helpful footer
program.on('--help', () => {
  console.log('');
  console.log(chalk.blue('Examples:'));
  console.log(chalk.gray('  $ growth seo-scan --path ./site-export --output findings.json'));
  console.log(chalk.gray('  $ growth funnel --events events.json --stages page_view signup activation'));
  console.log(chalk.gray('  $ growth propose-experiments --funnel metrics.json --max 3'));
  console.log(chalk.gray('  $ growth draft-content --profile jobforge --type landing_page'));
  console.log('');
  console.log(chalk.yellow('Note: This tool generates recommendations only. Use --jobforge to create JobForge requests for execution.'));
});

program.parse();
