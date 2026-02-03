import { readFileSync } from 'fs';
import { analyze, serializeBundle, serializeReport, validateBundle, validateReportBundle } from '../dist/jobforge/integration.js';
import { hashCanonicalJson } from '../dist/jobforge/canonical.js';

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf-8'));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const input = readJson('fixtures/jobforge/input.json');
const result = analyze(input, { stableOutput: true });

const bundle = result.jobRequestBundle;
const report = result.reportEnvelope;

const bundleValidation = validateBundle(bundle);
assert(bundleValidation.valid, `JobRequestBundle validation failed: ${bundleValidation.errors.join(', ')}`);

const reportValidation = validateReportBundle(report);
assert(reportValidation.valid, `ReportEnvelopeBundle validation failed: ${reportValidation.errors.join(', ')}`);

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

assert(bundleHash.hash === bundle.canonicalization.hash, 'JobRequestBundle canonical hash mismatch');

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

assert(reportHash.hash === report.canonicalization.hash, 'ReportEnvelopeBundle canonical hash mismatch');

const bundleFixture = readFileSync('fixtures/jobforge/request-bundle.json', 'utf-8');
const reportFixture = readFileSync('fixtures/jobforge/report.json', 'utf-8');

assert(serializeBundle(bundle) === bundleFixture, 'request-bundle.json fixture mismatch');
assert(serializeReport(report) === reportFixture, 'report.json fixture mismatch');

console.log('contracts:compat passed');
