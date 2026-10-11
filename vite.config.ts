import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // relative asset URLs, so the build works under any GitHub Pages path
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        legacy: resolve(import.meta.dirname, 'legacy/index.html'),
      },
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    testTimeout: 30_000,
  },
});
