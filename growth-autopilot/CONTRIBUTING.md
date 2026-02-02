# Contributing to Growth Autopilot

Thank you for your interest in contributing to Growth Autopilot! This document provides guidelines and instructions for contributing.

## Code of Conduct

This project and everyone participating in it is governed by our Code of Conduct. By participating, you are expected to uphold this code.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the existing issues to see if the problem has already been reported. When you are creating a bug report, please include as many details as possible:

- **Use a clear and descriptive title**
- **Describe the exact steps to reproduce the problem**
- **Provide specific examples to demonstrate the steps**
- **Describe the behavior you observed and what behavior you expected**
- **Include code samples and console output if relevant**

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, please include:

- **Use a clear and descriptive title**
- **Provide a step-by-step description of the suggested enhancement**
- **Provide specific examples to demonstrate the enhancement**
- **Explain why this enhancement would be useful**

### Pull Requests

1. Fork the repository
2. Create a new branch from `main` for your feature or bug fix
3. Make your changes
4. Add or update tests as necessary
5. Ensure all tests pass (`pnpm test`)
6. Ensure code passes linting (`pnpm lint`)
7. Ensure TypeScript compiles (`pnpm typecheck`)
8. Commit your changes with a clear commit message
9. Push to your fork
10. Open a Pull Request

## Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/growth-autopilot.git
cd growth-autopilot

# Install dependencies
pnpm install

# Run tests
pnpm test

# Build the project
pnpm build
```

## Coding Standards

### TypeScript

- Use strict TypeScript settings
- Explicit return types on functions
- No `any` types without justification
- Use `unknown` for values that need type checking

### Code Style

- Follow existing code style
- Use meaningful variable names
- Keep functions small and focused
- Add JSDoc comments for public APIs

### Testing

- Write tests for new functionality
- Ensure all tests pass before submitting PR
- Aim for high test coverage
- Use descriptive test names

### Commit Messages

- Use present tense ("Add feature" not "Added feature")
- Use imperative mood ("Move cursor to..." not "Moves cursor to...")
- Limit the first line to 72 characters or less
- Reference issues and pull requests liberally after the first line

## Project Structure

```
/src
├── contracts/     # Zod schemas and types
├── seo/           # SEO scanner implementation
├── funnel/        # Funnel analyzer implementation
├── experiments/   # Experiment proposer implementation
├── content/       # Content drafter implementation
├── jobforge/      # JobForge integration
├── profiles/      # Built-in profiles
├── utils/         # Shared utilities
└── cli.ts         # CLI entry point

/tests             # Test files (mirror src structure)
/examples          # Example data and outputs
```

## Non-Negotiables

All contributions must respect these principles:

1. **No auto-publish**: This tool drafts and recommends only. Never add automatic publishing.
2. **No runners**: Maintain runnerless architecture. No background jobs, schedulers, or cron.
3. **Multi-tenant safe**: Every operation must include tenant_id and project_id.
4. **Evidence-linked**: All recommendations must link to their source signals.
5. **LLM optional**: Core functionality must work without LLM.

## Testing Guidelines

### Unit Tests

- Test individual functions and utilities
- Mock external dependencies
- Test edge cases and error conditions

### Integration Tests

- Test module interactions
- Use realistic test data
- Test full workflows

### Deterministic Tests

SEO scanner and experiment proposer must produce stable output:

```typescript
// Run twice, compare results
const result1 = await scanSEO(config);
const result2 = await scanSEO(config);
expect(result1.health_score.overall).toBe(result2.health_score.overall);
```

## Documentation

- Update README.md if adding new features
- Update relevant documentation files
- Add JSDoc comments to public APIs
- Include examples for new functionality

## Questions?

- Open a [GitHub Discussion](https://github.com/openwork-community/growth-autopilot/discussions)
- Check existing [issues](https://github.com/openwork-community/growth-autopilot/issues)

Thank you for contributing!
