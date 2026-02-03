# Repository Audit Notes

**Project**: @autopilot/ops-autopilot  
**Type**: Node.js CLI Tool + Library (TypeScript)  
**Audit Date**: 2026-02-03  
**Auditor**: Kimi (Principal Engineer)  

## Executive Summary

This is a well-structured Node.js CLI tool for infrastructure reliability automation, part of the `@autopilot/*` monorepo suite. The project has solid foundations but requires hardening for production OSS readiness.

**Overall Health**: 🟡 Good foundation, needs hardening

## Tech Stack Inventory

| Category | Tool | Status | Notes |
|----------|------|--------|-------|
| Package Manager | pnpm 9.x | ✅ | Good |
| Language | TypeScript 5.7 | ✅ | Latest, strict config |
| Module System | ESM-only | ✅ | Modern |
| Build Tool | tsup 8.3.5 | ✅ | Fast bundler |
| Testing | Vitest 2.1.8 | ✅ | Good choice |
| Linting | ESLint 8.57.0 | 🟡 | Should upgrade to v9 |
| Schema | Zod 3.23.8 | ✅ | Type-safe validation |
| CLI | Commander 12.0.0 | ✅ | Standard choice |
| Monorepo | pnpm workspaces | ✅ | Present in autopilot-suite/ |

## Critical Issues Found

### 🔴 P0 - Immediate Action Required

1. **Missing Lockfile** (`pnpm-lock.yaml`)
   - CI uses `--no-frozen-lockfile` allowing dependency drift
   - Risk: Non-reproducible builds, supply chain attacks
   - Fix: Commit lockfile, update CI to use `--frozen-lockfile`

2. **No Security Scanning**
   - Missing: `pnpm audit`, CodeQL, dependency scanning
   - Risk: Vulnerable dependencies in production
   - Fix: Add security workflow + audit to CI

3. **ESLint v8 EOL**
   - ESLint 8 is approaching end-of-life
   - Fix: Upgrade to ESLint 9 with flat config

### 🟡 P1 - High Priority

4. **No Code Formatting Tool**
   - Missing: Prettier or Biome
   - Risk: Inconsistent code style, noisy diffs
   - Fix: Add Prettier with pre-commit hooks

5. **No Test Coverage**
   - Vitest has no coverage configuration
   - Risk: Unknown test quality, blind spots
   - Fix: Add @vitest/coverage-v8, set thresholds

6. **No Node Version Pinning**
   - Missing: .nvmrc or .node-version
   - Risk: "Works on my machine" issues
   - Fix: Add .nvmrc with LTS version

7. **No Editor Configuration**
   - Missing: .editorconfig
   - Risk: Inconsistent whitespace, line endings
   - Fix: Add .editorconfig

### 🟢 P2 - Medium Priority

8. **Missing OSS Documentation**
   - Missing: CHANGELOG.md, CONTRIBUTING.md at root
   - Risk: Poor contributor experience
   - Fix: Add standard OSS docs

9. **No Dependency Automation**
   - Missing: Renovate or Dependabot config
   - Risk: Dependencies go stale
   - Fix: Add Dependabot configuration

10. **No Release Automation**
    - Missing: Semantic release workflow
    - Risk: Manual releases, versioning errors
    - Fix: Add release workflow

## Architecture & Security Analysis

### Execution Surfaces

| Surface | Location | Risk Level |
|---------|----------|------------|
| CLI Entry | `src/cli.ts` (516 lines) | 🟡 Large file, needs modularization |
| Alert Processing | `src/alerts/index.ts` | 🟢 Clean, pure functions |
| Runbook Generation | `src/runbooks/index.ts` | 🟢 Clean, pure functions |
| JobForge Integration | `src/jobforge/` | 🟡 External API calls |
| Profile System | `src/profiles/index.ts` | 🟢 Clean, data-driven |
| Report Generation | `src/reports/index.ts` | 🟢 Clean, pure functions |

### Data Flow Analysis

1. **Input**: Alerts (validated via Zod schemas) ✅
2. **Processing**: Pure functions with no side effects ✅
3. **Output**: JobForge requests (validated via Zod) ✅

**Security Posture**: Good - "Runnerless" architecture means no code execution, only job generation.

### Input Validation

✅ All inputs use Zod schemas (`src/contracts/`)
✅ CLI arguments validated via Commander
✅ No raw `process.env` access outside config

### Dependencies Review

**Direct Dependencies** (7):
- `commander`: CLI framework - ✅ Trusted, maintained
- `zod`: Schema validation - ✅ Trusted, widely used
- `@autopilot/*`: Internal workspace packages - 🟡 Need versioning strategy

**Risk Assessment**: Low - minimal external dependencies, all well-maintained

## Test Coverage Analysis

**Current Tests**:
- `tests/alerts.test.ts` (228 lines) - Alert correlation
- `tests/jobforge.test.ts` - JobForge integration
- `tests/jobforge-integration.test.ts` - Integration tests
- `tests/profiles.test.ts` - Profile system
- `tests/runbooks.test.ts` - Runbook generation

**Missing Coverage**:
- ❌ CLI command tests
- ❌ Error boundary tests
- ❌ Edge case handling

## CI/CD Analysis

**Current Workflow** (`.github/workflows/ci.yml`):
- ✅ Runs on PR and main
- ✅ Uses pnpm caching
- ✅ Multi-node verification (fast vs full)
- ❌ Uses `--no-frozen-lockfile` (bad)
- ❌ No security scanning
- ❌ No coverage reporting

## Recommended Hardening Plan

### Phase 1: Foundation (This Session)
1. Add lockfile and freeze CI
2. Upgrade ESLint to v9
3. Add Prettier configuration
4. Add .nvmrc and .editorconfig
5. Add coverage configuration

### Phase 2: Security & Quality
6. Add security scanning workflow
7. Add Dependabot configuration
8. Enhance test coverage
9. Add pre-commit hooks

### Phase 3: OSS Polish
10. Add missing documentation
11. Add release automation
12. Add contributing guidelines

## Files to Create/Modify

### New Files
- `.nvmrc`
- `.editorconfig`
- `.prettierrc`
- `pnpm-lock.yaml` (generated)
- `.github/dependabot.yml`
- `.github/workflows/security.yml`
- `.github/workflows/release.yml`
- `CONTRIBUTING.md`
- `CHANGELOG.md`
- `docs/TESTING.md`
- `docs/SECURITY.md`

### Modified Files
- `package.json` - Add scripts and dependencies
- `.github/workflows/ci.yml` - Fix frozen lockfile, add coverage
- `eslint.config.js` - Upgrade to v9 format
- `vitest.config.ts` - Add coverage
- `tsconfig.json` - Consider stricter options

## Success Criteria

- [ ] `pnpm lint` - 0 warnings
- [ ] `pnpm typecheck` - 0 errors
- [ ] `pnpm test` - All pass with coverage
- [ ] `pnpm build` - Clean build
- [ ] `pnpm verify` - Runs everything in sequence
- [ ] CI passes with frozen lockfile
- [ ] Security scanning enabled
- [ ] Documentation complete

---

**Next Steps**: Begin Phase 1 implementation immediately.
