// `npm run golden`: rewrite tests/golden/ from the current engine and renderer, for intentional output changes
// (review the diff). Each case keeps its recorded engine call and render call; only the outputs are recomputed.
// Skipped in a normal test run.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, it } from 'vitest';
import { setOverrides } from '../src/engine';
import { serialize } from './golden/harness.mjs';
import { GOLDEN_DIR, engineCase, manifest, runEngine, svgFor } from './golden/svg';

beforeAll(() => setOverrides({}));

describe.skipIf(!process.env.UPDATE_GOLDEN)('rewrite the golden snapshots', () => {
  it.each(manifest().map(c => [c.id, c.render] as const))('%s', (id, render) => {
    const call = engineCase(id);
    writeFileSync(
      join(GOLDEN_DIR, 'engine', `${id}.json`),
      JSON.stringify({ fn: call.fn, args: call.args, output: serialize(runEngine(call)) }) + '\n',
    );
    writeFileSync(join(GOLDEN_DIR, 'svg', `${id}.svg`), svgFor(id, render) + '\n');
  });
});
