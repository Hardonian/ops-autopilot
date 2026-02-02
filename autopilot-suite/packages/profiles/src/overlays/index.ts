import { type Profile, ProfileSchema } from '@autopilot/contracts';

/**
 * JobForge profile overlay
 * 
 * For workflow automation and job orchestration content.
 */
export const jobforgeProfile: Profile = ProfileSchema.parse({
  id: 'jobforge',
  name: 'JobForge',
  description: 'JobForge - Run remote jobs without infrastructure',
  
  icp: {
    title: 'Platform Engineer',
    company_size: '50-5000 employees',
    pain_points: [
      'Managing job runners is a headache',
      'Want to run jobs without infrastructure',
      'Need audit trails for compliance',
    ],
    goals: [
      'Run background jobs reliably',
      'Reduce infrastructure costs',
      'Maintain compliance and auditability',
    ],
  },
  
  voice: {
    tone: 'technical',
    style_notes: [
      'Use technical terms appropriately',
      'Include code examples',
      'Be precise about capabilities',
      'Show, don\'t just tell',
    ],
    vocabulary: {
      preferred: ['deterministic', 'idempotent', 'observable', 'composable'],
      avoid: ['magic', 'automatically', 'just works', 'seamless'],
    },
  },
  
  keywords: {
    primary: ['job orchestration', 'background jobs', 'serverless', 'infrastructure'],
    secondary: ['deterministic', 'audit trail', 'compliance', 'remote execution'],
    negative: ['cron', 'server management', 'devops', 'ops overhead'],
  },
  
  prohibited_claims: [
    'zero latency',
    'infinite scale',
    'no code required',
    'works with any system',
  ],
  
  features: [
    {
      name: 'Runnerless Execution',
      description: 'Run jobs without managing servers or containers',
      benefit: 'Focus on business logic, not infrastructure',
    },
    {
      name: 'Deterministic Runs',
      description: 'Same inputs always produce same outputs',
      benefit: 'Debug with confidence and audit with ease',
    },
    {
      name: 'Evidence Linked',
      description: 'Every output links back to the signal that caused it',
      benefit: 'Complete traceability for compliance',
    },
  ],
  
  metadata: {
    version: '1.0.0',
    category: 'infrastructure',
  },
});

/**
 * Settler profile overlay
 * 
 * For habit tracking and personal growth content.
 */
export const settlerProfile: Profile = ProfileSchema.parse({
  id: 'settler',
  name: 'Settler',
  description: 'Settler - Build habits that stick',
  
  icp: {
    title: 'Productivity Enthusiast',
    company_size: 'Individual to small team',
    pain_points: [
      'Can\'t stick to habits consistently',
      'No visibility into progress',
      'Accountability is hard',
    ],
    goals: [
      'Build lasting habits',
      'Track progress visually',
      'Stay accountable',
    ],
  },
  
  voice: {
    tone: 'friendly',
    style_notes: [
      'Encouraging but not pushy',
      'Celebrate small wins',
      'Use positive language',
      'Be empathetic to struggles',
    ],
    vocabulary: {
      preferred: ['growth', 'progress', 'journey', 'milestone', 'celebrate'],
      avoid: ['fail', 'cheat', 'bad', 'should', 'must'],
    },
  },
  
  keywords: {
    primary: ['habit tracking', 'personal growth', 'consistency', 'accountability'],
    secondary: ['streaks', 'milestones', 'progress', 'routines'],
    negative: ['punishment', 'guilt', 'shame', 'perfection'],
  },
  
  prohibited_claims: [
    'change your life overnight',
    'guaranteed results',
    'effortless habits',
    'works for everyone',
  ],
  
  features: [
    {
      name: 'Streak Tracking',
      description: 'Visualize your consistency with beautiful streaks',
      benefit: 'Stay motivated by seeing your progress',
    },
    {
      name: 'Smart Reminders',
      description: 'Get reminded at the right time based on your patterns',
      benefit: 'Never forget your habits again',
    },
    {
      name: 'Progress Insights',
      description: 'See trends and patterns in your habit data',
      benefit: 'Understand what works for you',
    },
  ],
  
  metadata: {
    version: '1.0.0',
    category: 'productivity',
  },
});

/**
 * ReadyLayer profile overlay
 * 
 * For deployment automation and environment management content.
 */
export const readylayerProfile: Profile = ProfileSchema.parse({
  id: 'readylayer',
  name: 'ReadyLayer',
  description: 'ReadyLayer - Deploy environments in one click',
  
  icp: {
    title: 'DevOps Engineer',
    company_size: '20-500 employees',
    pain_points: [
      'Environment setup takes too long',
      'Inconsistent environments between dev and prod',
      'Hard to reproduce production issues',
    ],
    goals: [
      'Deploy environments instantly',
      'Maintain environment parity',
      'Reduce infrastructure drift',
    ],
  },
  
  voice: {
    tone: 'technical',
    style_notes: [
      'Focus on reliability and speed',
      'Use DevOps terminology correctly',
      'Emphasize consistency',
      'Show infrastructure benefits',
    ],
    vocabulary: {
      preferred: ['immutable', 'reproducible', 'declarative', 'ephemeral', 'parity'],
      avoid: ['magic', 'simple', 'just', 'configure once'],
    },
  },
  
  keywords: {
    primary: ['environment management', 'deployment automation', 'infrastructure as code'],
    secondary: ['preview environments', 'dev parity', 'reproducible builds', 'ephemeral'],
    negative: ['manual setup', 'configuration drift', 'works on my machine'],
  },
  
  prohibited_claims: [
    'zero configuration',
    'works with any stack',
    'no learning curve',
    'instant migration',
  ],
  
  features: [
    {
      name: 'One-Click Deploy',
      description: 'Deploy fully configured environments with a single click',
      benefit: 'Go from idea to running environment in seconds',
    },
    {
      name: 'Environment Parity',
      description: 'Every environment matches production exactly',
      benefit: 'Catch issues before they reach production',
    },
    {
      name: 'Ephemeral Environments',
      description: 'Create temporary environments for testing and review',
      benefit: 'Test changes in isolation without cost overhead',
    },
  ],
  
  metadata: {
    version: '1.0.0',
    category: 'devops',
  },
});

/**
 * AIAS profile overlay
 * 
 * For AI agent systems and multi-agent orchestration content.
 */
export const aiasProfile: Profile = ProfileSchema.parse({
  id: 'aias',
  name: 'AIAS',
  description: 'AIAS - Autonomous AI Systems for complex workflows',
  
  icp: {
    title: 'AI Engineer',
    company_size: '50-1000 employees',
    pain_points: [
      'LLM outputs are unpredictable',
      'Hard to compose multiple AI agents',
      'Need observability into AI decisions',
    ],
    goals: [
      'Build reliable AI systems',
      'Orchestrate multiple agents',
      'Monitor and debug AI behavior',
    ],
  },
  
  voice: {
    tone: 'technical',
    style_notes: [
      'Be precise about capabilities and limitations',
      'Use AI/ML terminology correctly',
      'Emphasize reliability and observability',
      'Include concrete examples',
    ],
    vocabulary: {
      preferred: ['deterministic', 'observable', 'composable', 'agentic', 'orchestration'],
      avoid: ['intelligent', 'smart', 'magical', 'human-like', 'conscious'],
    },
  },
  
  keywords: {
    primary: ['AI agents', 'agent orchestration', 'LLM workflows', 'autonomous systems'],
    secondary: ['observability', 'deterministic', 'agent composition', 'LLM ops'],
    negative: ['AGI', 'sentient', 'perfect', 'unlimited', 'self-aware'],
  },
  
  prohibited_claims: [
    'thinks like a human',
    'understands context perfectly',
    'makes no mistakes',
    'replaces human judgment',
  ],
  
  features: [
    {
      name: 'Agent Composition',
      description: 'Build complex workflows by composing specialized agents',
      benefit: 'Solve problems too complex for single agents',
    },
    {
      name: 'Deterministic Execution',
      description: 'Same inputs always produce the same outputs',
      benefit: 'Debug and test AI systems with confidence',
    },
    {
      name: 'Full Observability',
      description: 'Trace every decision and intermediate step',
      benefit: 'Understand and improve agent behavior',
    },
  ],
  
  metadata: {
    version: '1.0.0',
    category: 'ai',
  },
});

/**
 * Keys profile overlay
 * 
 * For secrets management and security content.
 */
export const keysProfile: Profile = ProfileSchema.parse({
  id: 'keys',
  name: 'Keys',
  description: 'Keys - Secure secrets management for teams',
  
  icp: {
    title: 'Security Engineer',
    company_size: '10-1000 employees',
    pain_points: [
      'Secrets scattered in code and config files',
      'Hard to rotate credentials',
      'No audit trail for secret access',
    ],
    goals: [
      'Centralize secrets management',
      'Automate rotation',
      'Maintain full audit trails',
    ],
  },
  
  voice: {
    tone: 'professional',
    style_notes: [
      'Emphasize security and compliance',
      'Be precise about encryption',
      'Avoid downplaying risks',
      'Use security terminology correctly',
    ],
    vocabulary: {
      preferred: ['encrypted', 'zero-knowledge', 'rotation', 'audit', 'compliance'],
      avoid: ['unbreakable', 'military-grade', 'impossible', 'absolute'],
    },
  },
  
  keywords: {
    primary: ['secrets management', 'credential rotation', 'vault', 'encryption'],
    secondary: ['zero-knowledge', 'audit trail', 'compliance', 'access control'],
    negative: ['unhackable', 'perfect security', 'unlimited protection'],
  },
  
  prohibited_claims: [
    'unhackable',
    '100% secure',
    'unbreakable encryption',
    'immune to attacks',
  ],
  
  features: [
    {
      name: 'Encrypted Vault',
      description: 'Store secrets with end-to-end encryption',
      benefit: 'Your secrets are never exposed in plain text',
    },
    {
      name: 'Automatic Rotation',
      description: 'Rotate credentials on a schedule or on-demand',
      benefit: 'Reduce risk of credential compromise',
    },
    {
      name: 'Access Auditing',
      description: 'Every secret access is logged and auditable',
      benefit: 'Meet compliance requirements with detailed audit trails',
    },
  ],
  
  metadata: {
    version: '1.0.0',
    category: 'security',
  },
});