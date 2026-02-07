#!/usr/bin/env node

import { Command } from 'commander';
import { join } from 'path';
import { randomUUID } from 'crypto';
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
import { readFileSync, existsSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import {
  Logger,
  ArtifactWriter,
  loadArtifacts,
  toErrorEnvelope,
  exitCodeForError,
  EXIT_SUCCESS,
  EXIT_VALIDATION,
  EXIT_BUG,
  type ArtifactSummary,
} from './runner-std/index.js';
import { runDemo } from './runner.js';

/**
 * Ops Autopilot CLI
 *
 * Standard runner CLI with unified flags, structured logs,
 * artifact layout, and standard exit codes.
 *
 * Exit codes:
 *   0 - success
 *   2 - validation error
 *   3 - external dependency failure
 *   4 - unexpected bug
 */

const program = new Command();

program
  .name('ops-autopilot')
  .description(
    'Runnerless reliability autopilot - detects infrastructure anomalies and produces JobForge requests'
  )
  .version('0.1.0');

// ============================================================================
// Helper: wrap command action with error envelope + artifacts + structured log
// ============================================================================

interface RunContext {
  logger: Logger;
  artifacts: ArtifactWriter;
  runId: string;
  dryRun: boolean;
  json: boolean;
}

function resolveRunId(): string {
  return `run-${Date.now()}-${randomUUID().slice(0, 8)}`;
}

function createRunContext(options: {
  out?: string;
  json?: boolean;
  dryRun?: boolean;
  runId?: string;
}): RunContext {
  const runId = options.runId ?? resolveRunId();
  const json = options.json ?? false;
  const dryRun = options.dryRun ?? false;

  const logger = new Logger({ runId, json: true });
  const artifacts = new ArtifactWriter(runId, {
    baseDir: options.out ?? './artifacts',
  });

  return { logger, artifacts, runId, dryRun, json };
}

function handleError(error: unknown, ctx: RunContext, command: string, startedAt: string): never {
  const envelope = toErrorEnvelope(error);
  const exitCode = exitCodeForError(error);

  ctx.logger.error(`${command} failed`, { error: envelope });

  // Write artifacts on failure too
  try {
    ctx.artifacts.init();
    ctx.artifacts.writeEvidence('error', envelope);

    const summary: ArtifactSummary = {
      runId: ctx.runId,
      command,
      status: 'failure',
      startedAt,
      completedAt: new Date().toISOString(),
      dryRun: ctx.dryRun,
      error: envelope,
      evidenceFiles: ctx.artifacts.getEvidenceFiles(),
      logLineCount: ctx.logger.lines.length,
    };

    for (const line of ctx.logger.lines) {
      ctx.artifacts.appendLog(line);
    }
    ctx.artifacts.flushLogs();
    ctx.artifacts.writeSummary(summary);
  } catch {
    // Best-effort artifact writing on failure
  }

  if (ctx.json) {
    process.stdout.write(JSON.stringify(envelope, null, 2) + '\n');
  } else {
    process.stderr.write(`Error: ${envelope.userMessage}\n`);
  }

  process.exit(exitCode);
}

function finishSuccess(
  ctx: RunContext,
  command: string,
  startedAt: string,
  result?: unknown
): void {
  ctx.logger.info(`${command} complete`);

  ctx.artifacts.init();

  if (result !== undefined) {
    ctx.artifacts.writeEvidence('result', result);
  }

  const summary: ArtifactSummary = {
    runId: ctx.runId,
    command,
    status: 'success',
    startedAt,
    completedAt: new Date().toISOString(),
    dryRun: ctx.dryRun,
    evidenceFiles: ctx.artifacts.getEvidenceFiles(),
    logLineCount: ctx.logger.lines.length,
  };

  for (const line of ctx.logger.lines) {
    ctx.artifacts.appendLog(line);
  }
  ctx.artifacts.flushLogs();
  ctx.artifacts.writeSummary(summary);
}

// ============================================================================
// Plan Command (dry-run, no side effects)
// ============================================================================

program
  .command('plan')
  .description('Dry-run: produce plan + artifacts without network writes')
  .requiredOption('--inputs <path>', 'Path to analysis inputs JSON')
  .requiredOption('--tenant <tenant>', 'Tenant ID')
  .requiredOption('--project <project>', 'Project ID')
  .requiredOption('--trace <trace>', 'Trace ID')
  .option('--out <dir>', 'Artifact output directory', './artifacts')
  .option('--json', 'Emit JSON output to stdout', false)
  .option('--config <path>', 'Config file path')
  .option('--stable-output', 'Write deterministic outputs for fixtures/docs', false)
  .action(async options => {
    const startedAt = new Date().toISOString();
    const ctx = createRunContext({ out: options.out, json: options.json, dryRun: true });

    try {
      ctx.logger.info('plan: starting', { tenant: options.tenant, project: options.project });

      if (!existsSync(options.inputs)) {
        throw Object.assign(new Error(`Inputs file not found: ${options.inputs}`), {
          name: 'ZodError',
          errors: [{ path: ['inputs'], message: `File not found: ${options.inputs}` }],
        });
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

      ctx.artifacts.init();
      ctx.artifacts.writeEvidence('request-bundle', result.jobRequestBundle);
      ctx.artifacts.writeEvidence('report', result.reportEnvelope);

      // Also write to --out as flat files for compat
      const requestBundlePath = join(options.out, 'request-bundle.json');
      const reportPath = join(options.out, 'report.json');
      const reportMdPath = join(options.out, 'report.md');

      mkdirSync(options.out, { recursive: true });
      writeFileSync(requestBundlePath, serializeBundle(result.jobRequestBundle));
      writeFileSync(reportPath, serializeReport(result.reportEnvelope));
      writeFileSync(reportMdPath, renderReport(result.reportEnvelope));

      ctx.logger.info('plan: complete', {
        requests: (result.jobRequestBundle as { requests: unknown[] }).requests.length,
        dryRun: true,
      });

      if (ctx.json) {
        process.stdout.write(
          JSON.stringify(
            { status: 'success', runId: ctx.runId, dryRun: true, artifactDir: ctx.artifacts.dir },
            null,
            2
          ) + '\n'
        );
      }

      finishSuccess(ctx, 'plan', startedAt, {
        requests: (result.jobRequestBundle as { requests: unknown[] }).requests.length,
      });
    } catch (error) {
      handleError(error, ctx, 'plan', startedAt);
    }
  });

// ============================================================================
// Run Command (with --smoke support)
// ============================================================================

program
  .command('run')
  .description('Execute analysis and emit artifacts (use --smoke for quick validation)')
  .requiredOption('--inputs <path>', 'Path to analysis inputs JSON')
  .requiredOption('--tenant <tenant>', 'Tenant ID')
  .requiredOption('--project <project>', 'Project ID')
  .requiredOption('--trace <trace>', 'Trace ID')
  .option('--out <dir>', 'Artifact output directory', './artifacts')
  .option('--json', 'Emit JSON output to stdout', false)
  .option('--dry-run', 'Dry-run mode (same as plan)', false)
  .option('--smoke', 'Quick smoke test - validate inputs and produce minimal artifacts', false)
  .option('--config <path>', 'Config file path')
  .option('--stable-output', 'Write deterministic outputs for fixtures/docs', false)
  .action(async options => {
    const startedAt = new Date().toISOString();
    const ctx = createRunContext({
      out: options.out,
      json: options.json,
      dryRun: options.dryRun || options.smoke,
    });

    try {
      ctx.logger.info('run: starting', {
        tenant: options.tenant,
        project: options.project,
        smoke: options.smoke,
        dryRun: options.dryRun,
      });

      if (!existsSync(options.inputs)) {
        throw Object.assign(new Error(`Inputs file not found: ${options.inputs}`), {
          name: 'ZodError',
          errors: [{ path: ['inputs'], message: `File not found: ${options.inputs}` }],
        });
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

      ctx.artifacts.init();
      ctx.artifacts.writeEvidence('request-bundle', result.jobRequestBundle);
      ctx.artifacts.writeEvidence('report', result.reportEnvelope);

      // Write standard flat output files
      mkdirSync(options.out, { recursive: true });
      writeFileSync(
        join(options.out, 'request-bundle.json'),
        serializeBundle(result.jobRequestBundle)
      );
      writeFileSync(join(options.out, 'report.json'), serializeReport(result.reportEnvelope));
      writeFileSync(join(options.out, 'report.md'), renderReport(result.reportEnvelope));

      ctx.logger.info('run: complete', {
        requests: (result.jobRequestBundle as { requests: unknown[] }).requests.length,
        smoke: options.smoke,
      });

      if (ctx.json) {
        process.stdout.write(
          JSON.stringify(
            {
              status: 'success',
              runId: ctx.runId,
              dryRun: ctx.dryRun,
              smoke: options.smoke,
              artifactDir: ctx.artifacts.dir,
            },
            null,
            2
          ) + '\n'
        );
      }

      finishSuccess(ctx, 'run', startedAt, {
        requests: (result.jobRequestBundle as { requests: unknown[] }).requests.length,
        smoke: options.smoke,
      });
    } catch (error) {
      handleError(error, ctx, 'run', startedAt);
    }
  });

// ============================================================================
// Doctor Command
// ============================================================================

program
  .command('doctor')
  .description('Check environment, dependencies, and configuration health')
  .option('--json', 'Emit JSON output to stdout', false)
  .option('--config <path>', 'Config file path')
  .action(options => {
    const checks: Array<{ name: string; status: 'ok' | 'warn' | 'fail'; message: string }> = [];

    // Check Node.js version
    const nodeVersion = process.versions.node;
    const majorVersion = parseInt(nodeVersion.split('.')[0], 10);
    checks.push({
      name: 'node-version',
      status: majorVersion >= 18 ? 'ok' : 'fail',
      message: `Node.js ${nodeVersion} (requires >=18)`,
    });

    // Check required dependencies are importable
    checks.push({
      name: 'contracts-pkg',
      status: 'ok',
      message: '@autopilot/contracts available',
    });

    checks.push({
      name: 'jobforge-client-pkg',
      status: 'ok',
      message: '@autopilot/jobforge-client available',
    });

    checks.push({
      name: 'profiles-pkg',
      status: 'ok',
      message: '@autopilot/profiles available',
    });

    // Check fixtures exist
    const fixturesExist = existsSync('fixtures/jobforge/input.json');
    checks.push({
      name: 'fixtures',
      status: fixturesExist ? 'ok' : 'warn',
      message: fixturesExist
        ? 'Fixtures directory present'
        : 'Fixtures not found (run fixtures:export)',
    });

    // Check examples exist
    const examplesExist = existsSync('examples/jobforge-input.json');
    checks.push({
      name: 'examples',
      status: examplesExist ? 'ok' : 'warn',
      message: examplesExist ? 'Examples directory present' : 'Examples not found',
    });

    // Check artifacts directory is writable
    try {
      const testDir = './artifacts/.doctor-probe';
      mkdirSync(testDir, { recursive: true });
      writeFileSync(join(testDir, 'probe.txt'), 'ok');
      rmSync(testDir, { recursive: true });
      checks.push({
        name: 'artifacts-writable',
        status: 'ok',
        message: 'Artifacts directory writable',
      });
    } catch {
      checks.push({
        name: 'artifacts-writable',
        status: 'fail',
        message: 'Cannot write to artifacts directory',
      });
    }

    const hasFailure = checks.some(c => c.status === 'fail');

    if (options.json) {
      process.stdout.write(JSON.stringify({ checks, healthy: !hasFailure }, null, 2) + '\n');
    } else {
      for (const check of checks) {
        const icon = check.status === 'ok' ? 'OK' : check.status === 'warn' ? 'WARN' : 'FAIL';
        process.stderr.write(`[${icon}] ${check.name}: ${check.message}\n`);
      }
      process.stderr.write(hasFailure ? '\nDoctor found issues.\n' : '\nAll checks passed.\n');
    }

    process.exit(hasFailure ? EXIT_BUG : EXIT_SUCCESS);
  });

// ============================================================================
// Contracts Check Command
// ============================================================================

program
  .command('contracts:check')
  .description('Validate contract compatibility with canonical schemas')
  .option('--json', 'Emit JSON output to stdout', false)
  .action(options => {
    const startedAt = new Date().toISOString();
    const results: Array<{ schema: string; valid: boolean; error?: string }> = [];

    try {
      // Validate core schemas are parseable
      const schemas = [
        { name: 'IngestInputSchema', schema: IngestInputSchema },
        { name: 'CorrelationInputSchema', schema: CorrelationInputSchema },
        { name: 'RunbookInputSchema', schema: RunbookInputSchema },
        { name: 'ReportInputSchema', schema: ReportInputSchema },
      ];

      for (const { name, schema } of schemas) {
        try {
          // Verify schema is a valid Zod schema
          if (typeof schema.safeParse !== 'function') {
            results.push({ schema: name, valid: false, error: 'Not a valid Zod schema' });
          } else {
            results.push({ schema: name, valid: true });
          }
        } catch (err) {
          results.push({
            schema: name,
            valid: false,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      // Validate fixture compatibility if available
      if (existsSync('fixtures/jobforge/input.json')) {
        try {
          const fixtureContent = readFileSync('fixtures/jobforge/input.json', 'utf-8');
          JSON.parse(fixtureContent);
          results.push({ schema: 'fixture:jobforge-input', valid: true });
        } catch (err) {
          results.push({
            schema: 'fixture:jobforge-input',
            valid: false,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      const allValid = results.every(r => r.valid);

      if (options.json) {
        process.stdout.write(
          JSON.stringify({ results, allValid, checkedAt: startedAt }, null, 2) + '\n'
        );
      } else {
        for (const r of results) {
          const icon = r.valid ? 'OK' : 'FAIL';
          process.stderr.write(`[${icon}] ${r.schema}${r.error ? `: ${r.error}` : ''}\n`);
        }
        process.stderr.write(allValid ? '\nAll contracts valid.\n' : '\nContract check failed.\n');
      }

      process.exit(allValid ? EXIT_SUCCESS : EXIT_VALIDATION);
    } catch (error) {
      if (options.json) {
        process.stdout.write(JSON.stringify(toErrorEnvelope(error), null, 2) + '\n');
      } else {
        process.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`);
      }
      process.exit(EXIT_BUG);
    }
  });

// ============================================================================
// Analyze Command (JobForge Integration - legacy compat)
// ============================================================================

program
  .command('analyze')
  .description('Generate JobForge request bundle and report (runnerless, dry-run)')
  .requiredOption('--inputs <path>', 'Path to analysis inputs JSON')
  .requiredOption('--tenant <tenant>', 'Tenant ID')
  .requiredOption('--project <project>', 'Project ID')
  .requiredOption('--trace <trace>', 'Trace ID')
  .requiredOption('--out <dir>', 'Output directory')
  .option('--json', 'Emit JSON output to stdout', false)
  .option('--stable-output', 'Write deterministic outputs for fixtures/docs', false)
  .action(async options => {
    const startedAt = new Date().toISOString();
    const ctx = createRunContext({ out: options.out, json: options.json, dryRun: true });

    try {
      ctx.logger.info('analyze: starting', { tenant: options.tenant, project: options.project });

      if (!existsSync(options.inputs)) {
        throw Object.assign(new Error(`Inputs file not found: ${options.inputs}`), {
          name: 'ZodError',
          errors: [{ path: ['inputs'], message: `File not found: ${options.inputs}` }],
        });
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

      ctx.logger.info('analyze: complete');
      finishSuccess(ctx, 'analyze', startedAt, {
        requests: (result.jobRequestBundle as { requests: unknown[] }).requests.length,
      });
    } catch (error) {
      handleError(error, ctx, 'analyze', startedAt);
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
  .option('--out <dir>', 'Artifact output directory', './artifacts')
  .option('--output <path>', 'Output file path')
  .option('--json', 'Emit JSON output to stdout', false)
  .option('--dry-run', 'Dry-run mode', false)
  .action(async options => {
    const startedAt = new Date().toISOString();
    const ctx = createRunContext({ out: options.out, json: options.json, dryRun: options.dryRun });

    try {
      ctx.logger.info('ingest: starting', { tenant: options.tenant, project: options.project });

      let alerts: Alert[] = [];

      if (options.file && existsSync(options.file)) {
        const content = readFileSync(options.file, 'utf-8');
        const parsed = JSON.parse(content);
        alerts = (Array.isArray(parsed) ? parsed : (parsed.alerts ?? [])) as Alert[];
        ctx.logger.info('ingest: loaded alerts', { count: alerts.length, file: options.file });
      }

      let rawEvents: Record<string, unknown>[] = [];
      if (options.rawEvents) {
        rawEvents = JSON.parse(options.rawEvents) as Record<string, unknown>[];
        ctx.logger.info('ingest: parsed raw events', { count: rawEvents.length });
      }

      const input: IngestInput = {
        tenant_id: options.tenant,
        project_id: options.project,
        source: options.source,
        alerts: alerts.length > 0 ? alerts : undefined,
        raw_events: rawEvents.length > 0 ? rawEvents : undefined,
        log_summary: options.logSummary,
        manifest_path: options.manifest,
        profile_id: options.profile,
        time_range:
          options.start && options.end ? { start: options.start, end: options.end } : undefined,
      };

      const validated = IngestInputSchema.parse(input) as IngestInput;

      const validatedAlerts = (validated.alerts ?? []) as Alert[];
      const validatedEvents = (validated.raw_events ?? []) as unknown[];

      if (validatedAlerts.length > 0) {
        const metrics = calculateAlertMetrics(validatedAlerts);
        ctx.logger.info('ingest: alert metrics', { metrics });
      }

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
        ctx.logger.info('ingest: output written', { path: options.output });
      } else if (ctx.json) {
        process.stdout.write(output + '\n');
      } else {
        process.stdout.write(output + '\n');
      }

      finishSuccess(ctx, 'ingest', startedAt, result);
    } catch (error) {
      handleError(error, ctx, 'ingest', startedAt);
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
  .option('--out <dir>', 'Artifact output directory', './artifacts')
  .option('--output <path>', 'Output file path')
  .option('--json', 'Emit JSON output to stdout', false)
  .option('--dry-run', 'Dry-run mode', false)
  .option('--jobs', 'Generate JobForge job requests', false)
  .action(async options => {
    const startedAt = new Date().toISOString();
    const ctx = createRunContext({ out: options.out, json: options.json, dryRun: options.dryRun });

    try {
      ctx.logger.info('correlate: starting', { tenant: options.tenant, project: options.project });

      if (!existsSync(options.file)) {
        throw new Error(`File not found: ${options.file}`);
      }

      const content = readFileSync(options.file, 'utf-8');
      const parsed = JSON.parse(content);
      const rawAlerts = Array.isArray(parsed) ? parsed : (parsed.alerts ?? []);

      ctx.logger.info('correlate: loaded alerts', { count: rawAlerts.length });

      const alerts = validateAlerts(rawAlerts as Alert[]);

      const filter: AlertFilter = {};
      if (options.services) {
        filter.services = options.services.split(',').map((s: string) => s.trim());
      }
      if (options.sources) {
        filter.sources = options.sources.split(',').map((s: string) => s.trim());
      }

      const filteredAlerts = Object.keys(filter).length > 0 ? filterAlerts(alerts, filter) : alerts;

      ctx.logger.info('correlate: filtered', { count: filteredAlerts.length });

      const profile = getOpsProfile(options.profile);

      const input: CorrelationInput = {
        tenant_id: options.tenant,
        project_id: options.project,
        alerts: filteredAlerts,
        profile_id: options.profile,
        time_window_minutes: parseInt(options.window, 10),
      };

      const validated = CorrelationInputSchema.parse(input) as CorrelationInput;

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

      ctx.logger.info('correlate: groups found', {
        groups: correlationSummary.groups.length,
        totalAlerts: correlationSummary.summary.total_alerts,
        ungrouped: correlationResult.ungrouped.length,
      });

      let jobs: JobRequest[] = [];
      if (options.jobs) {
        const tenantContext = { tenant_id: options.tenant, project_id: options.project };
        jobs = createAlertCorrelationJobs(tenantContext, correlation);
        ctx.logger.info('correlate: jobs generated', { count: jobs.length });
      }

      const result = {
        correlation,
        jobs: options.jobs ? jobs : undefined,
      };

      const output = JSON.stringify(result, null, 2);

      if (options.output) {
        writeFileSync(options.output, output);
        ctx.logger.info('correlate: output written', { path: options.output });
      } else {
        process.stdout.write(output + '\n');
      }

      finishSuccess(ctx, 'correlate', startedAt, result);
    } catch (error) {
      handleError(error, ctx, 'correlate', startedAt);
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
  .option('--out <dir>', 'Artifact output directory', './artifacts')
  .option('--output <path>', 'Output file path')
  .option('--json', 'Emit JSON output to stdout', false)
  .option('--dry-run', 'Dry-run mode', false)
  .option('--jobs', 'Generate JobForge job requests', false)
  .action(async options => {
    const startedAt = new Date().toISOString();
    const ctx = createRunContext({ out: options.out, json: options.json, dryRun: options.dryRun });

    try {
      ctx.logger.info('runbook: starting', { tenant: options.tenant, project: options.project });

      if (!existsSync(options.file)) {
        throw new Error(`File not found: ${options.file}`);
      }

      const content = readFileSync(options.file, 'utf-8');
      const alertGroup = JSON.parse(content) as RunbookInput['alert_group'];

      const input: RunbookInput = {
        tenant_id: options.tenant,
        project_id: options.project,
        alert_group: alertGroup,
        profile_id: options.profile,
        include_automation: options.includeAutomation,
      };

      const validated = RunbookInputSchema.parse(input) as RunbookInput;

      const runbookInput = validated.alert_group as RunbookInput['alert_group'];
      const runbook = generateRunbook(runbookInput as CorrelatedAlertGroup, {
        includeAutomation: options.includeAutomation,
        includeRollback: options.includeRollback,
      }) as unknown as Runbook;
      const runbookSteps = runbook.steps as Array<{
        automated: boolean;
        requires_approval: boolean;
      }>;

      ctx.logger.info('runbook: generated', {
        name: runbook.name,
        steps: runbookSteps.length,
        automated: runbookSteps.filter(s => s.automated).length,
        requiresApproval: runbookSteps.filter(s => s.requires_approval).length,
        durationMinutes: runbook.estimated_duration_minutes,
      });

      let jobs: JobRequest[] = [];
      if (options.jobs) {
        const tenantContext = { tenant_id: options.tenant, project_id: options.project };
        jobs = createRunbookJobs(tenantContext, runbook);
        ctx.logger.info('runbook: jobs generated', { count: jobs.length });
      }

      const result = {
        runbook,
        jobs: options.jobs ? jobs : undefined,
      };

      const output = JSON.stringify(result, null, 2);

      if (options.output) {
        writeFileSync(options.output, output);
        ctx.logger.info('runbook: output written', { path: options.output });
      } else {
        process.stdout.write(output + '\n');
      }

      finishSuccess(ctx, 'runbook', startedAt, result);
    } catch (error) {
      handleError(error, ctx, 'runbook', startedAt);
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
  .option(
    '--type <type>',
    'Report type (incident_postmortem, health_check, trend_analysis, compliance)',
    'health_check'
  )
  .requiredOption('--start <iso>', 'Period start (ISO 8601)')
  .requiredOption('--end <iso>', 'Period end (ISO 8601)')
  .option('--profile <profile>', 'Profile ID', 'ops-base')
  .option('--services <list>', 'Services to include (comma-separated)')
  .option('--alerts-file <file>', 'Path to alerts file for analysis')
  .option('--out <dir>', 'Artifact output directory', './artifacts')
  .option('--output <path>', 'Output file path')
  .option('--json', 'Emit JSON output to stdout', false)
  .option('--dry-run', 'Dry-run mode', false)
  .option('--jobs', 'Generate JobForge job requests', false)
  .action(async options => {
    const startedAt = new Date().toISOString();
    const ctx = createRunContext({ out: options.out, json: options.json, dryRun: options.dryRun });

    try {
      ctx.logger.info('report: starting', { tenant: options.tenant, project: options.project });

      const services = options.services
        ? options.services.split(',').map((s: string) => s.trim())
        : undefined;

      let alerts: Alert[] = [];
      if (options.alertsFile && existsSync(options.alertsFile)) {
        const content = readFileSync(options.alertsFile, 'utf-8');
        const parsed = JSON.parse(content);
        alerts = Array.isArray(parsed) ? parsed : (parsed.alerts ?? []);
        ctx.logger.info('report: loaded alerts', { count: alerts.length });
      }

      const input: ReportInput = {
        tenant_id: options.tenant,
        project_id: options.project,
        report_type: options.type,
        period_start: options.start,
        period_end: options.end,
        services,
        profile_id: options.profile,
      };

      const validated = ReportInputSchema.parse(input) as ReportInput;

      const report = generateReliabilityReport(validated, alerts) as unknown as ReliabilityReport;
      const reportStats = report as {
        service_health: unknown[];
        anomalies: unknown[];
        findings: unknown[];
        recommendations: unknown[];
        overall_health_score: number;
      };

      ctx.logger.info('report: generated', {
        type: validated.report_type,
        services: reportStats.service_health.length,
        anomalies: reportStats.anomalies.length,
        findings: reportStats.findings.length,
        recommendations: reportStats.recommendations.length,
        healthScore: reportStats.overall_health_score,
      });

      let jobs: JobRequest[] = [];
      if (options.jobs) {
        const tenantContext = { tenant_id: options.tenant, project_id: options.project };
        jobs = createReliabilityReportJobs(tenantContext, report);
        ctx.logger.info('report: jobs generated', { count: jobs.length });
      }

      const result = {
        report,
        jobs: options.jobs ? jobs : undefined,
      };

      const output = JSON.stringify(result, null, 2);

      if (options.output) {
        writeFileSync(options.output, output);
        ctx.logger.info('report: output written', { path: options.output });
      } else {
        process.stdout.write(output + '\n');
      }

      finishSuccess(ctx, 'report', startedAt, result);
    } catch (error) {
      handleError(error, ctx, 'report', startedAt);
    }
  });

// ============================================================================
// Demo Command (demonstrate runner execution)
// ============================================================================

program
  .command('demo')
  .description('Run a demo execution of the ops autopilot runner')
  .option('--tenant <tenant>', 'Tenant ID for demo', 'demo-tenant')
  .option('--project <project>', 'Project ID for demo', 'demo-project')
  .option('--out <dir>', 'Artifact output directory', './artifacts')
  .option('--json', 'Emit JSON output to stdout', false)
  .action(async options => {
    const startedAt = new Date().toISOString();
    const ctx = createRunContext({ out: options.out, json: options.json, dryRun: false });

    try {
      ctx.logger.info('demo: starting', { tenant: options.tenant, project: options.project });

      const result = await runDemo({
        tenantId: options.tenant,
        projectId: options.project,
      });

      ctx.logger.info('demo: completed', {
        status: result.status,
        hasOutput: !!result.output,
        hasError: !!result.error,
      });

      if (ctx.json) {
        process.stdout.write(
          JSON.stringify(
            {
              status: 'success',
              runId: ctx.runId,
              demoResult: result,
              artifactDir: ctx.artifacts.dir,
            },
            null,
            2
          ) + '\n'
        );
      } else {
        console.log('Demo execution completed');
        console.log(`Status: ${result.status}`);
        if (result.error) {
          console.log(`Error: ${result.error}`);
        }
        console.log(`Evidence: ${ctx.artifacts.dir}/evidence.json`);
      }

      finishSuccess(ctx, 'demo', startedAt, result);
    } catch (error) {
      handleError(error, ctx, 'demo', startedAt);
    }
  });

// ============================================================================
// Replay Command (reuse artifacts for diagnosis)
// ============================================================================

program
  .command('replay')
  .description('Replay a previous run from its artifact directory')
  .requiredOption('--artifact-dir <dir>', 'Path to artifact directory')
  .option('--json', 'Emit JSON output to stdout', false)
  .action(options => {
    try {
      const loaded = loadArtifacts(options.artifactDir);
      const { summary, logs, evidence } = loaded;

      if (!summary) {
        process.stderr.write(`No summary.json found in ${options.artifactDir}\n`);
        process.exit(EXIT_VALIDATION);
      }

      if (options.json) {
        process.stdout.write(
          JSON.stringify(
            { summary, logCount: logs.length, evidenceFiles: Object.keys(evidence) },
            null,
            2
          ) + '\n'
        );
      } else {
        process.stderr.write(`Run ID: ${summary.runId}\n`);
        process.stderr.write(`Command: ${summary.command}\n`);
        process.stderr.write(`Status: ${summary.status}\n`);
        process.stderr.write(`Started: ${summary.startedAt}\n`);
        process.stderr.write(`Completed: ${summary.completedAt}\n`);
        process.stderr.write(`Dry Run: ${summary.dryRun}\n`);
        process.stderr.write(`Log Lines: ${summary.logLineCount}\n`);
        process.stderr.write(`Evidence Files: ${summary.evidenceFiles.join(', ')}\n`);
        if (summary.error) {
          process.stderr.write(`Error: ${summary.error.userMessage}\n`);
          process.stderr.write(`Error Code: ${summary.error.code}\n`);
          process.stderr.write(`Retryable: ${summary.error.retryable}\n`);
        }
      }

      process.exit(EXIT_SUCCESS);
    } catch (error) {
      process.stderr.write(
        `Replay failed: ${error instanceof Error ? error.message : String(error)}\n`
      );
      process.exit(EXIT_BUG);
    }
  });

// ============================================================================
// Execute CLI
// ============================================================================

program.parse();
