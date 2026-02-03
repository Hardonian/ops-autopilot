# Ops Autopilot CLI

All commands are runnerless. They never execute jobs; they only emit reports and JobForge request payloads.

## Command summary

| Command | Purpose | Example |
| --- | --- | --- |
| `ingest` | Ingest alerts/events/log summaries | `ops-autopilot ingest --tenant t --project p --file ./alerts.json` |
| `correlate` | Correlate alerts into groups | `ops-autopilot correlate --tenant t --project p --file ./alerts.json --jobs` |
| `runbook` | Generate runbook from alert group | `ops-autopilot runbook --tenant t --project p --file ./alert-group.json --jobs` |
| `report` | Generate reliability report | `ops-autopilot report --tenant t --project p --type health_check --start 2026-01-01T00:00:00Z --end 2026-01-31T23:59:59Z --jobs` |
| `analyze` | JobForge integration surface (bundle + report) | `ops-autopilot analyze --inputs ./fixtures/jobforge/input.json --tenant t --project p --trace trace --out ./out` |

## Analyze command (JobForge)

```bash
ops-autopilot analyze \
  --inputs ./fixtures/jobforge/input.json \
  --tenant acme-prod \
  --project api-platform \
  --trace trace-123 \
  --out ./out \
  --stable-output
```

Outputs:

- `out/request-bundle.json`
- `out/report.json`
- `out/report.md`
