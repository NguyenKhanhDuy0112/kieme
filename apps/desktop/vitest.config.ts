import { resolve } from 'node:path';
import { defineProject } from 'vitest/config';

export default defineProject({
  resolve: {
    alias: {
      '@renderer': resolve(__dirname, 'src/renderer/src'),
    },
  },
  test: {
    name: 'desktop',
    include: ['src/**/*.test.ts'],
  },
});
