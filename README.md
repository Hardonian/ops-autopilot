# Ops Autopilot

A runnerless reliability autopilot that consumes events/manifests/log summaries, detects anomalies, produces diagnoses + recommendations, and outputs JobForge job requests (or runbooks) WITHOUT owning execution. JobForge executes any remediation via gated action jobs.

## Overview

Ops Autopilot is part of the `@autopilot/*` suite. It provides:

- **Alert Correlation**: Groups related infrastructure alerts to identify root causes and reduce noise
- **Runbook Generation**: Creates incident response runbooks from correlated alert groups
- **Reliability Reporting**: Generates health checks, trend analyses, and incident postmortems
- **JobForge Integration**: Outputs job requests for ops tasks (alert correlation, runbook generation, reliability reports)

**Key Principle**: All job requests enforce runnerless constraints:

- `auto_execute: false` - No local execution
- `require_approval: true` - Human approval required
- `require_policy_token: true` - Policy enforcement

## Installation

```bash
npm install @autopilot/ops-autopilot
```

## Quick Start

### CLI Usage

```bash
# JobForge-compatible analysis (bundle + report)
ops-autopilot analyze \
  --inputs ./fixtures/jobforge/input.json \
  --tenant acme-prod \
  --project api-platform \
  --trace trace-123 \
  --out ./out \
  --stable-output

# Ingest alerts from a file
ops-autopilot ingest \
  --tenant acme-prod \
  --project api-platform \
  --file ./alerts.json \
  --source cloudwatch

# Correlate alerts to find patterns
ops-autopilot correlate \
  --tenant acme-prod \
  --project api-platform \
  --file ./alerts.json \
  --jobs \
  --output ./correlation-result.json

# Generate runbook from alert group
ops-autopilot runbook \
  --tenant acme-prod \
  --project api-platform \
  --file ./alert-group.json \
  --jobs \
  --output ./runbook.json

# Generate reliability report
ops-autopilot report \
  --tenant acme-prod \
  --project api-platform \
  --type health_check \
  --start 2026-01-01T00:00:00Z \
  --end 2026-01-31T23:59:59Z \
  --jobs \
  --output ./report.json
```

### CLI Command Table

| Command     | Purpose                                        | Example                                                                                                                          |
| ----------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `ingest`    | Ingest alerts/events/log summaries             | `ops-autopilot ingest --tenant t --project p --file ./alerts.json`                                                               |
| `correlate` | Correlate alerts into groups                   | `ops-autopilot correlate --tenant t --project p --file ./alerts.json --jobs`                                                     |
| `runbook`   | Generate runbook from alert group              | `ops-autopilot runbook --tenant t --project p --file ./alert-group.json --jobs`                                                  |
| `report`    | Generate reliability report                    | `ops-autopilot report --tenant t --project p --type health_check --start 2026-01-01T00:00:00Z --end 2026-01-31T23:59:59Z --jobs` |
| `analyze`   | JobForge integration surface (bundle + report) | `ops-autopilot analyze --inputs ./fixtures/jobforge/input.json --tenant t --project p --trace trace --out ./out`                 |

## JobForge Integration

Ops Autopilot provides a first-class JobForge integration surface that emits:

- `request-bundle.json` (JobRequestBundle)
- `report.json` (ReportEnvelopeBundle)
- `report.md` (Markdown rendering)

The module remains runnerless; it only generates requests and reports.
`schema_version` is pinned to `1.0.0`, and `--stable-output` ensures deterministic output for fixtures and documentation.

```bash
ops-autopilot analyze \
  --inputs ./fixtures/jobforge/input.json \
  --tenant acme-prod \
  --project api-platform \
  --trace trace-123 \
  --out ./out
```

See [docs/jobforge-integration.md](./docs/jobforge-integration.md) for bundle validation and ingestion guidance.

### Programmatic Usage

```typescript
import {
  // Contracts
  validateAlerts,
  type Alert,
  type CorrelatedAlertGroup,

  // Alert correlation
  correlateAlerts,
  createAlertCorrelation,

  // Runbook generation
  generateRunbook,

  // JobForge requests
  createAlertCorrelationJobs,
  createRunbookJobs,

  // Profiles
  getOpsProfile,
  analyze,
  renderReport,
} from '@autopilot/ops-autopilot';

// Load and validate alerts
const alerts: Alert[] = validateAlerts(rawAlertData);

// Correlate alerts
const correlationResult = correlateAlerts(alerts);
const correlation = createAlertCorrelation(
  'acme-prod',
  'api-platform',
  correlationResult,
  'ops-base'
);

// Generate runbook for first correlated group
if (correlation.groups.length > 0) {
  const runbook = generateRunbook(correlation.groups[0]);

  // Generate JobForge job requests
  const tenantContext = { tenant_id: 'acme-prod', project_id: 'api-platform' };
  const jobs = [
    ...createAlertCorrelationJobs(tenantContext, correlation),
    ...createRunbookJobs(tenantContext, runbook),
  ];

  // Jobs are ready for submission to JobForge
  console.log(JSON.stringify(jobs, null, 2));
}

// JobForge integration surface
const { reportEnvelope, jobRequestBundle } = analyze({
  tenant_id: 'acme-prod',
  project_id: 'api-platform',
  trace_id: 'trace-123',
  alerts,
  report: {
    tenant_id: 'acme-prod',
    project_id: 'api-platform',
    report_type: 'health_check',
    period_start: '2026-01-01T00:00:00Z',
    period_end: '2026-01-31T23:59:59Z',
    profile_id: 'ops-base',
  },
});

const markdown = renderReport(reportEnvelope);
console.log(jobRequestBundle, markdown);
```

## Architecture

### Module Structure

```
src/
├── contracts/      # Domain-specific Zod schemas
│   └── index.ts    # Alert, AlertCorrelation, Runbook, ReliabilityReport schemas
├── alerts/         # Alert correlation logic
│   └── index.ts    # Correlate, filter, validate alerts
├── runbooks/       # Runbook generation
│   └── index.ts    # Generate runbooks from alert groups
├── jobforge/       # Job request generators
│   └── index.ts    # Ops job requests (alert_correlate, runbook_generate, reliability_report)
├── profiles/       # Base + per-app overlays
│   └── index.ts    # Ops-specific profile configurations
├── cli.ts          # CLI entrypoint
└── index.ts        # Public API exports
```

### Integration with Autopilot Suite

Ops Autopilot integrates with:

- `@autopilot/contracts`: Base schemas (JobRequest, Finding, etc.)
- `@autopilot/jobforge-client`: Job request builders and validation
- `@autopilot/profiles`: Base profiles with ops-specific overlays

## Schemas

### Alert

```typescript
const AlertSchema = z.object({
  alert_id: z.string(),
  tenant_id: TenantIdSchema,
  project_id: ProjectIdSchema,
  source: z.enum([
    'cloudwatch',
    'datadog',
    'prometheus',
    'grafana',
    'pagerduty',
    'opsgenie',
    'newrelic',
    'sentry',
    'custom',
  ]),
  status: z.enum(['open', 'acknowledged', 'resolved', 'suppressed']),
  title: z.string(),
  description: z.string(),
  severity: z.enum(['info', 'warning', 'critical', 'opportunity']),
  service: z.string(),
  metric: z.string().optional(),
  threshold: z.number().optional(),
  current_value: z.number().optional(),
  timestamp: z.string().datetime(),
  correlation_id: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
```

### AlertCorrelation

```typescript
const AlertCorrelationSchema = z.object({
  correlation_id: z.string(),
  tenant_id: TenantIdSchema,
  project_id: ProjectIdSchema,
  groups: z.array(CorrelatedAlertGroupSchema),
  summary: z.object({
    total_alerts: z.number(),
    total_groups: z.number(),
    new_groups: z.number(),
    resolved_groups: z.number(),
  }),
  generated_at: z.string().datetime(),
  profile_id: z.string(),
});
```

### Runbook

```typescript
const RunbookSchema = z.object({
  runbook_id: z.string(),
  tenant_id: TenantIdSchema,
  project_id: ProjectIdSchema,
  name: z.string(),
  description: z.string(),
  trigger_conditions: z.array(...),
  severity: SeveritySchema,
  estimated_duration_minutes: z.number(),
  steps: z.array(RunbookStepSchema),
  prerequisites: z.array(z.string()),
  post_conditions: z.array(z.string()),
  rollback_procedure: z.string().optional(),
  related_runbooks: z.array(z.string()).optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  version: z.string(),
  generated_by: z.enum(['ai', 'manual', 'hybrid']),
});
```

### ReliabilityReport

```typescript
const ReliabilityReportSchema = z.object({
  report_id: z.string(),
  tenant_id: TenantIdSchema,
  project_id: ProjectIdSchema,
  report_type: z.enum(['incident_postmortem', 'health_check', 'trend_analysis', 'compliance']),
  period_start: z.string().datetime(),
  period_end: z.string().datetime(),
  generated_at: z.string().datetime(),
  overall_health_score: z.number(),
  service_health: z.array(InfrastructureHealthSchema),
  anomalies: z.array(AnomalyDetectionSchema),
  findings: z.array(FindingSchema),
  recommendations: z.array(...),
  job_requests: z.array(JobRequestSchema),
  profile_id: z.string(),
  report_hash: z.string(),
  redaction_applied: z.boolean(),
});
```

## JobForge Job Types

Ops Autopilot generates jobs for these types:

| Job Type                           | Purpose                            | Payload                                                                                              |
| ---------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `autopilot.ops.alert_correlate`    | Correlate alerts across services   | `{ alert_ids: string[], time_window_minutes?: number, profile_id: string }`                          |
| `autopilot.ops.runbook_generate`   | Generate incident response runbook | `{ alert_group_id: string, root_cause: string, affected_services: string[], severity: string, ... }` |
| `autopilot.ops.reliability_report` | Generate reliability report        | `{ report_type: string, period_start: string, period_end: string, include_anomalies: boolean, ... }` |

## Profiles

Ops Autopilot provides pre-configured profiles:

| Profile          | Description               | Use Case                                        |
| ---------------- | ------------------------- | ----------------------------------------------- |
| `ops-base`       | Default ops configuration | General infrastructure monitoring               |
| `ops-jobforge`   | Optimized for JobForge    | Stricter thresholds for critical infrastructure |
| `ops-settler`    | Optimized for Settler     | Payment processing reliability                  |
| `ops-readylayer` | Optimized for ReadyLayer  | Feature flag infrastructure                     |
| `ops-aias`       | Optimized for AIAS        | AI infrastructure monitoring                    |
| `ops-keys`       | Optimized for Keys        | Key management infrastructure                   |

```typescript
// Use a profile
const profile = getOpsProfile('ops-jobforge');

// Check thresholds
const result = checkOpsThreshold(profile, 'error_rate_spike', 3.5);
if (result.exceeded) {
  console.log(`Threshold exceeded: ${result.level}`);
}
```

## Alert Correlation

Correlation rules identify related alerts:

```typescript
// Default correlation rules
const rules = defaultCorrelationRules;

// Custom correlation
const result = correlateAlerts(alerts, rules, profile);

// Results include:
// - Grouped alerts by correlation pattern
// - Root cause analysis with confidence scores
// - Blast radius estimation
// - Ungrouped alerts (noise reduction)
```

## Runbook Templates

Built-in templates for common scenarios:

- **Service Degradation Response**: Handle degraded service performance
- **Cascade Failure Recovery**: Recover from multi-service failures
- **Resource Exhaustion Resolution**: Address CPU, memory, or disk issues
- **Database Connection Pool Recovery**: Resolve DB connection issues
- **Post-Deployment Incident Response**: Rollback deployment issues

## Development

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Run tests
pnpm test

# Run linting
pnpm lint

# Type check
pnpm typecheck

# Run CLI locally
pnpm run cli -- ingest --tenant test --project test --file ./examples/alerts.json
```

## Testing

```bash
# Run all tests
npm run test

# Run specific test file
npx vitest run tests/alerts.test.ts

# Watch mode
npm run test:watch
```

## CI/CD

GitHub Actions workflow included:

```yaml
# .github/workflows/ci.yml
# Runs on: pull requests (verify:fast), pushes to main (verify:full + docs:verify)
# Node.js 20.x
# Steps: install, verify scripts
```

## License

MIT

## Related Packages

- `@autopilot/contracts`: Base schemas and types
- `@autopilot/jobforge-client`: JobForge request builders
- `@autopilot/profiles`: Profile system with overlays
