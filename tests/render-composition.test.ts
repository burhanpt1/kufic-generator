import { describe, expect, it } from 'vitest';
import { resolve } from '../src/compose';
import { inside } from '../src/geometry/poly';
import { preset } from '../src/model/presets';
import type { Composition } from '../src/model/schema';
import { renderPlaced } from '../src/render/composition';

const withStroke = (kind: 'blocks' | 'curved' | 'pen', banded = false): Composition => {
  const c = structuredClone(preset('octagon-panel'));
  c.style.stroke = { ...c.style.stroke, kind, banded, corner: 0.6 };
  c.style.terminals = { kind: 'palmette', reach: 'tails' };
  return c;
};
const letters = (svg: string) => svg.slice(svg.indexOf('data-layer="letters"'), svg.indexOf('data-layer="separators"'));

describe('stroke modes', () => {
  const blocks = renderPlaced(resolve(withStroke('blocks'))),
    curved = renderPlaced(resolve(withStroke('curved'))),
    pen = renderPlaced(resolve(withStroke('pen')));
  it('draws grid blocks as filled rectangles and polygons', () => {
    expect(letters(blocks)).not.toMatch(/stroke-linecap="round"/);
  });
  it('draws curved strokes as smooth stroked centrelines with round joins', () => {
    expect(letters(curved)).toMatch(
      /fill="none" stroke="#[0-9A-Fa-f]{6}" stroke-width="[\d.]+" stroke-linecap="round" stroke-linejoin="round"/,
    );
  });
  it('draws the broad nib as one swept outline per stroke, not stacked copies', () => {
    const l = letters(pen);
    expect(l).not.toMatch(/transform="translate/);
    // the nib's Minkowski sweep: parallelograms filled and stroked (the nib's round thickness) in one colour
    expect(l).toMatch(
      /<path d="M[^"]+Z" fill="(#[0-9A-Fa-f]{6})" stroke="\1" stroke-width="[\d.]+" stroke-linejoin="round"\/>/,
    );
  });
  it('banded letters add a paper-coloured inner line in every mode', () => {
    const paper = withStroke('blocks').style.palette.paper;
    for (const k of ['blocks', 'curved', 'pen'] as const) {
      const plain = letters(renderPlaced(resolve(withStroke(k)))),
        banded = letters(renderPlaced(resolve(withStroke(k, true))));
      expect(banded.split(paper).length).toBeGreaterThan(plain.split(paper).length);
    }
  });
  it('keeps the same composition in every mode (only the drawing changes)', () => {
    const a = resolve(withStroke('blocks')),
      b = resolve(withStroke('pen'));
    expect(JSON.stringify(a.items)).toBe(JSON.stringify(b.items));
  });
});

describe('spandrel stars', () => {
  it('sit in the corner pockets, outside the outline', () => {
    const p = resolve(preset('octagon-panel')),
      stars = p.items.filter(i => i.type === 'star');
    expect(stars).toHaveLength(4);
    for (const s of stars) if (s.type === 'star') expect(inside(p.meta.outline, s.centre[0], s.centre[1])).toBe(false);
  });
});
