import { type Profile, ProfileSchema } from '@autopilot/contracts';

/**
 * Base profile with sensible defaults for any SaaS product
 */
export const baseProfile: Profile = {
  id: 'base',
  name: 'Base Profile',
  description: 'Sensible defaults for any SaaS product',
  
  icp: {
    title: 'Technical Decision Maker',
    company_size: '10-500 employees',
    pain_points: [
      'Manual processes that don\'t scale',
      'Too many tools that don\'t integrate',
      'Lack of visibility into key metrics',
    ],
    goals: [
      'Automate repetitive tasks',
      'Improve team productivity',
      'Make data-driven decisions',
    ],
  },
  
  voice: {
    tone: 'professional',
    style_notes: [
      'Clear and concise',
      'Lead with benefits, not features',
      'Use active voice',
      'Avoid jargon',
    ],
    vocabulary: {
      preferred: ['simple', 'fast', 'reliable', 'secure', 'scalable'],
      avoid: ['cheap', 'easy', 'just', 'simply', 'obviously'],
    },
  },
  
  keywords: {
    primary: ['automation', 'workflow', 'integration', 'productivity'],
    secondary: ['saas', 'cloud', 'api', 'scalable'],
    negative: ['cheap', 'free', 'discount', 'hack', 'trick'],
  },
  
  prohibited_claims: [
    '100% guaranteed',
    'never fails',
    'unlimited',
    'instant',
    'no effort required',
  ],
  
  features: [
    {
      name: 'Workflow Automation',
      description: 'Connect your tools and automate repetitive tasks',
      benefit: 'Save hours of manual work every week',
    },
    {
      name: 'Real-time Dashboards',
      description: 'Track key metrics and visualize your data',
      benefit: 'Make better decisions with live insights',
    },
    {
      name: 'Team Collaboration',
      description: 'Work together with shared workspaces and permissions',
      benefit: 'Keep everyone aligned and productive',
    },
  ],
  
  metadata: {
    version: '1.0.0',
    category: 'saas',
  },
};

/**
 * Validate the base profile
 */
export function validateBaseProfile(): boolean {
  const result = ProfileSchema.safeParse(baseProfile);
  return result.success;
}