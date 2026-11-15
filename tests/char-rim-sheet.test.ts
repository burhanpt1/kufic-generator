// Fill from the bottom (owner, 15 November 2026, on short texts graded poor or fair for empty space: "start at the
// lower rim and fill upward"). The rules are in tests/helpers/char-rim.ts (R1 to R9); this file draws the variants
// that were explored, the three stem geometries, and the rule beside the letters-first rules as they stand
// (tests/helpers/char-roundel.ts `arrange`) on three sets of texts: DESIGN (the six the rule was made on), HELD (ten
// from tests/helpers/char-texts.ts and four added here, none drawn by this composer until the rule was committed)
// and the long text `ikhlas`, once, for comparison only.
// `RIM=1 RIM_OUT=<dir> npx vitest run tests/char-rim-sheet.test.ts` writes variants.png, stems.png, pairs.png,
// pairs-<set>.png, after/<id>.png, ikhlas-compare.png and facts.txt; RIM_PARTS=variants,stems,pairs,ikhlas chooses
// which, RIM_SET=design,held which texts the pairs are drawn for.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { toPNG } from '../scripts/raster.mjs';
import type { Poly } from '../src/script/thuluth/types';
import { CLEAR, MARGIN, NIB, cradleCompose, nearPairs, svgOf } from './helpers/char-first';
import type { RimLaid, RimOptions } from './helpers/char-rim';
import { piecesOf, rim } from './helpers/char-rim';
import { arrange, labelled } from './helpers/char-roundel';
import { emptyShare } from './helpers/char-stems';
import { FRESH, FRESH2, TUNED, UNSEEN } from './helpers/char-texts';

const KNOWN: [string, string][] = [...TUNED, ...UNSEEN.map(t => [t[0], t[1]] as [string, string]), ...FRESH.map(t => [t[0], t[1]] as [string, string]), ...FRESH2]; // prettier-ignore
const textOf = (id: string) => KNOWN.find(t => t[0] === id)![1];
/** The six the rule was made on. */
export const DESIGN = ['mashallah', 'hamd', 'nur', 'rabbi', 'ard', 'tawhid'];
/** Four short texts added here, not drawn until the rule was committed. */
export const ADDED: [id: string, text: string][] = [
  ['salam1', 'سلام'],
  ['sabrjamil', 'صبر جميل'],
  ['huwa', 'هو الحي'],
  ['yarahman', 'يا رحمن يا رحيم'],
];
/** The held-out set. */
export const HELD = ['maryam', 'yusuf', 'khadija', 'alim', 'haqq', 'nasr', 'shukr', 'akbar', 'ilm', 'tawba'];
const held: [string, string][] = [...HELD.map(id => [id, textOf(id)] as [string, string]), ...ADDED];

/** The variants explored (variants.png), each a setting of the rules. */
export const VARIANTS: [name: string, o: RimOptions][] = [
  ['A. level tiers, no base', { base: 'none', pieces: false }],
  ['B. bowl or tail on the rim', { base: 'letter', pieces: false }],
  ['C. boat: bottom tier on the rim', { base: 'boat', must: true, pieces: false }],
  ['D. boat, tiers curving less', { base: 'boat', must: true, curve: 'less', pieces: false }],
  ['E. first words on top', { order: 'down', pieces: false }],
  ['F. the rule', {}],
];
/** The three stem geometries, each text on one layout (stems.png). نور has no stem: في الأرض stands in for it. */
export const STEMS: [id: string, tiers: number[]][] = [
  ['mashallah', [2, 1]],
  ['hamd', [1, 1]],
  ['ard', [2]],
];

type Drawn = { R: number; polys: Poly[] };
const nibs = (v: number) => (v / NIB).toFixed(1),
  pct = (v: number) => `${(v * 100).toFixed(0)}%`,
  inside = (l: Drawn) => Math.max(...l.polys.flat().map(([x, y]) => Math.hypot(x, y))) <= l.R - MARGIN + 0.02;
/** The units of a layout keep their clearance, and its base stroke keeps it from every unit but its own. */
function clear(l: RimLaid): boolean {
  const n = l.baseUnit < 0 ? l.inks.length : l.inks.length - 1;
  return nearPairs(l.inks, l.R, 0.8 * CLEAR).every(([a, b]) => a >= n || b >= n ? Math.min(a, b) === l.baseUnit : false); // prettier-ignore
}
const cap = (l: RimLaid | null) =>
  l ? [`radius ${nibs(l.R)} nibs, ${pct(l.empty)} empty`, `${l.lines.join(' / ')}; base: ${l.base}`] : ['does not stand', '']; // prettier-ignore

describe('fill from the bottom', () => {
  it('splits a word into its pieces', () => {
    expect(piecesOf('نور')).toEqual(['نو', 'ر']);
    expect(piecesOf('توحيد')).toEqual(['تو', 'حيد']);
    expect(piecesOf('حسين')).toEqual(['حسين']);
  });
  it('draws a short word inside the margin, its units clear of each other, the same each time', () => {
    const a = rim('نور', { pieces: true }),
      b = rim('نور', { pieces: true });
    expect(a).not.toBeNull();
    expect(inside(a!)).toBe(true);
    expect(clear(a!)).toBe(true);
    expect(JSON.stringify(b!.polys)).toBe(JSON.stringify(a!.polys));
    expect(a!.lines).toEqual(['ر', 'نو']);
  });
  it.runIf(!!process.env.RIM)(
    'writes the sheets',
    () => {
      const out = process.env.RIM_OUT ?? join(import.meta.dirname, '../docs/rim'),
        parts = process.env.RIM_PARTS?.split(',') ?? ['variants', 'stems', 'pairs', 'ikhlas'],
        sets = process.env.RIM_SET?.split(',') ?? ['design', 'held'],
        facts: string[] = [],
        sheet = (name: string, rows: (Drawn | null)[][], caps: string[][][], cell = 440) =>
          writeFileSync(join(out, `${name}.png`), toPNG(labelled(rows, caps, cell), Math.max(...rows.map(r => r.length)) * cell)); // prettier-ignore
      mkdirSync(join(out, 'after'), { recursive: true });
      const tell = (what: string, l: RimLaid | null, said: string[]) => {
        facts.push(`${what}: ${l ? `radius ${nibs(l.R)} nibs, ${pct(l.empty)} empty, ${l.reach} of ${l.ribs} stems reach; ${l.lines.join(' / ')}; base: ${l.base}; inside ${inside(l) ? 'yes' : 'NO'}; clear ${clear(l) ? 'yes' : 'NO'}` : 'does not stand'}`, ...said.map(s => `      ${s}`)); // prettier-ignore
        if (l) {
          expect(inside(l)).toBe(true);
          expect(clear(l)).toBe(true);
        }
      };
      if (parts.includes('variants')) {
        const rows: (Drawn | null)[][] = [],
          caps: string[][][] = [];
        for (const id of ['mashallah', 'hamd', 'nur']) {
          const ls = VARIANTS.map(([name, o]) => {
            const said: string[] = [],
              l = rim(textOf(id), o, said);
            tell(`variant ${name} on ${id}`, l, said);
            return l;
          });
          rows.push(ls);
          caps.push(ls.map((l, i) => [`${id}: ${VARIANTS[i][0]}`, ...cap(l)]));
        }
        sheet('variants', rows, caps, 440);
      }
      if (parts.includes('stems')) {
        const kinds = ['straight', 'meridian', 'fan'] as const,
          rows: (Drawn | null)[][] = [],
          caps: string[][][] = [];
        for (const [id, tiers] of STEMS) {
          const ls = kinds.map(stems => {
            const l = rim(textOf(id), { stems, tiers });
            tell(`stems ${stems} on ${id}`, l, []);
            return l;
          });
          rows.push(ls);
          caps.push(ls.map((l, i) => [`${id}: ${kinds[i]}${i === 2 ? ' (from 3 radii below)' : ''}`, ...(l ? [`radius ${nibs(l.R)} nibs, ${pct(l.empty)} empty`, `${l.reach} of ${l.ribs} stems reach the rim`] : ['does not stand'])])); // prettier-ignore
        }
        sheet('stems', rows, caps);
      }
      const pair = (id: string, text: string, mark: string, o: RimOptions = {}) => {
        const now: Drawn | null =
          (() => {
            try {
              return arrange(text, []);
            } catch {
              return null;
            }
          })() ?? cradleCompose(text, { cradle: false });
        const said: string[] = [],
          t0 = Date.now(),
          l = rim(text, o, said);
        tell(`${id}${mark} ${text} (${((Date.now() - t0) / 1000).toFixed(0)} s)`, l, said);
        if (now)
          facts.push(`      as it stands: radius ${nibs(now.R)} nibs, ${pct(emptyShare(now.polys, now.R))} empty`);
        if (l) writeFileSync(join(out, 'after', `${id}.png`), toPNG(svgOf(l), 900));
        return {
          row: [now, l],
          caps: [
            [`${id}${mark}: ${text}`, 'as it stands (letters-first rules)', now ? `radius ${nibs(now.R)} nibs, ${pct(emptyShare(now.polys, now.R))} empty` : 'none'], // prettier-ignore
            [`${id}${mark}: from the bottom`, ...cap(l)],
          ],
        };
      };
      if (parts.includes('pairs')) {
        const all = [
            ...(sets.includes('design') ? DESIGN.map(id => [id, textOf(id), ''] as const) : []),
            ...(sets.includes('held') ? held.map(([id, t]) => [id, t, ' [held out]'] as const) : []),
          ],
          got = all.map(([id, t, mark]) => pair(id, t, mark)),
          rows: (Drawn | null)[][] = [],
          caps: string[][][] = [];
        // two texts to a row: as it stands, from the bottom, as it stands, from the bottom
        for (let i = 0; i < got.length; i += 2) {
          rows.push([...got[i].row, ...(got[i + 1]?.row ?? [])]);
          caps.push([...got[i].caps, ...(got[i + 1]?.caps ?? [])]);
        }
        sheet(sets.length === 2 ? 'pairs' : `pairs-${sets.join('-')}`, rows, caps, 420);
      }
      if (parts.includes('ikhlas')) {
        // (every split of fifteen words takes hours: RIM_IKHLAS=5,5,5 gives the tiers, from the bottom up)
        const tiers = process.env.RIM_IKHLAS?.split(',').map(Number),
          p = pair('ikhlas', textOf('ikhlas'), ' [comparison only]', tiers ? { tiers } : {});
        sheet('ikhlas-compare', [p.row], [p.caps], 700);
      }
      writeFileSync(join(out, `facts-${parts.join('-')}-${sets.join('-')}.txt`), facts.join('\n') + '\n');
    },
    7_200_000,
  );
});
