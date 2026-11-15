// Stems first, and the shahada as its showpiece (owner, 15 November 2026: the shahada's roundel by the letters-first
// rules was graded poor, "these characters don't lend themselves well to our current approach"; so were, or fair, the
// other texts that are all stems: الحمد لله, لا حول ولا قوة إلا بالله, ما شاء الله). The rules are in
// tests/helpers/char-stems.ts (S1 to S8); this file draws the arrangements that were tried for the shahada, each a
// setting of those rules and none a hand arrangement, and the rule as recommended on five other texts: the three
// above and two that were added here and not drawn until the rule was fixed (HELD).
// `SHAHADA=1 SHAHADA_OUT=<dir> npx vitest run tests/char-shahada-sheet.test.ts` writes before.png, a-... to g-....png,
// sheet.png, other-<id>.png, others.png and facts.txt (SHAHADA_ONLY=<names or ids> draws only those).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { toPNG } from '../scripts/raster.mjs';
import type { Poly } from '../src/script/thuluth/types';
import { NIB, th } from './helpers/char-first';
import { arrange } from './helpers/char-roundel';
import type { StemLaid, StemOptions } from './helpers/char-stems';
import {
  RULE,
  WHY,
  contactSVG,
  drawn,
  pageSVG,
  ribsOf,
  splits,
  stemTiers,
  stemsFirst,
  tierOf,
} from './helpers/char-stems';
import { UNSEEN } from './helpers/char-texts';

/** The whole shahada (tests/helpers/char-texts.ts has its first half under the id `shahada`: that is `shahada4`
 *  below). */
export const SHAHADA = 'لا إله إلا الله محمد رسول الله';
/** The arrangements tried, each a setting of the rules. */
export const TRIED: [name: string, what: string, o: StemOptions][] = [
  ['a-colonnade', 'one line, every stem to the rim', { tiers: [7] }],
  ['b-two-tiers', 'two tiers; the lower tier passes the upper', { tiers: [4, 3] }],
  ['c-three-tiers', 'three tiers, the name at the foot', { tiers: [4, 2, 1], opens: [0] }],
  ['d-pillar', "the name's stems through both tiers above", { tiers: [4, 2, 1], opens: [6] }],
  ['e-crossed', 'three tiers, the lam-alifs crossed', { tiers: [4, 2, 1], opens: [0], arms: 'cross' }],
  ['f-dome', 'three tiers, the stems on their meridians', { tiers: [4, 2, 1], opens: [0], curved: true }],
  ['g-rule', 'the rule: split by cost, dome, crossed', RULE],
  [
    'h-rays',
    'uprights through a point 2.5 radii below',
    { tiers: [4, 2, 1], opens: [0], vanish: -2.5, uprights: true },
  ],
  ['i-tent', 'uprights through a point 2.5 radii above', { tiers: [4, 2, 1], opens: [0], vanish: 2.5, uprights: true }],
];
/** One-point convergence beside straight and curved stems, on one layout (vanish.png). */
const T3: StemOptions = { tiers: [4, 2, 1], opens: [0] };
export const VANISH: [name: string, o: StemOptions][] = [
  ['straight', T3],
  ['meridians', { ...T3, curved: true }],
  ['V 1.5 radii below', { ...T3, vanish: -1.5, uprights: true }],
  ['V 2.5 radii below', { ...T3, vanish: -2.5, uprights: true }],
  ['V 4 radii below', { ...T3, vanish: -4, uprights: true }],
  ['V 2.5 below, tall stems only', { ...T3, vanish: -2.5 }],
  ['V 1.5 radii above', { ...T3, vanish: 1.5, uprights: true }],
  ['V 2.5 radii above', { ...T3, vanish: 2.5, uprights: true }],
];
/** Two texts of stems added here, not drawn (nor their lines looked at) until the rule was fixed. */
export const HELD: [id: string, text: string][] = [
  ['mulk', 'الملك لله'],
  ['ghalib', 'لا غالب إلا الله'],
];
const OTHERS: [id: string, text: string][] = [
  ...['hamd', 'hawla', 'mashallah'].map(id => [id, UNSEEN.find(t => t[0] === id)![1]] as [string, string]),
  ...HELD,
  ['shahada4', UNSEEN.find(t => t[0] === 'shahada')![1]],
];
const fact = (l: StemLaid | null) =>
  l
    ? `radius ${(l.R / NIB).toFixed(1)} nibs; ${l.lines.join(' / ')}; ${l.reach} of ${l.ribs} ribs reach the rim; risen x${l.factors.map(f => f.toFixed(1)).join(' x')}; ${(l.empty * 100).toFixed(0)}% of the circle empty; word spaces opened ${(l.open / NIB).toFixed(0)} nibs; cost ${l.cost.toFixed(1)}`
    : 'does not stand';

describe('stems first', () => {
  it('finds both arms of a lam-alif, and every stem of the shahada', () => {
    const t = tierOf('لا إله إلا الله');
    // لا: two arms; إله: alif, lam; إلا: alif and two arms; الله: alif, lam, lam
    expect(t.ribs.map(r => r.wi).sort()).toEqual([0, 0, 1, 1, 2, 2, 2, 3, 3, 3]);
    expect(t.ribs.filter(r => r.pair >= 0)).toHaveLength(4);
    for (const r of t.ribs) if (r.pair >= 0) expect(t.ribs[r.pair].pair).toBe(t.ribs.indexOf(r));
    // (a word with no lam-alif has no arms)
    expect(ribsOf(th.buildStrokes('محمد رسول الله', {}), 'محمد رسول الله').every(r => r.pair < 0)).toBe(true);
  });
  it('draws a risen stem as one stroke: no corner, no step in its weight, its head whole on top', () => {
    for (const text of ['لا إله إلا الله', 'الحق', 'ما شاء الله']) {
      const t = tierOf(text);
      for (const r of t.ribs)
        for (const [e, rho] of [
          [12, undefined],
          [30, undefined],
          [30, 40],
        ] as const) {
          const [st] = drawn(t, r, e, { ox: 14, oy: -12, rho }).all,
            s = st.s,
            top = r.h,
            foot = s.length - (r.s.length - r.f);
          // it stands e taller, and what is under its foot is as written
          expect(Math.max(...s.map(q => q.y)) - Math.max(...r.s.map(q => q.y))).toBeGreaterThan(e * 0.9);
          expect(s.slice(foot)).toEqual(r.s.slice(r.f));
          let bend = 0,
            step = 0,
            weight = 0;
          for (let i = top; i < foot; i++) {
            const a = s[i - 1],
              b = s[i],
              c = s[i + 1],
              d1 = Math.atan2(b.x - a.x, a.y - b.y),
              d2 = Math.atan2(c.x - b.x, b.y - c.y);
            expect(c.y).toBeLessThan(b.y);
            bend = Math.max(bend, Math.abs(d2 - d1));
            step = Math.max(step, Math.hypot(c.x - b.x, c.y - b.y));
            weight = Math.max(weight, Math.abs(c.w - b.w));
          }
          // no corner (under 6 degrees from one sample to the next), samples close, the weight changing evenly
          expect(bend).toBeLessThan(0.1);
          expect(step).toBeLessThan(0.75);
          expect(weight).toBeLessThan(0.06);
        }
    }
  });
  it('splits a text into at most three tiers, in order', () => {
    expect(splits(1)).toEqual([[1]]);
    expect(splits(3)).toEqual([[1, 1, 1], [1, 2], [2, 1], [3]]);
    expect(splits(7)).toHaveLength(22);
    expect(splits(7).every(s => s.reduce((a, v) => a + v, 0) === 7)).toBe(true);
  });
  it('lays a text out the same every time, inside the circle', () => {
    const sig = (l: StemLaid | null) =>
        JSON.stringify(l?.polys.map(q => q.map(([x, y]) => [x.toFixed(4), y.toFixed(4)]))),
      a = stemTiers('الحمد لله', { tiers: [2], curved: true }),
      b = stemTiers('الحمد لله', { tiers: [2], curved: true });
    expect(a).not.toBeNull();
    expect(sig(a)).toBe(sig(b));
    expect(Math.max(...a!.polys.flat().map(([x, y]) => Math.hypot(x, y)))).toBeLessThan(a!.R - 0.9 * NIB + 0.1);
    expect(a!.reach).toBeGreaterThan(0);
  });
  it.runIf(!!process.env.SHAHADA)(
    'writes the sheets',
    () => {
      const out = process.env.SHAHADA_OUT ?? join(import.meta.dirname, '../docs/shahada'),
        only = process.env.SHAHADA_ONLY?.split(','),
        on = (name: string) => !only || only.includes(name),
        facts: string[] = [],
        page = (name: string, l: { R: number; polys: Poly[] } | null) => {
          if (l) writeFileSync(join(out, `${name}.png`), toPNG(pageSVG(l), 900));
        },
        timed = <T>(f: () => T): [T, string] => {
          const t0 = Date.now(),
            v = f();
          return [v, `${((Date.now() - t0) / 1000).toFixed(0)} s`];
        };
      mkdirSync(out, { recursive: true });
      const items: { l: { R: number; polys: Poly[] } | null; cap: string[] }[] = [];
      if (on('before')) {
        const before = arrange(SHAHADA, []);
        page('before', before);
        items.push({ l: before, cap: ['before', 'the letters-first rules as they stand'] });
      }
      for (const [name, what, o] of TRIED) {
        if (!on(name)) continue;
        const said: string[] = [];
        WHY.clear();
        const [l, took] = timed(() => stemsFirst(SHAHADA, o, said));
        said.push(`not standing: ${[...WHY].map(([k, v]) => `${k} (${v})`).join('; ') || 'none'}`);
        page(name, l);
        facts.push(`${name} (${what}; ${took})\n    ${fact(l)}${said.map(v => `\n      ${v}`).join('')}`);
        items.push({ l, cap: [name, what, l ? `${l.reach} of ${l.ribs} stems reach the rim; ${(l.empty * 100).toFixed(0)}% empty` : 'does not stand'] }); // prettier-ignore
      }
      if (items.length) writeFileSync(join(out, 'sheet.png'), toPNG(contactSVG(items, 4, 480), 1920));
      if (on('vanish')) {
        const vs = VANISH.map(([name, o]) => {
          const l = stemsFirst(SHAHADA, o);
          facts.push(`vanish, ${name}\n    ${fact(l)}`);
          return { l, cap: [name, l ? `${l.reach} of ${l.ribs} stems reach the rim; ${(l.empty * 100).toFixed(0)}% empty` : 'does not stand'] }; // prettier-ignore
        });
        writeFileSync(join(out, 'vanish.png'), toPNG(contactSVG(vs, 4, 480), 1920));
      }
      const others: typeof items = [];
      for (const [id, text] of OTHERS) {
        if (!on(id)) continue;
        const said: string[] = [],
          [l, took] = timed(() => stemsFirst(text, RULE, said)),
          before = arrange(text, []);
        page(`other-${id}`, l);
        page(`other-${id}-before`, before);
        facts.push(`${id}: ${text} (${took})\n    ${fact(l)}${said.map(v => `\n      ${v}`).join('')}`);
        others.push({ l: before, cap: [`${id}: before`, text] });
        others.push({ l, cap: [`${id}: stems first`, l ? `${l.reach} of ${l.ribs} stems reach the rim; ${(l.empty * 100).toFixed(0)}% empty` : 'does not stand'] }); // prettier-ignore
      }
      if (others.length) writeFileSync(join(out, 'others.png'), toPNG(contactSVG(others, 4, 480), 1920));
      writeFileSync(join(out, `facts${only ? `-${only.join('-')}` : ''}.txt`), facts.join('\n') + '\n');
      expect(facts.length).toBeGreaterThan(0);
    },
    7_200_000,
  );
});
