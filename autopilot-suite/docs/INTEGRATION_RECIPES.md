# Integration Recipes

Copy-paste integration recipes for Settler, AIAS, Keys, and ReadyLayer.

## Table of Contents

1. [Settler Integration](#settler-integration)
2. [AIAS Integration](#aias-integration)
3. [Keys Integration](#keys-integration)
4. [ReadyLayer Integration](#readylayer-integration)

---

## Settler Integration

### Event Flow

```
Settler → EventEnvelope → growth-autopilot → JobRequest → JobForge
```

### 1. Submit Event from Settler

```typescript
import { createEventEnvelope } from '@autopilot/contracts';

const event = createEventEnvelope(
  'growth.funnel_updated',
  { tenant_id: 'settler-prod', project_id: 'user-analytics' },
  {
    funnel_name: 'onboarding',
    stages: ['signup', 'profile', 'first_habit'],
    conversion_rates: [1.0, 0.75, 0.45],
  },
  {
    source: { system: 'settler', version: '2.1.0' },
    priority: 'normal',
  }
);

// Submit to event bus
await eventBus.publish(event);
```

### 2. Growth Autopilot Consumes Event

```typescript
// In growth-autopilot/src/index.ts
import { EventEnvelopeSchema, ReportEnvelope } from '@autopilot/contracts';

export async function handleEvent(event: unknown): Promise<ReportEnvelope> {
  const envelope = EventEnvelopeSchema.parse(event);
  
  // Analyze funnel
  const metrics = analyzeFunnel(envelope.payload);
  
  // Generate experiment proposals
  const proposals = proposeExperiments(metrics);
  
  // Create report with job requests
  return createReport(envelope, metrics, proposals);
}
```

### 3. Generated Job Request

```json
{
  "version": "1.0.0",
  "job_type": "autopilot.growth.experiment_propose",
  "tenant_context": {
    "tenant_id": "settler-prod",
    "project_id": "user-analytics"
  },
  "priority": "normal",
  "requested_at": "2026-02-02T12:00:00Z",
  "payload": {
    "funnel_name": "onboarding",
    "proposals_count": 3,
    "proposals": [
      {
        "id": "exp-001",
        "name": "Simplify profile creation",
        "expected_lift": 15
      }
    ]
  },
  "evidence_links": [
    {
      "type": "funnel_metrics",
      "id": "fm-001",
      "description": "Onboarding funnel: 45% drop-off at profile stage"
    }
  ],
  "policy": {
    "requires_policy_token": true,
    "risk_level": "low"
  }
}
```

### 4. JobForge Execution

JobForge receives the request, validates policy tokens, and either:
- **Auto-approves** (low risk, approved patterns)
- **Queues for review** (human approval required)
- **Rejects** (policy violation)

After execution, JobForge returns a `RunManifest`:

```json
{
  "version": "1.0.0",
  "run_id": "run-abc-123",
  "job_type": "autopilot.growth.experiment_propose",
  "status": "completed",
  "outcome": "success",
  "outputs": {
    "experiment_ids": ["exp-001", "exp-002"],
    "launch_urls": ["https://app.settler.io/experiments/exp-001"]
  }
}
```

---

## AIAS Integration

### Event Flow

```
AIAS → EventEnvelope → ops-autopilot → JobRequest → JobForge
```

### 1. Submit Event from AIAS

```typescript
import { createEventEnvelope } from '@autopilot/contracts';

const event = createEventEnvelope(
  'ops.metric_alert',
  { tenant_id: 'aias-prod', project_id: 'agent-cluster-1' },
  {
    alert_name: 'high_latency',
    metric: 'agent.response_time_p99',
    value: 2500,
    threshold: 1000,
    severity: 'warning',
    agent_ids: ['agent-001', 'agent-002'],
  },
  {
    source: { system: 'aias', version: '3.0.0' },
    priority: 'high',
  }
);
```

### 2. Ops Autopilot Analyzes

```typescript
// ops-autopilot/src/index.ts
export async function analyzeMetrics(event: EventEnvelope) {
  // Correlate with other metrics
  const correlated = await correlateMetrics(event.payload);
  
  // Check for incident patterns
  const incident = detectIncidentPattern(correlated);
  
  if (incident) {
    // Request investigation job
    return createJobRequest(
      'autopilot.ops.incident_correlate',
      event.tenant_context,
      { incident_id: incident.id, affected_agents: event.payload.agent_ids }
    );
  }
}
```

### 3. Job Request for Investigation

```json
{
  "version": "1.0.0",
  "job_type": "autopilot.ops.incident_correlate",
  "tenant_context": {
    "tenant_id": "aias-prod",
    "project_id": "agent-cluster-1"
  },
  "priority": "high",
  "payload": {
    "incident_id": "inc-2026-02-02-001",
    "affected_agents": ["agent-001", "agent-002"],
    "metric_alert": "high_latency",
    "investigation_scope": "last_24h"
  },
  "policy": {
    "requires_policy_token": true,
    "requires_approval": true,
    "risk_level": "medium"
  }
}
```

---

## Keys Integration

### Event Flow

```
Keys → EventEnvelope → finops-autopilot → JobRequest → JobForge
```

### 1. Submit Usage Event

```typescript
import { createEventEnvelope } from '@autopilot/contracts';

const event = createEventEnvelope(
  'finops.usage_reported',
  { tenant_id: 'keys-prod', project_id: 'secrets-vault' },
  {
    resource_type: 'secret_access',
    quantity: 150000,
    unit: 'requests',
    period: { start: '2026-02-01', end: '2026-02-02' },
    current_tier: 'pro',
  },
  {
    source: { system: 'keys', version: '1.5.0' },
    priority: 'normal',
  }
);
```

### 2. FinOps Autopilot Analyzes

```typescript
// finops-autopilot/src/index.ts
export function analyzeUsage(event: EventEnvelope) {
  const usage = event.payload;
  
  // Check for optimization opportunities
  const optimizations = findOptimizations(usage);
  
  // Check budget
  const budgetStatus = checkBudget(usage.tenant_context, usage.period);
  
  return {
    optimizations,
    budgetStatus,
    recommendations: generateRecommendations(optimizations, budgetStatus),
  };
}
```

### 3. Optimization Job Request

```json
{
  "version": "1.0.0",
  "job_type": "autopilot.finops.cost_optimize",
  "tenant_context": {
    "tenant_id": "keys-prod",
    "project_id": "secrets-vault"
  },
  "priority": "normal",
  "payload": {
    "optimization_type": "tier_upgrade_analysis",
    "current_usage": 150000,
    "current_tier": "pro",
    "projected_savings": 450.00,
    "recommendation": "upgrade_to_enterprise"
  },
  "cost_estimate": {
    "credits": 50,
    "confidence": "high"
  },
  "policy": {
    "requires_policy_token": true,
    "risk_level": "low"
  }
}
```

---

## ReadyLayer Integration

### Event Flow

```
ReadyLayer → EventEnvelope → ops-autopilot → JobRequest → JobForge
```

### 1. Submit Health Check Event

```typescript
import { createEventEnvelope } from '@autopilot/contracts';

const event = createEventEnvelope(
  'ops.health_check_failed',
  { tenant_id: 'readylayer-prod', project_id: 'deployments' },
  {
    environment_id: 'env-abc-123',
    environment_name: 'staging-api',
    checks_failed: ['database_connectivity', 'redis_ping'],
    last_successful_deploy: '2026-02-01T10:00:00Z',
  },
  {
    source: { system: 'readylayer', version: '2.3.0' },
    priority: 'critical',
  }
);
```

### 2. Ops Autopilot Correlates

```typescript
// ops-autopilot/src/index.ts
export async function correlateHealthChecks(event: EventEnvelope) {
  // Query recent events for same environment
  const recentEvents = await queryRecentEvents(
    event.tenant_context,
    event.payload.environment_id,
    '24h'
  );
  
  // Look for patterns
  const pattern = detectPattern([event, ...recentEvents]);
  
  if (pattern?.type === 'cascading_failure') {
    return createJobRequest(
      'autopilot.ops.health_check',
      event.tenant_context,
      {
        environment_id: event.payload.environment_id,
        pattern: pattern.type,
        affected_services: pattern.affected_services,
        recommended_action: 'rollback',
      },
      { priority: 'critical' }
    );
  }
}
```

### 3. Rollback Job Request

```json
{
  "version": "1.0.0",
  "job_type": "autopilot.ops.health_check",
  "tenant_context": {
    "tenant_id": "readylayer-prod",
    "project_id": "deployments"
  },
  "priority": "critical",
  "payload": {
    "environment_id": "env-abc-123",
    "environment_name": "staging-api",
    "pattern": "cascading_failure",
    "affected_services": ["api", "worker", "scheduler"],
    "recommended_action": "rollback",
    "target_version": "v2.2.1",
    "reason": "Database connectivity issues introduced in v2.3.0"
  },
  "policy": {
    "requires_policy_token": true,
    "requires_approval": true,
    "approver_roles": ["ops-oncall", "sre-lead"],
    "risk_level": "critical"
  },
  "expires_at": "2026-02-02T13:00:00Z"
}
```

---

## Common Patterns

### Policy Token Flow

All job requests require policy tokens for execution:

```typescript
// JobForge validates tokens before execution
const validation = await jobForge.validatePolicyToken({
  token: request.policy_token,
  required_scopes: request.policy.required_scopes,
  tenant_context: request.tenant_context,
});

if (!validation.valid) {
  return {
    status: 'rejected',
    reason: 'Invalid or insufficient policy token',
  };
}
```

### Evidence Chain

Every output links back to source:

```typescript
const report = createReportEnvelope('ops.health_assessment', tenant, module);

// Add evidence from source event
report.evidence.push({
  id: sourceEvent.event_id,
  type: 'event',
  description: `Source: ${sourceEvent.event_type}`,
  severity: 'info',
  source: sourceEvent.source.system,
});

// Generated job request inherits evidence
const jobRequest = createJobRequest(/* ... */);
jobRequest.evidence_links = report.evidence.map((e) => ({
  type: e.type,
  id: e.id,
  description: e.description,
}));
```

### Error Handling

```typescript
try {
  const result = await processEvent(event);
  return createSuccessReport(result);
} catch (error) {
  // Log error (redacted)
  logger.error('Processing failed', redact({ error: error.message }));
  
  // Return report with error evidence
  return createErrorReport(error, event);
}
```

---

## Testing Integrations

### Mock JobForge Response

```typescript
import { createMockJobResponse } from '@autopilot/contracts';

const mockResponse = createMockJobResponse(jobRequest);
// {
//   job_id: 'job-xxx',
//   status: 'queued',
//   request: jobRequest,
//   estimated_completion: '2026-02-02T13:00:00Z'
// }
```

### Validate Request

```typescript
import { validateRequest } from '@autopilot/jobforge-client';

const result = validateRequest(jobRequest);
if (!result.valid) {
  console.log('Validation errors:', result.errors);
}
```