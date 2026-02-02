# Autopilot Suite

Meta-repo coordinating autopilot modules - shared contracts, jobforge adapters, profiles, and runnerless validation.

## Overview

The Autopilot Suite provides a unified layer for coordinating multiple runnerless autopilot modules:

- **ops-autopilot**: Infrastructure observation and incident correlation
- **support-autopilot**: Ticket analysis and response drafting
- **growth-autopilot**: SEO scanning, funnel analysis, content drafting
- **finops-autopilot**: Cost analysis and optimization recommendations

## Packages

| Package | Description | Version |
|---------|-------------|---------|
| `@autopilot/contracts` | Canonical Zod schemas | v0.1.0 |
| `@autopilot/jobforge-client` | Request generator (no execution) | v0.1.0 |
| `@autopilot/profiles` | Base + per-app profiles | v0.1.0 |
| `@autopilot/audit-cli` | Runnerless compliance auditor | v0.1.0 |

## Quick Start

```bash
# Clone the repository
git clone https://github.com/openwork-community/autopilot-suite.git
cd autopilot-suite

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Run linting
pnpm lint
```

## Architecture

```
autopilot-suite/
├── packages/
│   ├── contracts/       # Shared Zod schemas
│   │   ├── core.ts     # Primitives (ISODateTime, Priority, etc.)
│   │   ├── tenant.ts   # Multi-tenancy schemas
│   │   ├── evidence.ts # Traceability schemas
│   │   ├── event.ts    # EventEnvelope (JobForge input)
│   │   ├── manifest.ts # RunManifest (JobForge output)
│   │   ├── job.ts      # JobRequest (requestJob payload)
│   │   ├── report.ts   # ReportEnvelope (module output)
│   │   ├── profile.ts  # Profile schemas
│   │   ├── redaction.ts# Secret redaction
│   │   └── canonical.ts# Stable hashing utilities
│   ├── jobforge-client/# Request generator
│   │   ├── client.ts   # JobForgeClient class
│   │   ├── builders.ts # Fluent builders + quick builders
│   │   └── validation.ts# Validation utilities
│   └── profiles/       # Profile system
│       ├── base.ts     # Base profile
│       ├── overlays/   # Per-app profiles
│       └── registry.ts # Profile registry
├── apps/
│   └── audit-cli/      # Runnerless auditor
└── templates/          # CI workflow templates
```

## Key Principles

### 1. Runnerless

Modules only observe, draft, and recommend. They never execute actions directly. All execution happens through JobForge with policy tokens.

### 2. Multi-Tenant

Every operation requires `tenant_id` + `project_id`. No exceptions.

### 3. Evidence-Linked

Every recommendation links back to the signal that caused it. Complete traceability.

### 4. JobForge Compatible

All schemas are compatible with JobForge event envelopes, run manifests, and job requests.

## Runnerless Compliance

Verify a module complies with runnerless requirements:

```bash
# Using the audit CLI
pnpm --filter @autopilot/audit-cli exec autopilot-suite audit-runnerless ../growth-autopilot

# With JSON output
pnpm --filter @autopilot/audit-cli exec autopilot-suite audit-runnerless ../growth-autopilot --format json
```

## Integration

### For Module Authors

```typescript
import { 
  TenantContextSchema,
  JobRequestSchema,
  createJobRequest,
} from '@autopilot/contracts';

import { createClient } from '@autopilot/jobforge-client';

import { getProfile } from '@autopilot/profiles';

// Validate tenant context
const context = TenantContextSchema.parse({
  tenant_id: 'acme-corp',
  project_id: 'production',
});

// Create job request
const jobRequest = createJobRequest(
  'autopilot.growth.seo_scan',
  context,
  { url: 'https://example.com' }
);

// Get profile for content generation
const profile = getProfile('jobforge');
```

### For App Integrations

See [Integration Recipes](./docs/INTEGRATION_RECIPES.md) for:
- Settler integration
- AIAS integration
- Keys integration
- ReadyLayer integration

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup, testing, and release processes.

## License

MIT