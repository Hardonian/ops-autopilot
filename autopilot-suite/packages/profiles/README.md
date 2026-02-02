# @autopilot/profiles

Shared profile system for Autopilot modules - base profile + per-app overlays.

## Overview

This package provides pre-configured profiles for content generation and recommendations across the Autopilot ecosystem:

- **Base**: Sensible defaults for any SaaS product
- **JobForge**: Infrastructure and job orchestration
- **Settler**: Habit tracking and personal growth
- **ReadyLayer**: DevOps and environment management
- **AIAS**: AI agent systems and orchestration
- **Keys**: Secrets management and security

## Installation

```bash
npm install @autopilot/profiles
# or
pnpm add @autopilot/profiles
```

## Usage

### Get a Profile

```typescript
import { getProfile, listProfiles } from '@autopilot/profiles';

// List available profiles
const profileIds = listProfiles();
// ['base', 'jobforge', 'settler', 'readylayer', 'aias', 'keys']

// Get specific profile
const profile = getProfile('jobforge');
console.log(profile.voice.tone); // 'technical'
console.log(profile.icp.title);  // 'Platform Engineer'
```

### Create Custom Profile

```typescript
import { createCustomProfile, validateCustomProfile } from '@autopilot/profiles';

// Extend base profile
const customProfile = createCustomProfile('base', {
  id: 'myapp',
  name: 'MyApp',
  description: 'My custom application',
  icp: {
    title: 'Developer',
    company_size: '1-100',
    pain_points: ['Complexity'],
    goals: ['Simplicity'],
  },
});

// Validate
const result = validateCustomProfile(customProfile);
if (!result.valid) {
  console.log('Errors:', result.errors);
}
```

### Access Profile Components

```typescript
const profile = getProfile('settler');

// Ideal Customer Profile
console.log(profile.icp.pain_points);

// Voice and tone
console.log(profile.voice.tone);        // 'friendly'
console.log(profile.voice.style_notes); // ['Encouraging but not pushy', ...]

// Keywords
console.log(profile.keywords.primary);   // ['habit tracking', ...]
console.log(profile.keywords.negative);  // ['punishment', 'guilt', ...]

// Prohibited claims (for compliance)
console.log(profile.prohibited_claims);  // ['change your life overnight', ...]

// Features
console.log(profile.features.map(f => f.name));
```

### Filter by Category

```typescript
import { getProfilesByCategory } from '@autopilot/profiles';

const devopsProfiles = getProfilesByCategory('devops');
// [readylayerProfile]

const aiProfiles = getProfilesByCategory('ai');
// [aiasProfile]
```

## Profile Structure

Each profile includes:

- **id**: Unique identifier
- **name**: Display name
- **description**: Brief description
- **icp**: Ideal Customer Profile (title, company size, pain points, goals)
- **voice**: Tone and vocabulary guidelines
- **keywords**: Primary, secondary, and negative keywords
- **prohibited_claims**: Claims that cannot be made (compliance)
- **features**: Key features with benefits
- **metadata**: Additional metadata (version, category)

## License

MIT