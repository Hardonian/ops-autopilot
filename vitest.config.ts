import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'dist/', 'tests/', '*.config.ts', '*.config.js'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@autopilot/contracts': resolve(
        __dirname,
        'autopilot-suite/packages/contracts/dist/index.js'
      ),
      '@autopilot/jobforge-client': resolve(
        __dirname,
        'autopilot-suite/packages/jobforge-client/dist/index.js'
      ),
      '@autopilot/profiles': resolve(__dirname, 'autopilot-suite/packages/profiles/dist/index.js'),
    },
  },
});
