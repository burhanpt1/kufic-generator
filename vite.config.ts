import { defineConfig } from 'vitest/config';

export default defineConfig({
  // relative asset URLs, so the build works under any GitHub Pages path
  base: './',
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    testTimeout: 30_000,
  },
});
