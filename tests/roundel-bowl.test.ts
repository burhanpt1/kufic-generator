// The great bowl of a roundel, found with the Burhan and Shamira cartouche: it clears the letters it holds (a ra's
// tail ran into its rising arm), the arrangement is chosen with the bowl drawn, its dot keeps clear of the other
// letters' dots (a nun's beside a ya's pair read as a third), a group can be moved by hand, and the cartouche can sit
// on tiles under its letters inside a single rim.
import { describe, expect, it } from 'vitest';
import { resolve } from '../src/compose';
import type { Composition, Style } from '../src/model/schema';
import { isValidComposition } from '../src/model/schema';
import { DEFAULT_STYLE } from '../src/model/style';
import { renderPlaced } from '../src/render/composition';
import { ROUNDEL_PEN, thuluth } from '../src/script/thuluth';
import { isLetter } from '../src/script/thuluth/engine';
import type { RoundelSpec } from '../src/script/thuluth/roundel';
import {
  buildRoundel,
  composeRoundel,
  extendTails,
  groupBox,
  scaleGroup,
  shapeBowl,
} from '../src/script/thuluth/roundel';

const NAMES = 'بُرْهَان وَشَمِيرَة';
const th = thuluth({ ...ROUNDEL_PEN, great: { ya: true, yaWide: 2.6, yaDeep: 1.3 } });
const spec = (o: Partial<RoundelSpec> = {}): RoundelSpec => ({
  text: NAMES,
  compose: { elongate: true, cross: true, fillTarget: 0.5, noRise: true, cradle: true, oval: 1.45, kern: true, tries: 6 }, // prettier-ignore
  tweaks: [{ at: 'و', scale: 0.62 }],
  bowl: { clear: 5.6, autoOval: true },
  frame: { markReach: 2.2 },
  ...o,
});
const bowlGroup = (r: ReturnType<typeof buildRoundel>) => r!.r.groups.findIndex(g => g.s === 'ن');

describe('the great bowl', () => {
  const b = buildRoundel(th, spec())!;
  it("chooses an arrangement whose bowl needed no more widening than the composer's first choice", () => {
    const first = composeRoundel(th, NAMES, spec().compose)[0];
    scaleGroup(
      th,
      first,
      first.groups.findIndex(g => g.s === 'و'),
      0.62,
    );
    shapeBowl(th, first, { clear: 5.6, autoOval: true });
    expect(b.r.bowlGrow).toBeDefined();
    expect(b.r.bowlGrow!).toBeLessThanOrEqual(Math.max(0.08, first.bowlGrow!));
  });
  it('keeps every other letter inside it, a pen width clear', () => {
    const gi = bowlGroup(b),
      G = b.r.st[gi],
      bowl = b.r.shapes[gi].b.strokes.flatMap(st => st.s.map(q => [q.x + G.x, q.y + G.y]));
    const lowest = Math.min(...bowl.map(q => q[1]));
    // letters of the other groups, sampled along their strokes
    const others = b.r.shapes.flatMap((S, i) => (i === gi ? [] : S.b.strokes.flatMap(st => st.s.map(q => [q.x + b.r.st[i].x, q.y + b.r.st[i].y])))); // prettier-ignore
    const below = bowl.filter(q => q[1] < lowest + 3);
    for (const [x, y] of others)
      for (const [bx, by] of below) expect(Math.hypot(x - bx, y - by)).toBeGreaterThan(th.style.nib * 0.9);
    expect(Math.min(...others.map(q => q[1]))).toBeGreaterThan(lowest);
  });
  it("puts its dot clear of the other letters' dots", () => {
    const gi = bowlGroup(b),
      dg = b.r.shapes[gi].b.dotGroups[0],
      at = [dg.x + b.r.st[gi].x, dg.y + b.r.st[gi].y];
    const dots = b.r.shapes.flatMap((S, i) => (i === gi ? [] : S.b.dotGroups.map(d => [d.x + b.r.st[i].x, d.y + b.r.st[i].y]))); // prettier-ignore
    for (const [x, y] of dots) expect(Math.hypot(at[0] - x, at[1] - y)).toBeGreaterThanOrEqual(th.style.nib * 3);
  });
  it('places its dot where a design asks', () => {
    const l = buildRoundel(th, spec({ bowl: { clear: 5.6, autoOval: true, dotAt: 0.42 } }))!,
      r2 = buildRoundel(th, spec({ bowl: { clear: 5.6, autoOval: true, dotAt: -0.42 } }))!;
    const x = (q: typeof l) => q.r.shapes[bowlGroup(q)].b.dotGroups[0].x + q.r.st[bowlGroup(q)].x;
    expect(x(l)).toBeLessThan(x(r2));
  });
});

describe('hand adjustments', () => {
  it('moves a group by an offset', () => {
    const a = buildRoundel(th, spec({ bowl: false, frame: false }))!,
      m = buildRoundel(th, spec({ bowl: false, frame: false, tweaks: [{ at: 'و', scale: 0.62, move: [1.5, -0.5] }] }))!; // prettier-ignore
    const i = a.r.groups.findIndex(g => g.s === 'و'),
      [p, q] = [groupBox(a.r, i), groupBox(m.r, i)];
    expect(q.x0 - p.x0).toBeCloseTo(1.5, 6);
    expect(q.y0 - p.y0).toBeCloseTo(-0.5, 6);
    expect(m.r.shapes[i].b.placed.filter(isLetter)).toHaveLength(1);
  });
});

describe('a cartouche on tiles', () => {
  const comp = (fill: Record<string, unknown>): Composition => {
    const style = structuredClone(DEFAULT_STYLE) as Style;
    return {
      version: 1,
      seed: 21,
      canvas: { shape: 'landscape', margin: 3 },
      style,
      texts: { names: { text: NAMES, repeat: 'once', wordGap: 2 } },
      root: {
        type: 'frame',
        child: {
          type: 'region',
          outline: { kind: 'circle' },
          borders: [],
          fill: { type: 'roundel', text: 'names', recipe: { tries: 2, oval: 1.45, bowl: { clear: 5.6 } }, ...fill },
        },
      },
    } as Composition;
  };
  it('validates the new options', () => {
    expect(isValidComposition(comp({ rim: 'single', fieldTiles: { fold: 8, scale: 3, wash: 0.5 } }))).toBe(true);
    expect(isValidComposition(comp({ rim: 'triple' }))).toBe(false);
    expect(isValidComposition(comp({ recipe: { tweaks: [{ at: 'و', move: [1, 2] }], bowl: { dotAt: 3 } } }))).toBe(false); // prettier-ignore
  });
  it('draws tiles inside the field under haloed letters, with one rim', () => {
    const tiled = renderPlaced(resolve(comp({ rim: 'single', fieldTiles: { fold: 8, scale: 3 } })), { idPrefix: 'a' }),
      plain = renderPlaced(resolve(comp({})), { idPrefix: 'b' });
    // the tiles are clipped to the field's ellipse, and there is one ellipse fewer in the rim
    expect(tiled).toMatch(/<clipPath id="a[^"]*"><ellipse/);
    expect(tiled.length).toBeGreaterThan(plain.length * 2);
    const ellipses = (s: string) => (s.match(/<ellipse cx="0"/g) || []).length;
    expect(ellipses(tiled)).toBe(ellipses(plain) - 1);
  }, 60000);
});

describe('nesting in a tail', () => {
  it('tucks the piece after a ra into its tail, further over it than kerning alone', () => {
    const opts = { elongate: true, cross: true, fillTarget: 0.5, noRise: true, kern: true, oval: 1.45, tries: 1, iters: 0 }; // prettier-ignore
    const plain = composeRoundel(th, NAMES, opts)[0],
      nested = composeRoundel(th, NAMES, { ...opts, nest: true })[0];
    for (const [ra, next] of [
      ['بر', 'ها'],
      ['شمير', 'ة'],
    ]) {
      const i = plain.groups.findIndex(g => g.s === ra),
        j = plain.groups.findIndex(g => g.s === next);
      const over = (r: typeof plain) => groupBox(r, i).x0 - groupBox(r, j).x1;
      // the next piece reaches back over the ra's tail, and sits no higher than its word's line
      expect(over(nested)).toBeLessThan(over(plain) - 1);
      expect(nested.st[j].y).toBeLessThanOrEqual(nested.st[i].y);
    }
  });
});

describe('drawn-out tails', () => {
  const NAMESPEC = { elongate: true, cross: true, fillTarget: 0.5, noRise: true, cradle: true, oval: 1.45, kern: true, tries: 6, seed: 7, nest: true }; // prettier-ignore
  const ink = (r: ReturnType<typeof composeRoundel>[0], i: number) =>
    r.shapes[i].b.strokes.flatMap(st => st.s.map(q => [q.x + r.st[i].x, q.y + r.st[i].y]));
  it('runs the waw under all of shamira, curving parallel to the bowl', () => {
    const { r } = buildRoundel(th, spec({ compose: NAMESPEC, tails: { reach: 8 } }))!;
    const at = (s2: string) => r.groups.findIndex(g => g.s === s2);
    const t = ink(r, at('و')),
      n = ['شمير', 'ة'].flatMap(s2 => ink(r, at(s2)));
    const tx0 = Math.min(...t.map(q => q[0])),
      low = Math.min(...t.map(q => q[1]));
    expect(tx0).toBeLessThan(Math.min(...n.map(q => q[0])));
    expect(low).toBeLessThan(Math.min(...n.map(q => q[1])));
    // a curve, not a level line: it rises from its lowest towards its far end, as the bowl does
    const end = t.filter(q => q[0] < tx0 + 2);
    expect(Math.min(...end.map(q => q[1])) - low).toBeGreaterThan(1.5);
  }, 60000);
  it('leaves a tail as written where no course keeps clear of the other letters', () => {
    const r = composeRoundel(th, NAMES, NAMESPEC)[0],
      i = r.groups.findIndex(g => g.s === 'بر'),
      before = JSON.stringify(ink(r, i));
    extendTails(th, r, { bowl: { clear: 5.6 } });
    // ها sits right above shamira: no room for the ra's tail between them
    expect(JSON.stringify(ink(r, i))).toBe(before);
  });
});
