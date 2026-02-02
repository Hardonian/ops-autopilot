# Contributing to Autopilot Suite

Thank you for your interest in contributing to the Autopilot Suite!

## Development Setup

### Prerequisites

- Node.js 18+ 
- pnpm 9+
- Git

### Initial Setup

```bash
# Clone the repository
git clone https://github.com/openwork-community/autopilot-suite.git
cd autopilot-suite

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Verify setup
pnpm test
```

## Project Structure

```
autopilot-suite/
├── packages/
│   ├── contracts/        # Zod schemas
│   ├── jobforge-client/ # Request generator
│   └── profiles/        # Profile system
├── apps/
│   └── audit-cli/       # Compliance auditor
├── templates/           # CI templates
└── docs/               # Documentation
```

## Development Workflow

### Making Changes

1. Create a new branch:
   ```bash
   git checkout -b feat/your-feature-name
   ```

2. Make your changes in the appropriate package

3. Run validation:
   ```bash
   pnpm lint
   pnpm typecheck
   pnpm test
   ```

4. Build to ensure no compilation errors:
   ```bash
   pnpm build
   ```

5. Commit with conventional commits:
   ```bash
   git commit -m "feat(contracts): add new schema for X"
   ```

### Conventional Commits

We use conventional commits for changelog generation:

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style (formatting, no logic changes)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Build process or auxiliary tool changes

Examples:
```
feat(contracts): add ReportEnvelope schema
fix(jobforge-client): handle null tenant context
docs: update integration recipes
```

## Testing

### Run All Tests

```bash
pnpm test
```

### Run Tests for Specific Package

```bash
pnpm --filter @autopilot/contracts test
```

### Run with Coverage

```bash
pnpm test:coverage
```

### Watch Mode

```bash
pnpm --filter @autopilot/contracts test:watch
```

## Code Style

We use ESLint with TypeScript rules:

```bash
# Lint all packages
pnpm lint

# Fix auto-fixable issues
pnpm lint --fix
```

### Key Rules

- Explicit function return types required
- No `any` types
- No unused variables
- Strict TypeScript mode enabled

## Adding New Schemas

When adding new schemas to `@autopilot/contracts`:

1. Create schema in appropriate file (or create new file)
2. Export from `src/index.ts`
3. Add tests in `tests/` directory
4. Update documentation
5. Add changeset: `pnpm changeset`

Example:
```typescript
// src/my-schema.ts
import { z } from 'zod';

export const MySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
});

export type MyType = z.infer<typeof MySchema>;
```

## Runnerless Compliance

All contributions must maintain runnerless compliance:

- ✅ No job queue libraries (bull, bullmq, etc.)
- ✅ No schedulers (node-cron, etc.)
- ✅ No server frameworks in production code
- ✅ No direct database/API connectors
- ✅ Only generate JobForge request payloads

Run the audit to verify:
```bash
pnpm --filter @autopilot/audit-cli exec autopilot-suite audit-runnerless .
```

## Release Process

We use [Changesets](https://github.com/changesets/changesets) for versioning:

1. Add changeset for your changes:
   ```bash
   pnpm changeset
   ```
   
2. Select packages affected and describe changes

3. Commit the changeset file

4. When merged to main, a PR will be created automatically to version packages

5. After merging the version PR, packages are published to npm

## Pull Request Checklist

Before submitting a PR:

- [ ] Tests pass (`pnpm test`)
- [ ] Linting passes (`pnpm lint`)
- [ ] Type checking passes (`pnpm typecheck`)
- [ ] Build succeeds (`pnpm build`)
- [ ] Runnerless audit passes
- [ ] Changeset added (if applicable)
- [ ] Documentation updated
- [ ] Commit messages follow conventional format

## Questions?

- Open an issue for bugs or feature requests
- Start a discussion for questions
- Check existing documentation first

## Code of Conduct

Be respectful, constructive, and collaborative. We're building this together.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.