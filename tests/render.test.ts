import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { setOverrides } from '../src/engine';
import { GOLDEN_DIR, manifest, svgFor } from './golden/svg';

beforeAll(() => setOverrides({}));

describe('renderer reproduces the golden SVGs', () => {
  it.each(manifest().map(c => [c.id, c.render] as const))('%s', (id, render) => {
    const expected = readFileSync(join(GOLDEN_DIR, 'svg', `${id}.svg`), 'utf8');
    expect(svgFor(id, render) + '\n' === expected).toBe(true);
  });
});
