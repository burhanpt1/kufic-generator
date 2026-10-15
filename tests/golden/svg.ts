// The golden SVG for a case: its recorded engine call through the engine, then its recorded render call.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { alphabet, compose } from '../../src/engine';
import type { ComposeOptions, ComposeResult, Grid } from '../../src/engine';
import { renderCircle, renderGrid, renderSquare, wrap } from '../../src/render';
import type { RenderOptions } from '../../src/render';

export const GOLDEN_DIR = import.meta.dirname;
export type RenderCall = { fn: string; opt: RenderOptions; margin?: number } | null;
export interface Case {
  id: string;
  render: RenderCall;
}
export const manifest = (): Case[] => JSON.parse(readFileSync(join(GOLDEN_DIR, 'manifest.json'), 'utf8'));
export const engineCase = (id: string): { fn: 'compose' | 'alphabet'; args: unknown[] } =>
  JSON.parse(readFileSync(join(GOLDEN_DIR, 'engine', `${id}.json`), 'utf8'));
export const runEngine = ({ fn, args }: { fn: string; args: unknown[] }) =>
  fn === 'compose' ? compose(args[0] as ComposeOptions) : alphabet(args[0] as number, args[1] as never);

export function svgFor(id: string, render: RenderCall): string {
  const { fn, args } = engineCase(id);
  if (fn === 'alphabet') return renderGrid(alphabet(args[0] as number, args[1] as never), render!.opt, render!.margin!);
  const res = compose(args[0] as ComposeOptions) as ComposeResult & { grid?: Grid };
  if (!render) {
    // empty result: a blank 200 × 200 with the default palette's paper
    const text = (args[0] as ComposeOptions).text;
    return wrap(200, 200, { paper: '#DDD0B6', label: 'Kufic rendering of ' + text.replace(/\n/g, ' ') }, '');
  }
  if (render.fn === 'renderGrid') return renderGrid(res.grid!, render.opt, render.margin!);
  const comp = res as Extract<ComposeResult, { kind: 'square' | 'circle' }>;
  return render.fn === 'renderCircle' ? renderCircle(comp, render.opt) : renderSquare(comp, render.opt);
}
