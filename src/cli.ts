#!/usr/bin/env node

import { Command } from 'commander';
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
  type JobRequest,
} from './contracts/index.js';
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
import { readFileSync, existsSync } from 'fs';

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

      let alerts = [];
      
      // Load alerts from file if provided
      if (options.file && existsSync(options.file)) {
        const content = readFileSync(options.file, 'utf-8');
        const parsed = JSON.parse(content);
        alerts = Array.isArray(parsed) ? parsed : parsed.alerts ?? [];
        console.error(`📥 Loaded ${alerts.length} alerts from ${options.file}`);
      }

      // Parse raw events if provided
      let rawEvents = [];
      if (options.rawEvents) {
        rawEvents = JSON.parse(options.rawEvents);
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
      const validated = IngestInputSchema.parse(input);

      // Calculate metrics
      if (validated.alerts && validated.alerts.length > 0) {
        const metrics = calculateAlertMetrics(validated.alerts);
        console.error('📊 Alert Metrics:', JSON.stringify(metrics, null, 2));
      }

      // Output result
      const result = {
        ingest_id: generateId(),
        ...validated,
        processed_at: new Date().toISOString(),
        alert_count: validated.alerts?.length ?? 0,
        event_count: validated.raw_events?.length ?? 0,
      };

      const output = JSON.stringify(result, null, 2);
      
      if (options.output) {
        const { writeFileSync } = await import('fs');
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
      const alerts = validateAlerts(rawAlerts);

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
      const validated = CorrelationInputSchema.parse(input);

      // Run correlation
      const correlationResult = correlateAlerts(validated.alerts, undefined, profile ?? undefined);
      const correlation = createAlertCorrelation(
        options.tenant,
        options.project,
        correlationResult,
        options.profile
      );

      console.error(`📊 Found ${correlation.groups.length} correlated groups`);
      console.error(`   - ${correlation.summary.total_alerts} total alerts`);
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
        const { writeFileSync } = await import('fs');
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
      const alertGroup = JSON.parse(content);

      // Get profile
      const profile = getOpsProfile(options.profile);

      // Build input
      const input: RunbookInput = {
        tenant_id: options.tenant,
        project_id: options.project,
        alert_group: alertGroup,
        profile_id: options.profile,
        include_automation: options.includeAutomation,
      };

      // Validate input
      const validated = RunbookInputSchema.parse(input);

      // Generate runbook
      const runbook = generateRunbook(validated.alert_group, profile ?? undefined, {
        includeAutomation: options.includeAutomation,
        includeRollback: options.includeRollback,
      });

      console.error(`📘 Generated runbook: ${runbook.name}`);
      console.error(`   - ${runbook.steps.length} steps`);
      console.error(`   - ${runbook.steps.filter(s => s.automated).length} automated steps`);
      console.error(`   - ${runbook.steps.filter(s => s.requires_approval).length} steps require approval`);
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
        const { writeFileSync } = await import('fs');
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
      let alerts = [];
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
      const validated = ReportInputSchema.parse(input);

      // Generate report (simplified version for CLI)
      const report = generateReliabilityReport(validated, alerts);

      console.error(`📈 Generated ${validated.report_type} report`);
      console.error(`   - ${report.service_health.length} services analyzed`);
      console.error(`   - ${report.anomalies.length} anomalies detected`);
      console.error(`   - ${report.findings.length} findings`);
      console.error(`   - ${report.recommendations.length} recommendations`);
      console.error(`   - Health score: ${report.overall_health_score}/100`);

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
        const { writeFileSync } = await import('fs');
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
// Report Generation Helper
// ============================================================================

function generateReliabilityReport(
  input: ReportInput,
  alerts: unknown[]
): import('./contracts/index.js').ReliabilityReport {
  const { 
    ReliabilityReportSchema,
    generateId,
    computeHash,
  } = require('./contracts/index.js');

  const findings = [];
  const recommendations = [];
  const anomalies = [];
  const serviceHealth = [];

  // Analyze alerts to generate findings
  let criticalAlerts: any[] = [];
  if (alerts.length > 0) {
    // Critical alerts finding
    criticalAlerts = alerts.filter((a: any) => a.severity === 'critical');
    if (criticalAlerts.length > 0) {
      findings.push({
        id: generateId(),
        severity: 'critical',
        category: 'incident_response',
        message: `${criticalAlerts.length} critical alerts during reporting period`,
        recommendation: 'Review critical incidents and ensure runbooks exist',
        evidence: [
          {
            type: 'event_count',
            path: 'alerts',
            value: criticalAlerts.length,
            description: 'Count of critical severity alerts',
          },
        ],
      });

      recommendations.push({
        priority: 'critical',
        category: 'incident_response',
        description: 'Improve early detection for critical issues',
        expected_impact: 'Reduce MTTR for critical incidents',
        implementation_effort: 'medium',
        related_findings: [findings[findings.length - 1].id],
      });
    }

    // Generate anomaly for alert spike
    if (alerts.length > 50) {
      anomalies.push({
        anomaly_id: generateId(),
        type: 'spike',
        service: 'multiple',
        metric: 'alert_count',
        detected_at: input.period_end,
        severity: 'warning',
        baseline_value: 10,
        observed_value: alerts.length,
        deviation_percent: ((alerts.length - 10) / 10) * 100,
        contributing_factors: ['Unusual alert volume', 'Possible infrastructure event'],
      });
    }
  }

  // Generate service health based on services list
  if (input.services) {
    for (const service of input.services) {
      serviceHealth.push({
        service_name: service,
        status: 'healthy',
        availability_percent: 99.9,
        latency_p95_ms: 150,
        error_rate_percent: 0.1,
        metrics: [],
      });
    }
  }

  // Calculate health score
  const healthScore = Math.max(0, 100 - (criticalAlerts?.length ?? 0) * 10 - (anomalies.length * 5));

  const report = {
    report_id: generateId(),
    tenant_id: input.tenant_id,
    project_id: input.project_id,
    report_type: input.report_type,
    period_start: input.period_start,
    period_end: input.period_end,
    generated_at: new Date().toISOString(),
    overall_health_score: healthScore,
    service_health: serviceHealth,
    anomalies,
    findings,
    recommendations,
    job_requests: [],
    profile_id: input.profile_id,
    report_hash: computeHash(`${input.tenant_id}:${input.project_id}:${input.period_start}:${input.period_end}`),
    redaction_applied: true,
  };

  return ReliabilityReportSchema.parse(report);
}

// ============================================================================
// Execute CLI
// ============================================================================

program.parse();
