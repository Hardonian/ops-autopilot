# Runner Maturity (Ops Autopilot)

This document enumerates runner maturity requirements for all Ops Autopilot runners (including runnerless JobForge request emitters).

## Execution guarantees (idempotency + retry)

- **Idempotency** is required for every runner. Health audits cache results by `idempotency_key`, and JobForge request emission relies on deterministic idempotency keys in bundles.
- **Retry semantics** are defined per runner in the runner catalog and validated by CI.

## Metrics (success/failure + standard export)

Each runner defines success/failure, latency, retry, idempotency, and cost metrics. The catalog can be exported in OpenMetrics format using:

```ts
import { exportRunnerMetricsOpenMetrics } from 'ops-autopilot';

const metricsText = exportRunnerMetricsOpenMetrics();
```

OpenMetrics output includes standard `# HELP`, `# TYPE`, and `# UNIT` lines for Prometheus-compatible ingestion.

## Cost awareness (FinOps hooks)

FinOps hooks are mandatory. Each runner definition provides:

- `finops_owner` and `cost_center`
- per-execution cost estimates and hard caps
- max executions per run (guardrail for unbounded cost)

Runnerless JobForge request emission attaches FinOps metadata to request `metadata.finops`, and health audits publish `execution_metadata.cost_usd_estimate`.

## Runner inventory

### Runner: ops.health_audit

- **Purpose**: Audit infrastructure health signals and surface reliability findings.
- **Inputs**: tenant/project identifiers, service list (max 25), audit depth, metrics, time range, idempotency key.
- **Outputs**: HealthAuditOutput with findings/metrics/recommendations plus execution metadata (attempts, latency, cost).
- **Failure modes**:
  - Dependency health API unavailable
  - Timeout budget exceeded
  - Circuit breaker open after repeated failures
  - Idempotency key collision returns cached result

### Runner: autopilot.ops.alert_correlate

- **Purpose**: Emit correlation requests for critical alert groups (runnerless).
- **Inputs**: AlertCorrelation groups, tenant context, trace id.
- **Outputs**: JobForge JobRequest for alert correlation.
- **Failure modes**:
  - JobForge request validation failure
  - Request bundle exceeds cost cap

### Runner: autopilot.ops.runbook_generate

- **Purpose**: Emit runbook generation/execution requests (runnerless).
- **Inputs**: Runbook data, tenant context, trace id.
- **Outputs**: JobForge JobRequest for runbook generation or notifications.
- **Failure modes**:
  - JobForge request validation failure
  - Request bundle exceeds cost cap

### Runner: autopilot.ops.reliability_report

- **Purpose**: Emit reliability report follow-up requests (runnerless).
- **Inputs**: Reliability report summary, tenant context, trace id.
- **Outputs**: JobForge JobRequest for reliability report actions.
- **Failure modes**:
  - JobForge request validation failure
  - Request bundle exceeds cost cap
