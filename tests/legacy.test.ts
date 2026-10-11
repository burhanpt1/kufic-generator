import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CASES } from './golden/cases.mjs';
import { runCase } from './golden/harness.mjs';

const root = join(import.meta.dirname, '..');
const LEGACY = join(root, 'legacy/index.html');
const golden = (rel: string) => readFileSync(join(root, 'tests/golden', rel), 'utf8');

// Until the new UI replaces it (migration step 5), index.html is the prototype, kept identical to legacy/.
it('index.html matches legacy/index.html', () => {
  expect(readFileSync(join(root, 'index.html'), 'utf8')).toBe(readFileSync(LEGACY, 'utf8'));
});

describe('legacy prototype reproduces the golden snapshots', () => {
  it.each(CASES.map(c => [c.id, c] as const))('%s', (id, c) => {
    const r = runCase(LEGACY, c);
    expect(r.svg + '\n' === golden(`svg/${id}.svg`), 'SVG differs').toBe(true);
    if (r.engine)
      expect(JSON.stringify(r.engine) + '\n' === golden(`engine/${id}.json`), 'engine output differs').toBe(true);
  });
});
