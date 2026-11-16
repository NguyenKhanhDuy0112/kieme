import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'demo-site',
    include: ['server/**/*.test.ts'],
  },
});
