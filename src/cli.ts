#!/usr/bin/env node

import { Command } from 'commander';
import { z } from 'zod';
import { join } from 'path';
import {
  IngestInputSchema,
  CorrelationInputSchema,
  RunbookInputSchema,
  ReportInputSchema,
  generateId,
  type IngestInput,
  type CorrelationInput,
  type RunbookInput,
  type ReportInput,
  type Alert,
  type Runbook,
  type CorrelatedAlertGroup,
  type AlertCorrelation,
  type ReliabilityReport,
  type JobRequest,
} from './contracts/index.js';
import {
  analyze,
  renderReport,
  serializeBundle,
  serializeReport,
  type AnalyzeInput,
} from './jobforge/integration.js';
import {
  correlateAlerts,
  createAlertCorrelation,
  filterAlerts,
  validateAlerts,
  calculateAlertMetrics,
  type AlertFilter,
} from './alerts/index.js';
import { generateRunbook } from './runbooks/index.js';
import {
  createAlertCorrelationJobs,
  createRunbookJobs,
  createReliabilityReportJobs,
} from './jobforge/index.js';
import { getOpsProfile } from './profiles/index.js';
import { generateReliabilityReport } from './reports/index.js';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';

/**
 * Ops Autopilot CLI
 * 
 * Commands:
 * - ingest: Ingest alerts/events from various sources
 * - correlate: Correlate alerts to identify patterns
 * - runbook: Generate incident response runbooks
 * - report: Generate reliability reports
 */

const program = new Command();

program
  .name('ops-autopilot')
  .description('Runnerless reliability autopilot - detects infrastructure anomalies and produces JobForge requests')
  .version('0.1.0');

// ============================================================================
// Analyze Command (JobForge Integration)
// ============================================================================

program
  .command('analyze')
  .description('Generate JobForge request bundle and report (runnerless, dry-run)')
  .requiredOption('--inputs <path>', 'Path to analysis inputs JSON')
  .requiredOption('--tenant <tenant>', 'Tenant ID')
  .requiredOption('--project <project>', 'Project ID')
  .requiredOption('--trace <trace>', 'Trace ID')
  .requiredOption('--out <dir>', 'Output directory')
  .option('--stable-output', 'Write deterministic outputs for fixtures/docs', false)
  .action(async (options) => {
    try {
      if (!existsSync(options.inputs)) {
        throw new Error(`Inputs file not found: ${options.inputs}`);
      }

      const content = readFileSync(options.inputs, 'utf-8');
      const parsed = JSON.parse(content);

      const input: AnalyzeInput = {
        ...parsed,
        tenant_id: options.tenant,
        project_id: options.project,
        trace_id: options.trace,
      };

      const result = analyze(input, { stableOutput: options.stableOutput });

      mkdirSync(options.out, { recursive: true });

      const requestBundlePath = join(options.out, 'request-bundle.json');
      const reportPath = join(options.out, 'report.json');
      const reportMdPath = join(options.out, 'report.md');

      writeFileSync(requestBundlePath, serializeBundle(result.jobRequestBundle));
      writeFileSync(reportPath, serializeReport(result.reportEnvelope));
      writeFileSync(reportMdPath, renderReport(result.reportEnvelope));

      console.error('✅ Analyze complete');
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error('❌ Analyze failed: validation error');
        console.error(error.errors.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('\n'));
        process.exit(2);
      }

      if (process.env.DEBUG) {
        console.error('❌ Analyze failed:', error);
      } else {
        console.error('❌ Analyze failed: unexpected error');
      }
      process.exit(1);
    }
  });

// ============================================================================
// Ingest Command
// ============================================================================

program
  .command('ingest')
  .description('Ingest alerts, events, or log summaries')
  .requiredOption('-t, --tenant <tenant>', 'Tenant ID')
  .requiredOption('-p, --project <project>', 'Project ID')
  .option('-s, --source <source>', 'Alert source (cloudwatch, datadog, prometheus, etc.)', 'custom')
  .option('-f, --file <file>', 'Path to alerts JSON file')
  .option('--raw-events <events>', 'Raw events JSON string')
  .option('--log-summary <summary>', 'Log summary text')
  .option('--manifest <path>', 'Path to manifest file')
  .option('--profile <profile>', 'Profile ID', 'ops-base')
  .option('--start <iso>', 'Time range start (ISO 8601)')
  .option('--end <iso>', 'Time range end (ISO 8601)')
  .option('--output <path>', 'Output file path')
  .action(async (options) => {
    try {
      console.error('🔍 Ops Autopilot - Ingest Mode');
      console.error(`Tenant: ${options.tenant}, Project: ${options.project}`);

      let alerts: Alert[] = [];
      
      // Load alerts from file if provided
      if (options.file && existsSync(options.file)) {
        const content = readFileSync(options.file, 'utf-8');
        const parsed = JSON.parse(content);
        alerts = (Array.isArray(parsed) ? parsed : parsed.alerts ?? []) as Alert[];
        console.error(`📥 Loaded ${alerts.length} alerts from ${options.file}`);
      }

      // Parse raw events if provided
      let rawEvents: Record<string, unknown>[] = [];
      if (options.rawEvents) {
        rawEvents = JSON.parse(options.rawEvents) as Record<string, unknown>[];
        console.error(`📥 Parsed ${rawEvents.length} raw events`);
      }

      // Build input
      const input: IngestInput = {
        tenant_id: options.tenant,
        project_id: options.project,
        source: options.source,
        alerts: alerts.length > 0 ? alerts : undefined,
        raw_events: rawEvents.length > 0 ? rawEvents : undefined,
        log_summary: options.logSummary,
        manifest_path: options.manifest,
        profile_id: options.profile,
        time_range: options.start && options.end ? {
          start: options.start,
          end: options.end,
        } : undefined,
      };

      // Validate input
      const validated = IngestInputSchema.parse(input) as IngestInput;

      const validatedAlerts = (validated.alerts ?? []) as Alert[];
      const validatedEvents = (validated.raw_events ?? []) as unknown[];

      // Calculate metrics
      if (validatedAlerts.length > 0) {
        const metrics = calculateAlertMetrics(validatedAlerts);
        console.error('📊 Alert Metrics:', JSON.stringify(metrics, null, 2));
      }

      // Output result
      const result = {
        ingest_id: generateId(),
        ...validated,
        processed_at: new Date().toISOString(),
        alert_count: validatedAlerts.length,
        event_count: validatedEvents.length,
      };

      const output = JSON.stringify(result, null, 2);
      
      if (options.output) {
        writeFileSync(options.output, output);
        console.error(`💾 Output written to ${options.output}`);
      } else {
        console.log(output);
      }

      console.error('✅ Ingest complete');
    } catch (error) {
      console.error('❌ Ingest failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// ============================================================================
// Correlate Command
// ============================================================================

program
  .command('correlate')
  .description('Correlate alerts to identify patterns and root causes')
  .requiredOption('-t, --tenant <tenant>', 'Tenant ID')
  .requiredOption('-p, --project <project>', 'Project ID')
  .requiredOption('-f, --file <file>', 'Path to alerts JSON file')
  .option('--profile <profile>', 'Profile ID', 'ops-base')
  .option('--window <minutes>', 'Correlation time window in minutes', '10')
  .option('--min-alerts <count>', 'Minimum alerts for correlation', '2')
  .option('--services <list>', 'Filter by services (comma-separated)')
  .option('--sources <list>', 'Filter by sources (comma-separated)')
  .option('--output <path>', 'Output file path')
  .option('--jobs', 'Generate JobForge job requests', false)
  .action(async (options) => {
    try {
      console.error('🔗 Ops Autopilot - Correlate Mode');
      console.error(`Tenant: ${options.tenant}, Project: ${options.project}`);

      // Load alerts
      if (!existsSync(options.file)) {
        throw new Error(`File not found: ${options.file}`);
      }

      const content = readFileSync(options.file, 'utf-8');
      const parsed = JSON.parse(content);
      const rawAlerts = Array.isArray(parsed) ? parsed : parsed.alerts ?? [];
      
      console.error(`📥 Loaded ${rawAlerts.length} alerts`);

      // Validate alerts
      const alerts = validateAlerts(rawAlerts as Alert[]);

      // Apply filters
      const filter: AlertFilter = {};
      if (options.services) {
        filter.services = options.services.split(',').map((s: string) => s.trim());
      }
      if (options.sources) {
        filter.sources = options.sources.split(',').map((s: string) => s.trim());
      }

      const filteredAlerts = Object.keys(filter).length > 0 
        ? filterAlerts(alerts, filter)
        : alerts;

      console.error(`🔍 ${filteredAlerts.length} alerts after filtering`);

      // Get profile
      const profile = getOpsProfile(options.profile);

      // Build correlation input
      const input: CorrelationInput = {
        tenant_id: options.tenant,
        project_id: options.project,
        alerts: filteredAlerts,
        profile_id: options.profile,
        time_window_minutes: parseInt(options.window, 10),
      };

      // Validate input
      const validated = CorrelationInputSchema.parse(input) as CorrelationInput;

      // Run correlation
      const correlationAlerts = validated.alerts as Alert[];
      const correlationResult = correlateAlerts(correlationAlerts, undefined, profile ?? undefined);
      const correlation = createAlertCorrelation(
        options.tenant,
        options.project,
        correlationResult,
        options.profile
      ) as unknown as AlertCorrelation;
      const correlationSummary = correlation as unknown as {
        groups: Array<unknown>;
        summary: { total_alerts: number };
      };

      console.error(`📊 Found ${correlationSummary.groups.length} correlated groups`);
      console.error(`   - ${correlationSummary.summary.total_alerts} total alerts`);
      console.error(`   - ${correlationResult.ungrouped.length} ungrouped alerts`);

      // Generate job requests if requested
      let jobs: JobRequest[] = [];
      if (options.jobs) {
        const tenantContext = { tenant_id: options.tenant, project_id: options.project };
        jobs = createAlertCorrelationJobs(tenantContext, correlation);
        console.error(`📝 Generated ${jobs.length} JobForge job requests`);
      }

      // Build output
      const result = {
        correlation,
        jobs: options.jobs ? jobs : undefined,
      };

      const output = JSON.stringify(result, null, 2);
      
      if (options.output) {
        writeFileSync(options.output, output);
        console.error(`💾 Output written to ${options.output}`);
      } else {
        console.log(output);
      }

      console.error('✅ Correlation complete');
    } catch (error) {
      console.error('❌ Correlation failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// ============================================================================
// Runbook Command
// ============================================================================

program
  .command('runbook')
  .description('Generate incident response runbook from alert group')
  .requiredOption('-t, --tenant <tenant>', 'Tenant ID')
  .requiredOption('-p, --project <project>', 'Project ID')
  .requiredOption('-f, --file <file>', 'Path to alert group JSON file')
  .option('--profile <profile>', 'Profile ID', 'ops-base')
  .option('--include-automation', 'Include automated steps', false)
  .option('--include-rollback', 'Include rollback procedures', true)
  .option('--output <path>', 'Output file path')
  .option('--jobs', 'Generate JobForge job requests', false)
  .action(async (options) => {
    try {
      console.error('📖 Ops Autopilot - Runbook Generation');
      console.error(`Tenant: ${options.tenant}, Project: ${options.project}`);

      // Load alert group
      if (!existsSync(options.file)) {
        throw new Error(`File not found: ${options.file}`);
      }

      const content = readFileSync(options.file, 'utf-8');
      const alertGroup = JSON.parse(content) as RunbookInput['alert_group'];

      // Build input
      const input: RunbookInput = {
        tenant_id: options.tenant,
        project_id: options.project,
        alert_group: alertGroup,
        profile_id: options.profile,
        include_automation: options.includeAutomation,
      };

      // Validate input
      const validated = RunbookInputSchema.parse(input) as RunbookInput;

      // Generate runbook
      const runbookInput = validated.alert_group as RunbookInput['alert_group'];
      const runbook = generateRunbook(runbookInput as CorrelatedAlertGroup, {
        includeAutomation: options.includeAutomation,
        includeRollback: options.includeRollback,
      }) as unknown as Runbook;
      const runbookSteps = runbook.steps as Array<{ automated: boolean; requires_approval: boolean }>;

      console.error(`📘 Generated runbook: ${runbook.name}`);
      console.error(`   - ${runbookSteps.length} steps`);
      console.error(`   - ${runbookSteps.filter((s) => s.automated).length} automated steps`);
      console.error(`   - ${runbookSteps.filter((s) => s.requires_approval).length} steps require approval`);
      console.error(`   - Estimated duration: ${runbook.estimated_duration_minutes} minutes`);

      // Generate job requests if requested
      let jobs: JobRequest[] = [];
      if (options.jobs) {
        const tenantContext = { tenant_id: options.tenant, project_id: options.project };
        jobs = createRunbookJobs(tenantContext, runbook);
        console.error(`📝 Generated ${jobs.length} JobForge job requests`);
      }

      // Build output
      const result = {
        runbook,
        jobs: options.jobs ? jobs : undefined,
      };

      const output = JSON.stringify(result, null, 2);
      
      if (options.output) {
        writeFileSync(options.output, output);
        console.error(`💾 Output written to ${options.output}`);
      } else {
        console.log(output);
      }

      console.error('✅ Runbook generation complete');
    } catch (error) {
      console.error('❌ Runbook generation failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// ============================================================================
// Report Command
// ============================================================================

program
  .command('report')
  .description('Generate reliability report')
  .requiredOption('-t, --tenant <tenant>', 'Tenant ID')
  .requiredOption('-p, --project <project>', 'Project ID')
  .option('--type <type>', 'Report type (incident_postmortem, health_check, trend_analysis, compliance)', 'health_check')
  .requiredOption('--start <iso>', 'Period start (ISO 8601)')
  .requiredOption('--end <iso>', 'Period end (ISO 8601)')
  .option('--profile <profile>', 'Profile ID', 'ops-base')
  .option('--services <list>', 'Services to include (comma-separated)')
  .option('--alerts-file <file>', 'Path to alerts file for analysis')
  .option('--output <path>', 'Output file path')
  .option('--jobs', 'Generate JobForge job requests', false)
  .action(async (options) => {
    try {
      console.error('📊 Ops Autopilot - Reliability Report');
      console.error(`Tenant: ${options.tenant}, Project: ${options.project}`);

      // Parse services
      const services = options.services 
        ? options.services.split(',').map((s: string) => s.trim())
        : undefined;

      // Load alerts if provided
      let alerts: Alert[] = [];
      if (options.alertsFile && existsSync(options.alertsFile)) {
        const content = readFileSync(options.alertsFile, 'utf-8');
        const parsed = JSON.parse(content);
        alerts = Array.isArray(parsed) ? parsed : parsed.alerts ?? [];
        console.error(`📥 Loaded ${alerts.length} alerts for analysis`);
      }

      // Build input
      const input: ReportInput = {
        tenant_id: options.tenant,
        project_id: options.project,
        report_type: options.type,
        period_start: options.start,
        period_end: options.end,
        services,
        profile_id: options.profile,
      };

      // Validate input
      const validated = ReportInputSchema.parse(input) as ReportInput;

      // Generate report (simplified version for CLI)
      const report = generateReliabilityReport(validated, alerts) as unknown as ReliabilityReport;
      const reportStats = report as {
        service_health: unknown[];
        anomalies: unknown[];
        findings: unknown[];
        recommendations: unknown[];
        overall_health_score: number;
      };

      console.error(`📈 Generated ${validated.report_type} report`);
      console.error(`   - ${reportStats.service_health.length} services analyzed`);
      console.error(`   - ${reportStats.anomalies.length} anomalies detected`);
      console.error(`   - ${reportStats.findings.length} findings`);
      console.error(`   - ${reportStats.recommendations.length} recommendations`);
      console.error(`   - Health score: ${reportStats.overall_health_score}/100`);

      // Generate job requests if requested
      let jobs: JobRequest[] = [];
      if (options.jobs) {
        const tenantContext = { tenant_id: options.tenant, project_id: options.project };
        jobs = createReliabilityReportJobs(tenantContext, report);
        console.error(`📝 Generated ${jobs.length} JobForge job requests`);
      }

      // Build output
      const result = {
        report,
        jobs: options.jobs ? jobs : undefined,
      };

      const output = JSON.stringify(result, null, 2);
      
      if (options.output) {
        writeFileSync(options.output, output);
        console.error(`💾 Output written to ${options.output}`);
      } else {
        console.log(output);
      }

      console.error('✅ Report generation complete');
    } catch (error) {
      console.error('❌ Report generation failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// ============================================================================
// Execute CLI
// ============================================================================

program.parse();
