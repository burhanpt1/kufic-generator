import { readdirSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';
import SlowestFirst from './tests/sequencer.mjs';

const here = import.meta.dirname;
const demos = Object.fromEntries(
  readdirSync(resolve(here, 'demos'))
    .filter(f => f.endsWith('.html'))
    .map(f => [`demos/${f.slice(0, -5)}`, resolve(here, 'demos', f)]),
);

export default defineConfig({
  // relative asset URLs, so the build works under any GitHub Pages path
  base: './',
  build: {
    rollupOptions: { input: { main: resolve(here, 'index.html'), studio: resolve(here, 'studio.html'), ...demos } },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['tests/setup.ts'],
    // every core (vitest leaves one free by default), slowest files first; a worker keeps its modules from file to
    // file (the engine is imported once per worker, not once per file, and its caches of shapes and drawings carry
    // over), which is safe as no test leaves global state changed
    maxWorkers: availableParallelism(),
    sequence: { sequencer: SlowestFirst },
    isolate: false,
    // a larger young generation: the composers allocate freely, and scavenging less often saves a sixth of the time
    execArgv: ['--max-semi-space-size=64'],
    // the roundel composer and critic tests take 30–70 s on a four-core machine
    testTimeout: 120_000,
  },
});
