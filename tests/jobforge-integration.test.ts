import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import {
  analyze,
  serializeBundle,
  serializeReport,
  validateBundle,
  validateReportBundle,
} from '../src/jobforge/integration.js';
import { hashCanonicalJson } from '../src/jobforge/canonical.js';

function readJson(path: string) {
  return JSON.parse(readFileSync(path, 'utf-8'));
}

function preflight(bundle: ReturnType<typeof analyze>['jobRequestBundle']) {
  const errors: string[] = [];

  for (const request of bundle.requests) {
    if (request.tenant_context.tenant_id !== bundle.tenant_id) {
      errors.push('tenant_id mismatch in job request');
    }
    if (request.tenant_context.project_id !== bundle.project_id) {
      errors.push('project_id mismatch in job request');
    }
    if (request.payload.action && !request.policy.requires_policy_token) {
      errors.push('action request missing policy token requirement');
    }
    if (request.payload.action && !request.policy.requires_approval) {
      errors.push('action request missing approval requirement');
    }
  }

  return errors;
}

describe('JobForge integration fixtures', () => {
  it('matches stable fixtures', () => {
    const input = readJson('fixtures/jobforge/input.json');
    const result = analyze(input, { stableOutput: true });

    const bundleFixture = readFileSync('fixtures/jobforge/request-bundle.json', 'utf-8');
    const reportFixture = readFileSync('fixtures/jobforge/report.json', 'utf-8');
    const reportMarkdownFixture = readFileSync('fixtures/jobforge/report.md', 'utf-8');

    expect(serializeBundle(result.jobRequestBundle)).toBe(bundleFixture);
    expect(serializeReport(result.reportEnvelope)).toBe(reportFixture);
    expect(reportMarkdownFixture).toContain('# Ops Autopilot Report');

    expect(result.reportEnvelope.report.report_id).toBe('00000000-0000-0000-0000-000000000000');
    expect(result.reportEnvelope.report.module.name).toBe('ops-autopilot');
    expect(result.reportEnvelope.report.generated_at).toBe('2000-01-01T00:00:00.000Z');
    expect(result.reportEnvelope.report.findings.alerts_total).toBe(2);
    expect(result.reportEnvelope.report.findings.alerts_critical).toBe(1);

    expect(result.reportEnvelope.report.job_requests.length).toBeGreaterThan(0);
    expect(result.reportEnvelope.report.job_requests[0].metadata.idempotency_key).toBeDefined();
  });

  it('validates bundle and report schemas', () => {
    const bundle = readJson('fixtures/jobforge/request-bundle.json');
    const report = readJson('fixtures/jobforge/report.json');

    const bundleValidation = validateBundle(bundle);
    const reportValidation = validateReportBundle(report);

    expect(bundleValidation.valid).toBe(true);
    expect(reportValidation.valid).toBe(true);
  });

  it('uses canonical hashing for outputs', () => {
    const bundle = readJson('fixtures/jobforge/request-bundle.json');
    const report = readJson('fixtures/jobforge/report.json');

    const bundleHash = hashCanonicalJson({
      schema_version: bundle.schema_version,
      module_id: bundle.module_id,
      tenant_id: bundle.tenant_id,
      project_id: bundle.project_id,
      trace_id: bundle.trace_id,
      created_at: bundle.created_at,
      dry_run: bundle.dry_run,
      requests: bundle.requests,
      idempotency_keys: bundle.idempotency_keys,
    });

    expect(bundleHash.hash).toBe(bundle.canonicalization.hash);

    const reportHash = hashCanonicalJson({
      schema_version: report.schema_version,
      module_id: report.module_id,
      tenant_id: report.tenant_id,
      project_id: report.project_id,
      trace_id: report.trace_id,
      created_at: report.created_at,
      dry_run: report.dry_run,
      report: report.report,
      idempotency_keys: report.idempotency_keys,
    });

    expect(reportHash.hash).toBe(report.canonicalization.hash);
  });

  it('passes JobForge executor preflight rules', () => {
    const bundle = readJson('fixtures/jobforge/request-bundle.json');
    expect(preflight(bundle)).toHaveLength(0);
  });

  it('rejects negative fixtures', () => {
    const negativeFixtures = [
      'fixtures/jobforge/negative/missing-tenant.json',
      'fixtures/jobforge/negative/wrong-schema-version.json',
      'fixtures/jobforge/negative/missing-idempotency.json',
      'fixtures/jobforge/negative/action-without-policy.json',
    ];

    for (const fixture of negativeFixtures) {
      const bundle = readJson(fixture);
      const validation = validateBundle(bundle);
      const preflightErrors = preflight(bundle);

      expect(validation.valid === false || preflightErrors.length > 0).toBe(true);
    }
  });
});
