# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

Please report security vulnerabilities to security@openwork.community.

Do not open public issues for security problems.

## Security Model

### Runnerless Architecture

This module follows a **runnerless** architecture:
- Never executes jobs directly
- Only generates JobForge request payloads
- No secret management
- No direct API/database connections

### Data Handling

- Multi-tenant safe (requires tenant_id + project_id)
- Evidence-linked traceability
- Log redaction enabled

## Best Practices

1. Never commit secrets
2. Use `--tenant` and `--project` flags
3. Review JobForge requests before approval
4. Keep dependencies updated