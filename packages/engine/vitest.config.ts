import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'engine',
    include: ['src/**/*.test.ts'],
    // Browser + demo-site tests.
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
