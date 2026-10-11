import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

const here = import.meta.dirname;
const demos = Object.fromEntries(
  readdirSync(resolve(here, 'demos'))
    .filter(f => f.endsWith('.html'))
    .map(f => [`demos/${f.slice(0, -5)}`, resolve(here, 'demos', f)]),
);

export default defineConfig({
  // relative asset URLs, so the build works under any GitHub Pages path
  base: './',
  build: { rollupOptions: { input: { main: resolve(here, 'index.html'), ...demos } } },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    testTimeout: 30_000,
  },
});
