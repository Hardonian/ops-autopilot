# Growth Autopilot

A runnerless growth autopilot that scans site structure, generates SEO audits, proposes experiments from event funnels, and drafts content. It never schedules or publishes; it outputs JobForge job requests for expensive verification/scans.

## Overview

**Purpose**: Growth automation without infrastructure overhead

**Key Principles**:
- **No auto-publish**: This tool drafts and recommends only. Execution happens through JobForge.
- **No runners**: Completely runnerless. No secrets, no schedulers, no connectors.
- **Multi-tenant safe**: Every operation requires `tenant_id` + `project_id`.
- **Evidence-linked**: Every recommendation links to the signal that caused it.
- **LLM-optional**: SEO scanner works without LLM. Content drafter can use templates or LLM.

## Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/openwork-community/growth-autopilot.git
cd growth-autopilot

# Install dependencies
pnpm install

# Build the project
pnpm build

# Link for global CLI access
pnpm link --global
```

### SEO Scan

Scan a site export or Next.js routes:

```bash
# Scan HTML export
growth seo-scan --path ./examples/html-export --output findings.json

# With JobForge request
growth seo-scan --path ./site-export --output findings.json --jobforge

# Multi-tenant scan
growth seo-scan --path ./site --tenant acme-corp --project marketing-site
```

### Funnel Analysis

Analyze event data to compute funnel metrics:

```bash
# Analyze events
growth funnel --events ./examples/events/signup-funnel.json \
  --stages page_view signup_start signup_complete activation \
  --output metrics.json

# With experiment proposals
growth funnel --events events.json --stages page_view signup activation \
  --jobforge --tenant acme-corp --project growth
```

### Propose Experiments

Generate experiment proposals from funnel metrics:

```bash
growth propose-experiments --funnel ./examples/outputs/metrics.json \
  --max 5 --min-confidence medium --output proposals.json --jobforge
```

### Draft Content

Generate content drafts using profiles:

```bash
# List available profiles
growth profiles

# Draft landing page
growth draft-content --profile jobforge --type landing_page \
  --goal "Increase signups" --output draft.json --jobforge

# Draft onboarding email
growth draft-content --profile settler --type onboarding-email \
  --goal "Activate new users" --output email-draft.json
```

## Architecture

```
/src
├── contracts/     # Zod schemas (SEOFindings, FunnelMetrics, ExperimentProposal, ContentDraft)
├── seo/           # Site structure scanner (titles, meta, OG tags, canonical, links)
├── funnel/        # Event funnel analyzer (drop-offs, conversion rates)
├── experiments/   # Experiment proposer (hypotheses, effort, impact)
├── content/       # Content drafter (templates + optional LLM)
├── jobforge/      # Job request generator (autopilot.growth.*)
├── profiles/      # Brand profiles (base, jobforge, settler, readylayer, aias, keys)
└── utils/         # Shared utilities
```

## Commands

### `growth seo-scan`

Scan site for SEO issues:

```bash
growth seo-scan --path <dir> [options]

Options:
  --path <dir>        Path to site export or Next.js routes (required)
  --type <type>       Source type: nextjs_routes|html_export (default: html_export)
  --base-url <url>    Base URL for link checking
  --output <file>     Output file for findings (JSON)
  --jobforge          Generate JobForge request
  --tenant <id>       Tenant ID (or env GROWTH_TENANT_ID)
  --project <id>      Project ID (or env GROWTH_PROJECT_ID)
```

**Output**: `SEOFindings` with health score, issues, and opportunities.

**JobForge job type**: `autopilot.growth.seo_scan`

### `growth funnel`

Analyze event funnel:

```bash
growth funnel --events <file> --stages <stage1> <stage2> ... [options]

Options:
  --events <file>     Path to events JSON file (required)
  --stages <names>    Ordered list of funnel stage event names (required)
  --name <name>       Funnel name (default: Primary Funnel)
  --output <file>     Output file for metrics (JSON)
  --jobforge          Generate JobForge request
  --tenant <id>       Tenant ID
  --project <id>      Project ID
```

**Output**: `FunnelMetrics` with conversion rates and drop-off analysis.

**JobForge job type**: `autopilot.growth.experiment_propose` (when --jobforge)

### `growth propose-experiments`

Generate experiment proposals:

```bash
growth propose-experiments --funnel <file> [options]

Options:
  --funnel <file>     Path to funnel metrics JSON file (required)
  --max <number>      Maximum proposals (default: 5)
  --min-confidence    Minimum confidence: low|medium|high (default: low)
  --output <file>     Output file for proposals (JSON)
  --jobforge          Generate JobForge request
  --tenant <id>       Tenant ID
  --project <id>      Project ID
```

**Output**: `ExperimentProposal[]` ranked by priority score.

**JobForge job type**: `autopilot.growth.experiment_propose`

### `growth draft-content`

Draft content using profiles:

```bash
growth draft-content --profile <id> --type <type> [options]

Options:
  --profile <id>      Profile ID: base|jobforge|settler|readylayer|aias|keys (required)
  --type <type>       Content type (required)
                      landing_page|onboarding_email|changelog_note|blog_post|social_post|ad_copy|help_article
  --goal <goal>       Content goal (default: "Convert visitors to users")
  --audience <aud>    Target audience (default: "Technical decision makers")
  --variants <count>  Number of variants to generate (default: 3)
  --output <file>     Output file for draft (JSON)
  --jobforge          Generate JobForge request
  --tenant <id>       Tenant ID
  --project <id>      Project ID
```

**Output**: `ContentDraft` with multiple variants and suggested experiments.

**JobForge job type**: `autopilot.growth.content_draft`

### `growth profiles`

List available profiles:

```bash
growth profiles
```

## Profiles

Built-in profiles for common product types:

| Profile | Tone | Use Case |
|---------|------|----------|
| `base` | professional | Generic SaaS |
| `jobforge` | technical | Job orchestration |
| `settler` | friendly | Habit tracking |
| `readylayer` | technical | Deployment automation |
| `aias` | technical | AI agent systems |
| `keys` | professional | Secrets management |

Each profile includes:
- **ICP**: Ideal customer profile (title, pain points, goals)
- **Voice**: Tone, style notes, vocabulary
- **Keywords**: Primary, secondary, and negative keywords
- **Prohibited claims**: Claims that cannot be made
- **Features**: Product features with descriptions and benefits

## Data Schemas

### SEOFindings

```typescript
{
  tenant_context: { tenant_id: string; project_id: string };
  scanned_at: string; // ISO timestamp
  source_type: 'nextjs_routes' | 'html_export' | 'sitemap';
  source_path: string;
  health_score: {
    overall: number; // 0-100
    categories: Record<string, number>;
    total_pages: number;
    issues_by_severity: {
      critical: number;
      warning: number;
      info: number;
      opportunity: number;
    };
  };
  issues: SEOIssue[];
  summary: {
    total_pages: number;
    total_issues: number;
    actionable_items: number;
    opportunities: string[];
  };
}
```

### FunnelMetrics

```typescript
{
  tenant_context: { tenant_id: string; project_id: string };
  computed_at: string;
  funnel_name: string;
  stages: FunnelStage[];
  overall_conversion_rate: number;
  total_users_entered: number;
  total_users_completed: number;
  biggest_drop_off_stage: string | null;
  biggest_drop_off_rate: number | null;
  time_window: { start: string; end: string };
  evidence: Evidence[];
}
```

### ExperimentProposal

```typescript
{
  tenant_context: { tenant_id: string; project_id: string };
  proposal_id: string;
  created_at: string;
  type: 'ab_test' | 'multivariate' | 'personalization' | 'sequential' | 'rollback';
  name: string;
  description: string;
  target_funnel_stage: string | null;
  hypothesis: {
    belief: string;
    expected_outcome: string;
    success_metric: string;
    minimum_detectable_effect: string;
  };
  effort: 'low' | 'medium' | 'high';
  expected_impact: {
    metric: string;
    lift_percentage: number;
    confidence: 'low' | 'medium' | 'high';
  };
  variants: { name: string; description: string; traffic_percentage: number }[];
  required_sample_size: number;
  estimated_duration_days: number;
  evidence: Evidence[];
  prerequisites: string[];
  risks: string[];
}
```

### ContentDraft

```typescript
{
  tenant_context: { tenant_id: string; project_id: string };
  draft_id: string;
  created_at: string;
  content_type: 'landing_page' | 'onboarding_email' | 'changelog_note' | 'blog_post' | 'social_post' | 'ad_copy' | 'help_article';
  target_audience: string;
  goal: string;
  profile_used: string;
  llm_provider: string | null;
  llm_model: string | null;
  variants: { name: string; headline: string; body: string; cta: string; meta_description?: string; seo_keywords: string[] }[];
  recommended_variant: string;
  evidence: Evidence[];
  suggested_experiments: string[];
  constraints_respected: {
    prohibited_claims_checked: boolean;
    brand_voice_matched: boolean;
    character_limits_met: boolean;
  };
}
```

### JobForgeRequest

```typescript
{
  job_type: 'autopilot.growth.seo_scan' | 'autopilot.growth.experiment_propose' | 'autopilot.growth.content_draft';
  tenant_context: { tenant_id: string; project_id: string };
  priority: 'low' | 'normal' | 'high' | 'critical';
  requested_at: string;
  payload: Record<string, unknown>;
  evidence_links: { type: string; id: string; description: string }[];
  estimated_cost_credits?: number;
  expires_at?: string;
}
```

## JobForge Integration

Growth Autopilot provides a JobForge-compatible **analyze** surface that emits deterministic request bundles and report envelopes. The module never executes jobs; it only emits request bundles for JobForge to validate and run.

```bash
growth analyze \
  --inputs ./fixtures/jobforge/input.json \
  --tenant <tenant_id> \
  --project <project_id> \
  --trace <trace_id> \
  --out ./out
```

Add `--stable-output` when generating deterministic fixtures or docs.

The command writes:

- `request-bundle.json` (JobRequestBundle, schema_version `1.0.0`)
- `report.json` (ReportEnvelopeBundle, schema_version `1.0.0`)
- `report.md` (Markdown rendering)

When you use the `--jobforge` flag on other commands, the CLI generates a JobForge request file (`.job.json`) alongside your output. This request can be submitted to JobForge for execution:

```bash
# Generate JobForge request
growth seo-scan --path ./site --output findings.json --jobforge

# This creates:
# - findings.json (the scan results)
# - findings.job.json (the JobForge request)
```

**Important**: This tool does not auto-execute jobs. It generates requests. JobForge (or your job runner of choice) handles execution.

See [docs/jobforge-integration.md](./docs/jobforge-integration.md) for bundle validation and ingestion guidance.

## Examples

See the `/examples` directory:

- `examples/html-export/`: Sample static site export for SEO scanning
- `examples/events/`: Sample event data for funnel analysis
- `examples/outputs/`: Sample outputs from running commands

## Development

```bash
# Install dependencies
pnpm install

# Run in development mode
pnpm dev -- seo-scan --path ./examples/html-export

# Run tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Lint
pnpm lint

# Type check
pnpm typecheck

# Build
pnpm build
```

## Testing

All core functionality is tested:

- **Contracts**: Schema validation
- **SEO Scanner**: Deterministic output, link checker correctness
- **Funnel Analyzer**: Conversion calculations, pattern detection
- **Experiment Proposer**: Stable structure generation
- **Content Drafter**: Template generation, constraint validation
- **JobForge Integration**: Request validation
- **Profiles**: Profile loading and extension
- **Utilities**: Helper functions

## Non-Negotiables

1. **No auto-publish/posting**: This tool drafts and recommends only. It never publishes content, posts to social media, or deploys changes without explicit human approval through JobForge.

2. **No runner/scheduler/connector secrets**: Runnerless only. No cron jobs, no background workers, no API keys for external services.

3. **Multi-tenant safe**: Every output includes `tenant_id` and `project_id`. No cross-tenant data leakage possible.

4. **Evidence-linked**: Every recommendation includes `evidence` array showing what signal caused what recommendation.

5. **LLM optional**: SEO scanner and funnel analyzer work without LLM. Content drafter uses templates by default; LLM is optional enhancement.

6. **OSS ready**: Full documentation, comprehensive tests, CI/CD, examples.

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Contributing

Contributions welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details.

## Support

- GitHub Issues: [Report bugs or request features](https://github.com/openwork-community/growth-autopilot/issues)
- Discussions: [Ask questions or share ideas](https://github.com/openwork-community/growth-autopilot/discussions)

---

**Remember**: This tool generates recommendations. Execution happens through JobForge. Draft, don't deploy. Recommend, don't run.
