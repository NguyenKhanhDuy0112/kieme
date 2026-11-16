import { defineConfig } from 'vitest/config';

// Root config: lets `pnpm vitest` run every workspace project at once.
// Per-package `test` scripts (run via Turborepo) use each package's own config.
export default defineConfig({
  test: {
    projects: ['packages/*', 'apps/*'],
  },
});
