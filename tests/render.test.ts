import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { alphabet, compose, setOverrides } from '../src/engine';
import type { ComposeOptions, ComposeResult, Grid } from '../src/engine';
import { renderCircle, renderGrid, renderSquare, wrap } from '../src/render';
import type { RenderOptions } from '../src/render';

const dir = join(import.meta.dirname, 'golden');
const manifest: {
  id: string;
  render: { fn: string; opt: RenderOptions; margin?: number } | null;
}[] = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));

beforeAll(() => setOverrides({}));

// Run the recorded engine call through the new engine, then the recorded render call through the new renderer.
function svgFor(id: string, render: { fn: string; opt: RenderOptions; margin?: number } | null): string {
  const { fn, args } = JSON.parse(readFileSync(join(dir, 'engine', `${id}.json`), 'utf8'));
  if (fn === 'alphabet') return renderGrid(alphabet(args[0], args[1]), render!.opt, render!.margin!);
  const res = compose(args[0] as ComposeOptions) as ComposeResult & { grid?: Grid };
  if (!render) {
    // empty result: the page draws a blank 200 × 200 with the default palette's paper
    const text = (args[0] as ComposeOptions).text;
    return wrap(200, 200, { paper: '#DDD0B6', label: 'Kufic rendering of ' + text.replace(/\n/g, ' ') }, '');
  }
  if (render.fn === 'renderGrid') return renderGrid(res.grid!, render.opt, render.margin!);
  const comp = res as Extract<ComposeResult, { kind: 'square' | 'circle' }>;
  return render.fn === 'renderCircle' ? renderCircle(comp, render.opt) : renderSquare(comp, render.opt);
}

describe('renderer reproduces the golden SVGs', () => {
  it.each(manifest.map(c => [c.id, c.render] as const))('%s', (id, render) => {
    const expected = readFileSync(join(dir, 'svg', `${id}.svg`), 'utf8');
    expect(svgFor(id, render) + '\n' === expected).toBe(true);
  });
});
