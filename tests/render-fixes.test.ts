// Regressions from a review of the renderer: the drawing order of banded letters' inner lines, and large strips.
import { describe, expect, it } from 'vitest';
import { resolve } from '../src/compose';
import { compose } from '../src/engine';
import type { CircleRing, ComposeOptions, ComposeResult } from '../src/engine';
import { preset } from '../src/model/presets';
import { renderCircle, renderSquare } from '../src/render';
import type { RenderOptions } from '../src/render';
import { renderPlaced } from '../src/render/composition';
import { groupsOut, merge } from '../src/render/svg';
import type { Shapes } from '../src/render/svg';

const OPT: RenderOptions = {
  weight: 0.85, soft: 0, ink: '#111111', ink2: '#aa0000', paper: '#ffffff', mark: '#00aa00', grid: false, label: 't',
  terminal: 'none', colourMode: 'solid', ground: 'plain', corners: 'none', bandStyle: 'none', tiling: '488',
  geoAngle: 67, geoScale: 5, letterStyle: 'banded',
}; // prettier-ignore
const BASE: ComposeOptions = { text: 'يا علي مدد', layout: 'rings', H: 9, wordGap: 2, center: 'none', rings: 2 };
type Rings = Extract<ComposeResult, { kind: 'square' | 'circle' }>;
/** The fills of the letter groups, in drawing order (the last group, the vowel marks, left out). */
const fills = (svg: string) => [...svg.matchAll(/<g fill="(#[0-9a-fA-F]{6})"/g)].map(m => m[1]).slice(0, -1);

describe('banded letters: the inner line is drawn above every ink colour', () => {
  for (const layout of ['rings', 'circle'] as const)
    for (const colourMode of ['ring', 'repeat'] as const)
      it(`${layout}, colour by ${colourMode}`, () => {
        const res = compose({ ...BASE, layout }) as Rings,
          svg = (layout === 'circle' ? renderCircle : renderSquare)(res, { ...OPT, colourMode }),
          f = fills(svg);
        // more than one ink colour, then the paper group, once and last
        expect(new Set(f).size).toBeGreaterThan(2);
        expect(f.filter(c => c === OPT.paper)).toHaveLength(1);
        expect(f[f.length - 1]).toBe(OPT.paper);
      });
  it('a single colour draws as before: ink, then its inner lines', () => {
    const res = compose(BASE) as Rings;
    expect(fills(renderSquare(res, OPT))).toEqual([OPT.ink, OPT.paper]);
    expect(fills(renderSquare(res, { ...OPT, letterStyle: 'solid' }))).toEqual([OPT.ink]);
  });
  it('holds for placed compositions coloured by ring', () => {
    const c = structuredClone(preset('fatimid-medallion'));
    c.style.stroke = { ...c.style.stroke, kind: 'blocks', banded: true };
    c.style.colouring = 'byRing';
    const svg = renderPlaced(resolve(c)),
      letters = svg.slice(svg.indexOf('data-layer="letters"'), svg.indexOf('data-layer="separators"')),
      paper = c.style.palette.paper,
      f = fills(letters);
    expect(new Set(f).size).toBeGreaterThan(2);
    expect(f.indexOf(paper)).toBe(f.length - 1);
  });
  it('groupsOut puts the paper group last whatever the order shapes were merged in', () => {
    const sh: Shapes = { ink: new Map(), vow: [] };
    merge(sh, { ink: new Map([['#111111', ['<a/>']], ['#ffffff', ['<p1/>']]]), vow: [] }); // prettier-ignore
    merge(sh, { ink: new Map([['#aa0000', ['<b/>']], ['#ffffff', ['<p2/>']]]), vow: ['<v/>'] }); // prettier-ignore
    expect(groupsOut(OPT, sh, null)).toBe(
      '<g fill="#111111"><a/></g><g fill="#aa0000"><b/></g><g fill="#ffffff"><p1/><p2/></g><g fill="#00aa00"><v/></g>',
    );
  });
});

describe('large strips', () => {
  it('renderCircle finds the highest repeat of a ring past the argument limit of a call', () => {
    const res = compose({ ...BASE, layout: 'circle', rings: 1 }) as Rings,
      small = res.rings[0] as CircleRing,
      rows = 40000; // 40000 rows of cells: far more elements than Math.max(...tag) can take
    const data = new Uint8Array(small.W * rows),
      tag = new Uint8Array(small.W * rows);
    data.set(small.data);
    tag.set(small.tag);
    expect(data.length).toBeGreaterThan(1_000_000);
    const big = { ...res, rings: [{ ...small, data, tag }] },
      opt: RenderOptions = { ...OPT, letterStyle: 'solid', colourMode: 'repeat' };
    // the padding rows are beyond the band (Hb is unchanged), so the drawing is the small ring's
    expect(renderCircle(big, opt)).toBe(renderCircle(res, opt));
  });
  it('merge takes more shapes than a call takes arguments', () => {
    const many = Array.from({ length: 300_000 }, () => '<p/>'),
      sh: Shapes = { ink: new Map(), vow: [] };
    merge(sh, { ink: new Map([['#111111', many]]), vow: many });
    expect(sh.ink.get('#111111')).toHaveLength(300_000);
    expect(sh.vow).toHaveLength(300_000);
  });
});
