# @autopilot/contracts

Canonical, versioned Zod schemas for Autopilot modules.

## Overview

This package provides the foundational type definitions and schemas used across all Autopilot modules. All schemas are:

- **Immutable**: Versioned by package version
- **Multi-tenant safe**: Require `tenant_id` + `project_id`
- **Evidence-linked**: Traceable to source signals
- **JobForge-compatible**: For request/response serialization

## Installation

```bash
npm install @autopilot/contracts
# or
pnpm add @autopilot/contracts
```

## Usage

```typescript
import { 
  TenantContextSchema,
  EventEnvelopeSchema,
  JobRequestSchema,
  ReportEnvelopeSchema,
  createJobRequest,
  stableHash,
  redact,
} from '@autopilot/contracts';

// Validate tenant context
const context = TenantContextSchema.parse({
  tenant_id: 'acme-corp',
  project_id: 'production',
});

// Create a JobForge request
const jobRequest = createJobRequest(
  'autopilot.growth.seo_scan',
  context,
  { url: 'https://example.com' }
);

// Stable hashing for deduplication
const hash = stableHash(jobRequest);

// Redact sensitive data before logging
const safe = redact(jobRequest);
console.log('Job request:', safe);
```

## Schema Categories

### Core (`core.ts`)
Primitive types: `ISODateTime`, `Identifier`, `UUID`, `Priority`, `Severity`, `JSONValue`

### Tenant (`tenant.ts`)
Multi-tenancy: `TenantContext`, validation and creation utilities

### Evidence (`evidence.ts`)
Traceability: `Evidence`, `EvidenceCollection`, linking utilities

### Event (`event.ts`)
JobForge input: `EventEnvelope`, `EventType`, creation utilities

### Manifest (`manifest.ts`)
JobForge output: `RunManifest`, `RunStatus`, lifecycle utilities

### Job (`job.ts`)
Job requests: `JobRequest`, `JobRequestBatch`, `JobType`, serialization

### Report (`report.ts`)
Module outputs: `ReportEnvelope`, `Recommendation`, aggregation

### Profile (`profile.ts`)
App configuration: `Profile`, `ICP`, `Voice`, validation

### Redaction (`redaction.ts`)
Security: `RedactionHint`, `redact()`, pattern-based masking

### Canonical (`canonical.ts`)
Hashing: `canonicalizeJSON()`, `stableHash()`, `deepEqual()`, `contentAddressableId()`

## Runnerless Compliance

This package contains only schema definitions and utilities. It:
- ✅ No network calls
- ✅ No schedulers or workers
- ✅ No secret management
- ✅ No database connections
- ✅ Pure TypeScript/Zod logic

## License

MIT