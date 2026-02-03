# JobForge Integration (Growth Autopilot)

Growth Autopilot is runnerless. It **never executes jobs**. It only emits JobForge-compatible request bundles and report envelopes for JobForge to validate and run.

## CLI command JobForge should run

```bash
growth analyze \
  --inputs ./fixtures/jobforge/input.json \
  --tenant <tenant_id> \
  --project <project_id> \
  --trace <trace_id> \
  --out <output_dir>
```

Add `--stable-output` when generating deterministic fixtures or docs.

## Expected outputs

The command writes the following files to `<output_dir>`:

- `request-bundle.json` — JobRequestBundle (dry-run request payloads)
- `report.json` — ReportEnvelopeBundle (module findings + recommendations)
- `report.md` — Markdown rendering of the report

## Schema version & stability

- `schema_version`: `1.0.0`
- `--stable-output` replaces non-deterministic timestamps and IDs with stable placeholders.
- Output JSON is canonicalized with lexicographic key ordering.
- `canonicalization.hash` is a SHA-256 of canonical JSON for repeatable verification.

## JobForge ingestion

1) **Request bundle**
   - Validate the bundle with the local `JobRequestBundleSchema`.
   - Validate each request using `@autopilot/contracts` `JobRequestSchema`.
   - Use `idempotency_keys` to gate replays.
   - Use `canonicalization.hash` as the deterministic hash of the canonical JSON payload.

2) **Report envelope**
   - Validate the bundle with the local `ReportEnvelopeBundleSchema`.
   - Validate `report` using `@autopilot/contracts` `ReportEnvelopeSchema`.
   - Use `report.metadata.correlation_id` as the trace ID.

## Safety boundaries

- This module is **runnerless**. It only **emits** job requests and reports.
- All JobForge requests require policy tokens and human approval before execution.
- No secrets or PII are logged or serialized in output artifacts.

## Compatibility maintenance

The JobForge bundle schemas are maintained in `src/contracts/compat.ts`. They are kept byte-for-byte aligned with the canonical JobForge contracts and validated via `pnpm contracts:compat` using deterministic fixtures.
