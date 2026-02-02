# @autopilot/audit-cli

CLI tool to audit autopilot modules for runnerless compliance.

## Installation

```bash
npm install -g @autopilot/audit-cli
# or
pnpm add -g @autopilot/audit-cli
```

## Usage

### Audit a module

```bash
autopilot-suite audit-runnerless ./growth-autopilot
```

### Output formats

```bash
# Text output (default)
autopilot-suite audit-runnerless ./growth-autopilot

# JSON output
autopilot-suite audit-runnerless ./growth-autopilot --format json

# Save to file
autopilot-suite audit-runnerless ./growth-autopilot --output report.json
autopilot-suite audit-runnerless ./growth-autopilot --format json --output report.json
```

### Strict mode

Fail on warnings as well as errors:

```bash
autopilot-suite audit-runnerless ./growth-autopilot --strict
```

## What it checks

The audit verifies:

1. ✅ `package.json` exists and names module correctly
2. ✅ No forbidden job queue libraries (bull, bullmq, agenda, etc.)
3. ✅ No forbidden scheduler libraries (node-cron, cron, etc.)
4. ✅ No server frameworks (express, fastify, etc.) in production code
5. ✅ No direct secret management
6. ✅ No direct database/S3/API connector implementations
7. ✅ CLI entrypoint exists (`src/cli.ts`)
8. ✅ Contracts directory exists (`src/contracts`)
9. ✅ JobForge directory exists (`src/jobforge`)
10. ✅ Profiles directory exists (`src/profiles`)

## CI Integration

Add to your CI workflow:

```yaml
# .github/workflows/ci.yml
- name: Runnerless Audit
  run: npx @autopilot/audit-cli audit-runnerless . --strict
```

Or add to package.json:

```json
{
  "scripts": {
    "runnerless:audit": "autopilot-suite audit-runnerless ."
  }
}
```

## License

MIT