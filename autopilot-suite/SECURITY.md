# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability in the Autopilot Suite, please report it responsibly:

1. **Do not** open a public issue
2. Email security@openwork.community with:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

We will:
- Acknowledge receipt within 48 hours
- Provide a timeline for a fix within 7 days
- Coordinate disclosure when fixed

## Security Model

### Runnerless Architecture

The Autopilot Suite follows a **runnerless** architecture for security:

- Modules never execute jobs directly
- All execution happens through JobForge with policy tokens
- No secrets are stored in module code
- No direct database or API connections

### Data Handling

- **No PII**: Modules should not process personal identifiable information
- **Redaction**: All logs are redacted using `@autopilot/contracts` redaction utilities
- **Tenant Isolation**: Every operation is scoped to `tenant_id` + `project_id`
- **Evidence Only**: Modules only generate recommendations with evidence links

### Secret Management

Modules **must not**:
- Store API keys in code
- Log secrets or tokens
- Access environment variables containing secrets (except in example code)
- Implement their own secret management

Use the `@autopilot/contracts` redaction utilities:

```typescript
import { redact, redactString } from '@autopilot/contracts';

// Redact object
const safe = redact(sensitiveData);

// Redact string
const safeString = redactString(logMessage);
```

## Security Best Practices

### For Contributors

1. **Never commit secrets**: Use `.env.example` for documentation only
2. **Validate all inputs**: Use Zod schemas for validation
3. **Sanitize outputs**: Redact before logging
4. **Minimal permissions**: Request minimal required permissions
5. **Audit dependencies**: Review new dependencies for security issues

### For Users

1. **Keep dependencies updated**: Run `pnpm update` regularly
2. **Review job requests**: Validate JobForge requests before approving
3. **Use policy tokens**: Always require policy tokens for actions
4. **Monitor logs**: Check for any unredacted sensitive data

## Known Security Considerations

### Dependency Risks

- `zod`: Schema validation library - trusted, widely used
- `commander`: CLI framework - trusted, widely used
- `chalk`: Terminal styling - trusted, widely used

We audit dependencies quarterly and subscribe to security advisories.

### Supply Chain

Packages are published to npm with:
- Signed commits
- Reproducible builds
- Automated vulnerability scanning

## Compliance

The Autopilot Suite is designed to help with:
- SOC 2 Type II compliance (audit trails via JobForge)
- GDPR (no PII processing in modules)
- HIPAA (when integrated with compliant JobForge deployment)

Note: Modules themselves are not compliant solutions - they integrate with compliant systems.

## Contact

- Security issues: security@openwork.community
- General questions: Open a GitHub discussion

## Acknowledgments

We thank security researchers who responsibly disclose vulnerabilities.