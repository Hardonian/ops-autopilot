# Autopilot Suite Consistency Report

**Generated**: 2026-02-02  
**Reporter**: Kimi (OSS Repo Architect)  
**Scope**: ops-autopilot, support-autopilot, growth-autopilot, finops-autopilot

---

## Executive Summary

Based on inspection of `growth-autopilot` (the reference implementation), this report documents the current state and drift across the four autopilot module repos. The modules are designed to be **runnerless** OSS tools that observe, draft, and recommend - never executing actions directly. Instead, they generate JobForge job requests for policy-gated execution.

---

## A) Repo → Missing Items Matrix

| Component            | ops-autopilot  | support-autopilot | growth-autopilot           | finops-autopilot |
| -------------------- | -------------- | ----------------- | -------------------------- | ---------------- |
| **Availability**     | ❌ Not present | ❌ Not present    | ✅ Present                 | ❌ Not present   |
| **Folder Structure** | ❌ Unknown     | ❌ Unknown        | ✅ Complete                | ❌ Unknown       |
| **package.json**     | ❌ Unknown     | ❌ Unknown        | ✅ Present                 | ❌ Unknown       |
| **tsconfig.json**    | ❌ Unknown     | ❌ Unknown        | ✅ Present                 | ❌ Unknown       |
| **.eslintrc.cjs**    | ❌ Unknown     | ❌ Unknown        | ✅ Present                 | ❌ Unknown       |
| **vitest.config.ts** | ❌ Unknown     | ❌ Unknown        | ✅ Present                 | ❌ Unknown       |
| **/src/contracts**   | ❌ Unknown     | ❌ Unknown        | ✅ Present                 | ❌ Unknown       |
| **/src/jobforge**    | ❌ Unknown     | ❌ Unknown        | ✅ Present                 | ❌ Unknown       |
| **/src/profiles**    | ❌ Unknown     | ❌ Unknown        | ✅ Present                 | ❌ Unknown       |
| **CLI entrypoint**   | ❌ Unknown     | ❌ Unknown        | ✅ Present                 | ❌ Unknown       |
| **/tests/**          | ❌ Unknown     | ❌ Unknown        | ✅ Present (8 files)       | ❌ Unknown       |
| **/examples/**       | ❌ Unknown     | ❌ Unknown        | ✅ Present                 | ❌ Unknown       |
| **CI Workflows**     | ❌ Unknown     | ❌ Unknown        | ❌ Missing (.github empty) | ❌ Unknown       |
| **CONTRIBUTING.md**  | ❌ Unknown     | ❌ Unknown        | ✅ Present                 | ❌ Unknown       |
| **LICENSE**          | ❌ Unknown     | ❌ Unknown        | ✅ Present                 | ❌ Unknown       |
| **Runnerless Audit** | ❌ Unknown     | ❌ Unknown        | ✅ Pass (no violations)    | ❌ Unknown       |

**Legend**: ✅ Present/Correct | ⚠️ Partial/Drift | ❌ Missing

---

## B) Reference Implementation Analysis: growth-autopilot

### Structure (Correct)

```
growth-autopilot/
├── src/
│   ├── contracts/          # Zod schemas (289 lines)
│   │   └── index.ts        # TenantContext, Evidence, SEO schemas, JobForgeRequest, Profile
│   ├── jobforge/           # Job request generators
│   │   ├── index.ts        # Public exports
│   │   └── client.ts       # 241 lines - createSEOScanJob, createExperimentJob, etc.
│   ├── profiles/           # App-specific profiles
│   │   └── index.ts        # 462 lines - base + jobforge, settler, readylayer, aias, keys
│   ├── seo/                # SEO scanner implementation
│   ├── funnel/             # Funnel analyzer
│   ├── experiments/        # Experiment proposer
│   ├── content/            # Content drafter
│   ├── utils/              # Shared utilities
│   ├── cli.ts              # 377 lines - Commander CLI
│   └── index.ts            # Public API exports
├── tests/                  # 8 test files
│   ├── contracts.test.ts
│   ├── jobforge.test.ts
│   ├── seo.test.ts
│   ├── funnel.test.ts
│   ├── experiments.test.ts
│   ├── content.test.ts
│   ├── profiles.test.ts
│   └── utils.test.ts
├── examples/               # Sample data
│   ├── events/
│   └── html-export/
├── .github/                # ⚠️ EMPTY - CI missing
├── package.json            # Correct scripts, deps
├── tsconfig.json           # Strict TS config
├── .eslintrc.cjs           # TSLint rules
├── vitest.config.ts        # Test config
├── README.md               # Comprehensive (12KB)
├── CONTRIBUTING.md         # Present
└── LICENSE                 # MIT
```

### Package Scripts (growth-autopilot)

```json
{
  "build": "tsc",
  "dev": "tsx src/cli.ts",
  "start": "node dist/cli.js",
  "lint": "eslint src --ext .ts",
  "typecheck": "tsc --noEmit",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage",
  "clean": "rm -rf dist"
}
```

**Missing**: `runnerless:audit` script

### TypeScript Configuration (Correct)

- Target: ES2022
- Module: NodeNext
- Strict mode enabled
- Declaration files generated
- Source maps enabled

### Dependencies (Correct)

**Runtime**: zod, commander, cheerio, glob, chalk  
**Dev**: typescript, vitest, eslint, tsx, @types/node

### Contracts Schema Quality (Excellent)

✅ TenantContextSchema with tenant_id + project_id  
✅ EvidenceSchema for traceability  
✅ JobForgeRequestSchema for job requests  
✅ ProfileSchema for app configuration  
✅ Domain-specific schemas (SEOFindings, FunnelMetrics, etc.)

### JobForge Client Quality (Good)

✅ Creates request payloads only (no execution)  
✅ Includes cost estimation  
✅ Evidence linking  
✅ Validation with Zod  
✅ Batch request support  
✅ Mock response generator for testing

### Profile System Quality (Excellent)

✅ Base profile with sensible defaults  
✅ Per-app overlays: jobforge, settler, readylayer, aias, keys  
✅ Deep merge extension function  
✅ Validation with Zod  
✅ ICP, voice, keywords, prohibited_claims, features

### Runnerless Compliance (✅ PASS)

- ✅ No worker/scheduler libraries
- ✅ No server listeners (except CLI example)
- ✅ No secret management code
- ✅ No direct connector implementations
- ✅ Only generates JobForge request payloads
- ✅ No network calls to JobForge by default

### CI/CD Status (⚠️ MISSING)

- ❌ No GitHub Actions workflows
- ❌ No automated testing on PR
- ❌ No release automation
- ❌ No runnerless audit in CI

---

## C) Normalized Conventions (To Apply to All Modules)

### 1. Folder Structure Convention

```
{module}-autopilot/
├── src/
│   ├── contracts/          # Re-export from @autopilot/contracts OR local domain schemas
│   ├── jobforge/           # Use @autopilot/jobforge-client for request generation
│   ├── profiles/           # Extend @autopilot/profiles overlays
│   ├── {domain}/           # Module-specific functionality (1+ domains)
│   ├── utils/              # Shared utilities
│   ├── cli.ts              # Commander CLI entrypoint
│   └── index.ts            # Public API
├── tests/
│   ├── *.test.ts           # Co-located tests
│   └── fixtures/           # Test data
├── examples/               # Sample inputs/outputs
├── .github/
│   └── workflows/
│       ├── ci.yml          # Lint, typecheck, test
│       ├── release.yml     # Automated releases
│       └── runnerless-audit.yml  # Suite audit
├── package.json            # See template below
├── tsconfig.json           # Strict ES2022/NodeNext
├── .eslintrc.cjs           # @typescript-eslint recommended
├── vitest.config.ts        # Coverage enabled
├── README.md               # Standard format
├── CONTRIBUTING.md         # Suite contribution guide
├── LICENSE                 # MIT
├── CHANGELOG.md            # Auto-generated
└── SECURITY.md             # Security policy
```

### 2. Package.json Template

```json
{
  "name": "{module}-autopilot",
  "version": "0.1.0",
  "description": "Runnerless {module} autopilot - observes, drafts, recommends",
  "type": "module",
  "main": "dist/index.js",
  "bin": { "{module}": "dist/cli.js" },
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/cli.ts",
    "start": "node dist/cli.js",
    "lint": "eslint src --ext .ts",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "runnerless:audit": "autopilot-suite audit-runnerless",
    "clean": "rm -rf dist"
  },
  "engines": { "node": ">=18.0.0" },
  "packageManager": "pnpm@9.0.0",
  "dependencies": {
    "@autopilot/contracts": "^0.1.0",
    "@autopilot/jobforge-client": "^0.1.0",
    "@autopilot/profiles": "^0.1.0",
    "commander": "^12.1.0",
    "zod": "^3.23.8",
    "chalk": "^5.3.0"
  },
  "devDependencies": {
    "@types/node": "^20.14.0",
    "@typescript-eslint/eslint-plugin": "^7.13.0",
    "@typescript-eslint/parser": "^7.13.0",
    "eslint": "^8.57.0",
    "tsx": "^4.15.0",
    "typescript": "^5.4.5",
    "vitest": "^1.6.0",
    "@vitest/coverage-v8": "^1.6.0"
  }
}
```

### 3. CI Workflow Template

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: 'pnpm' }
      - run: pnpm install
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test
      - run: pnpm build
      - run: pnpm runnerless:audit # Must pass
```

### 4. Required Files Checklist

| File                       | Purpose                                         | Enforcement |
| -------------------------- | ----------------------------------------------- | ----------- |
| `src/contracts/index.ts`   | Re-export suite contracts + local schemas       | Required    |
| `src/jobforge/index.ts`    | Use suite jobforge-client                       | Required    |
| `src/profiles/index.ts`    | Extend suite profiles                           | Required    |
| `src/cli.ts`               | Commander CLI with --tenant and --project flags | Required    |
| `src/index.ts`             | Public API exports                              | Required    |
| `tests/*.test.ts`          | Vitest tests with coverage                      | Required    |
| `.github/workflows/ci.yml` | Automated validation                            | Required    |
| `README.md`                | Standard format                                 | Required    |
| `CONTRIBUTING.md`          | Contribution guidelines                         | Required    |
| `LICENSE`                  | MIT license                                     | Required    |
| `CHANGELOG.md`             | Auto-generated                                  | Auto        |
| `SECURITY.md`              | Security policy                                 | Required    |

### 5. Code Quality Standards

**TypeScript**:

- Strict mode enabled
- Explicit return types on exported functions
- No `any` types
- No unused variables

**Linting**:

- @typescript-eslint/recommended
- Explicit function return types required
- No explicit any

**Testing**:

- Vitest for all tests
- Coverage threshold: 80% minimum
- Tests for contracts, jobforge integration, and domain logic

**Runnerless Enforcement**:

- No `bullmq`, `bull`, `bee-queue`, or similar job queue libraries
- No `node-cron`, `cron`, or similar schedulers
- No `express`, `fastify`, `koa`, or similar server frameworks (except CLI-only)
- No `dotenv` config with secret loading patterns
- No direct database/S3/API connector implementations
- All "action" outputs must be JobForge request payloads

### 6. Multi-Tenancy Requirement

Every module must:

- Accept `--tenant <id>` CLI flag
- Accept `--project <id>` CLI flag
- Include `tenant_context` in all output schemas
- Validate tenant_id + project_id are non-empty strings

### 7. Documentation Standards

Each repo must include:

1. **README.md** with:
   - Purpose statement
   - Key principles (no auto-publish, no runners, multi-tenant)
   - Quick start guide
   - CLI reference
   - Architecture diagram
   - Integration with JobForge
   - Contributing link

2. **CONTRIBUTING.md** with:
   - Development setup
   - Testing instructions
   - Runnerless compliance requirements
   - PR checklist

3. **SECURITY.md** with:
   - Reporting process
   - Security model
   - No secrets in logs policy

---

## D) Identified Drift & Recommendations

### For growth-autopilot (Reference)

**Issues Found**:

1. ⚠️ `.github/workflows/` directory is empty - needs CI/CD
2. ⚠️ Missing `runnerless:audit` script in package.json
3. ⚠️ No SECURITY.md file
4. ⚠️ No CHANGELOG.md

**Action**: Apply Stage 2 harmonization

### For ops-autopilot, support-autopilot, finops-autopilot

**Status**: Repositories not present locally. Assumptions:

1. They may exist in a different location/organization
2. They may need to be scaffolded following growth-autopilot patterns
3. They should adopt the normalized conventions above

**Required Structure** (per module):

- `ops-autopilot`: Infrastructure observation, cost analysis, incident correlation
- `support-autopilot`: Ticket analysis, KB generation, response drafting
- `finops-autopilot`: Cost anomaly detection, budget recommendations, usage optimization

Each should follow the exact same structure as growth-autopilot but with domain-specific:

- `/src/{domain}/` implementations
- Domain-specific contracts extending base schemas
- CLI commands matching domain operations

---

## E) Harmonization Priority

1. **P0 (Critical)**:
   - Add CI/CD to growth-autopilot
   - Create autopilot-suite meta-repo
   - Add runnerless audit capability

2. **P1 (High)**:
   - Refactor growth-autopilot to use suite packages
   - Document integration recipes
   - Create SECURITY.md

3. **P2 (Medium)**:
   - Apply conventions to other modules when available
   - Add comprehensive examples
   - Performance benchmarking

---

## F) Rollback Plan

If harmonization causes issues:

1. **Version Pinning**: Each module has independent versioning
2. **Git History**: All changes committed incrementally
3. **Suite Packages Optional**: Modules can fall back to local implementations
4. **Feature Flags**: Use environment variables to toggle suite package usage
5. **Reversion Command**: `git revert HEAD~{n}..HEAD` for bulk rollback

---

## G) Next Steps

1. ✅ **Stage 0 Complete**: Consistency report generated
2. 🔄 **Stage 1**: Create autopilot-suite meta-repo with:
   - @autopilot/contracts
   - @autopilot/jobforge-client
   - @autopilot/profiles
   - `autopilot-suite audit-runnerless` CLI
   - Shared CI workflows
   - Documentation hub
3. ⏳ **Stage 2**: Apply suite conventions to growth-autopilot (and others when available)
4. ⏳ **Stage 3**: Create integration recipes for Settler, AIAS, Keys, ReadyLayer

---

_Report generated by Kimi. For questions, refer to autopilot-suite documentation (Stage 1 output)._
