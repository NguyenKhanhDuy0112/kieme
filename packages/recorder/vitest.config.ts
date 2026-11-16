import { defineProject } from 'vitest/config';

// Shared CI runners are slower and uneven: longer timeouts + retries for timing flakes.
// A real bug still fails (it fails on every attempt).
const CI = Boolean(process.env.CI);

export default defineProject({
  test: {
    name: 'recorder',
    include: ['src/**/*.test.ts'],
    // Browser + demo-site tests.
    testTimeout: CI ? 180_000 : 60_000,
    hookTimeout: CI ? 180_000 : 60_000,
    retry: CI ? 2 : 0,
  },
});
