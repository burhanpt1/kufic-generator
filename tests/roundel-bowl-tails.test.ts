// The Burhan and Shamira cartouche, continued (tests/roundel-bowl.test.ts has the great bowl itself): tails drawn out
// under what nests in them, stacked pieces and their reading order, a free-standing great nun, clashes between
// letters, and the roundel critic.
import { describe, expect, it } from 'vitest';
import { resolve } from '../src/compose';
import type { Composition } from '../src/model/schema';
import { isValidComposition } from '../src/model/schema';
import { DEFAULT_STYLE } from '../src/model/style';
import { buildRoundel, composeRoundel, extendTails } from '../src/script/thuluth/roundel';
import { NAMES, spec, th } from './helpers/roundel-names';

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
  }, 180000);
  it('leaves a tail as written where no course keeps clear of the other letters', () => {
    const r = composeRoundel(th, NAMES, NAMESPEC)[0],
      i = r.groups.findIndex(g => g.s === 'بر'),
      before = JSON.stringify(ink(r, i));
    extendTails(th, r, { bowl: { clear: 5.6 } });
    // ها sits right above shamira: no room for the ra's tail between them
    expect(JSON.stringify(ink(r, i))).toBe(before);
  });
});

describe('stacking', () => {
  it('lifts some piece of a word above the one before it when allowed, and never when not', () => {
    const opts = { elongate: true, cross: true, fillTarget: 0.5, noRise: true, kern: true, oval: 1.45, tries: 4, seed: 5 }; // prettier-ignore
    const lifted = (r: ReturnType<typeof composeRoundel>[0]) =>
      r.groups.some((g, i) => i > 0 && r.groups[i - 1].word === g.word && r.st[i].y > r.st[i - 1].y + 1);
    expect(composeRoundel(th, NAMES, opts).some(lifted)).toBe(false);
    expect(composeRoundel(th, NAMES, { ...opts, stack: true }).some(lifted)).toBe(true);
  });
});

describe('the roundel critic', () => {
  it('scores how a roundel came out', async () => {
    const { metrics } = await import('../src/evolve/critic');
    const c = {
      version: 1,
      seed: 21,
      canvas: { shape: 'landscape', margin: 3 },
      style: structuredClone(DEFAULT_STYLE),
      texts: { names: { text: NAMES, repeat: 'once', wordGap: 2 } },
      root: {
        type: 'frame',
        child: {
          type: 'region',
          outline: { kind: 'circle' },
          borders: [],
          fill: { type: 'roundel', text: 'names', recipe: { tries: 2, oval: 1.45, nest: true, stack: true, bowl: { clear: 5.6 } } }, // prettier-ignore
        },
      },
    } as Composition;
    expect(isValidComposition(c)).toBe(true);
    const m = metrics(resolve(c))!;
    for (const k of ['clearance', 'apart', 'marked', 'layers', 'space']) {
      expect(m[k]).toBeGreaterThanOrEqual(0);
      expect(m[k]).toBeLessThanOrEqual(1);
    }
  }, 180_000);
});

describe('reading order of stacked pieces', () => {
  it('faults a stacked piece lifted into an earlier word, and not one that stays in its own line', async () => {
    const { orderFault } = await import('../src/script/thuluth/roundel');
    const groups = [
      { s: 'بر', word: 0, allah: false },
      { s: 'ة', word: 1, allah: false },
    ];
    const below = { x0: 0, x1: 3, y0: -6, y1: -3, base: -6 };
    expect(orderFault(groups, [{ x0: 0, x1: 10, y0: 0, y1: 4, base: 0 }, below], [0, 1])).toBe(0);
    expect(orderFault(groups, [{ x0: 0, x1: 10, y0: 0, y1: 4, base: 0 }, { ...below, y0: 1, y1: 4 }], [0, 1])).toBeGreaterThan(0); // prettier-ignore
    // not stacked: no fault
    expect(orderFault(groups, [{ x0: 0, x1: 10, y0: 0, y1: 4, base: 0 }, { ...below, y0: 1, y1: 4 }], [0, 0])).toBe(0); // prettier-ignore
  });
});

describe('a free-standing great nun', () => {
  it('starts at the head of its own bowl, away from the letter before it', () => {
    const go = (free: boolean) =>
      buildRoundel(th, spec({ bowl: { clear: 5.6, autoOval: true, free }, compose: { ...spec().compose, tries: 1 } }))!;
    const nunHead = (b: ReturnType<typeof go>) => {
      const i = b.r.groups.findIndex(g => g.s === 'ن');
      return b.r.st[i].x;
    };
    const alifX = (b: ReturnType<typeof go>) => b.r.st[b.r.groups.findIndex(g => g.s === 'ها')].x;
    // set beside the alif when joined by a lead-in; at the far side of the bowl when free
    expect(alifX(go(false)) - nunHead(go(false))).toBeLessThan(alifX(go(true)) - nunHead(go(true)) - 5);
  }, 180_000);
});

describe('clashes', () => {
  it('counts letters of different pieces touching, and the finished cartouche has none', async () => {
    const { clashes } = await import('../src/script/thuluth/roundel');
    const opts = { elongate: true, cross: true, fillTarget: 0.55, noRise: true, kern: true, oval: 1.3, tries: 1, iters: 0, nest: true, stackPull: 1.6 }; // prettier-ignore
    const r = composeRoundel(th, NAMES, opts)[0];
    // pile shamira onto burhan: they touch
    const j = r.groups.findIndex(g => g.s === 'شمير'),
      i = r.groups.findIndex(g => g.s === 'بر');
    const piled = structuredClone(r);
    piled.st[j] = { ...r.st[i] };
    expect(clashes(th, piled)).toBeGreaterThan(0);
    const b = buildRoundel(
      th,
      spec({ compose: { ...opts, tries: 6, seed: 7, stack: true }, tails: { reach: 6 }, rise: {} }),
    )!;
    expect(clashes(th, b.r)).toBe(0);
  }, 180_000);
});
