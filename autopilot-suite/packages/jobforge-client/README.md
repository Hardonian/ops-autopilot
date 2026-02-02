# @autopilot/jobforge-client

Thin JobForge request generator - validates and serializes job requests without execution.

## Overview

This is a **runnerless** client that only produces JSON payloads for JobForge to consume. It does NOT execute jobs or connect to JobForge network endpoints.

## Installation

```bash
npm install @autopilot/jobforge-client
# or
pnpm add @autopilot/jobforge-client
```

## Usage

### Basic Client

```typescript
import { createClient } from '@autopilot/jobforge-client';

const client = createClient({
  defaultTenantContext: {
    tenant_id: 'acme-corp',
    project_id: 'production',
  },
  defaultPriority: 'normal',
});

// Create a job request
const request = client.createRequest(
  'autopilot.growth.seo_scan',
  { url: 'https://example.com' }
);

// Serialize to JSON for JobForge
const json = client.serialize(request);
console.log(json);
```

### Fluent Builder

```typescript
import { buildRequest } from '@autopilot/jobforge-client';

const request = buildRequest()
  .forJob('autopilot.growth.content_draft')
  .forTenant('acme-corp', 'production')
  .withPayload({ type: 'landing_page', goal: 'Increase signups' })
  .withPriority('high')
  .withEvidence('finding', 'f-1', 'Missing meta description')
  .withCostEstimate(100, 'high')
  .expiresIn(24)
  .build();
```

### Quick Builders

```typescript
import { QuickBuilders } from '@autopilot/jobforge-client';

const tenantContext = { tenant_id: 'acme-corp', project_id: 'production' };

// SEO scan
const seoRequest = QuickBuilders.seoScan(
  tenantContext,
  'https://example.com',
  { priority: 'high' }
);

// Content draft
const contentRequest = QuickBuilders.contentDraft(
  tenantContext,
  'landing_page',
  'Increase signups',
  { variants: 5 }
);

// Experiment proposal
const experimentRequest = QuickBuilders.experimentProposal(
  tenantContext,
  { conversion_rate: 0.25 },
  { maxProposals: 3 }
);
```

### Validation

```typescript
import { validateRequest, isValidRequest } from '@autopilot/jobforge-client';

// Detailed validation
const result = validateRequest(request);
if (!result.valid) {
  console.log('Errors:', result.errors);
}

// Simple boolean check
if (isValidRequest(request)) {
  console.log('Request is valid');
}
```

### Batching

```typescript
const requests = [
  client.createRequest('autopilot.growth.seo_scan', { url: 'https://site1.com' }),
  client.createRequest('autopilot.growth.seo_scan', { url: 'https://site2.com' }),
];

const batch = client.batchRequests(requests);
const batchJson = client.serializeBatch(batch);
```

## Runnerless Compliance

This package is strictly runnerless:
- ✅ No network calls
- ✅ No job execution
- ✅ No polling or status checks
- ✅ No secret management
- ✅ Only generates JSON payloads

## License

MIT