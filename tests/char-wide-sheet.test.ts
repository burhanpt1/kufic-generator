// Do the letters-first rules generalise? (owner, 15 November 2026: "use different words, make sure we're not fine
// tuning on a few examples"). Every rule so far was built on four texts (TUNED); here the rules are run on those and on
// eighteen more (UNSEEN, tests/helpers/char-texts.ts), as they stood (`before`: tests/helpers/char-roundel.ts `plain`
// and `nested`, unchanged) and as widened (`after`: `arrange`, whose rules are numbered in that file). Six of the
// unseen texts were set aside by a fixed seed before any rule was changed, and the rules were widened on the other
// twelve: the six are the honest measure.
// `WIDE=1 WIDE_OUT=<dir> npx vitest run tests/char-wide-sheet.test.ts --maxWorkers=2` writes, for each stage
// (WIDE_STAGE=before,after), `<stage>/<id>.png`, `wide-<stage>.png` (all the texts, captioned), smaller sheets by set
// (`<stage>-tuned`, `-fit-N`, `-held-N`) and `wide-<stage>-facts.txt`; WIDE_ONLY=<ids>, WIDE_SET=tuned,fit,held.
// Round two: WIDE_SET also takes ffit and fheld (the third set of texts, split below), round three f2fit and f2held; WIDE_STRAIGHT=1 draws risen
// stems straight, WIDE_NONEST=1 leaves out the nested bowls, WIDE_NOROOF=1 the roofs drawn out, WIDE_NODOTS=1 the
// entries into dotted teeth (to compare a rule on and off with the layout held).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { toPNG } from '../scripts/raster.mjs';
import { thuluth } from '../src/script/thuluth';
import { MARGIN, NIB, cradleCompose, svgOf, th } from './helpers/char-first';
import type { Canopied } from './helpers/char-roundel';
import { arrange, carriers, cradleWide, labelled, modesWide, nested, plain } from './helpers/char-roundel';
import { ALL_TEXTS, FRESH, FRESH2, TUNED, UNSEEN } from './helpers/char-texts';

// ---- the six set aside (before any rule was changed) ----
const HELD_SEED = 20261115,
  HELD = 6;
/** `n` of some ids, by a seeded shuffle (mulberry32, Fisher-Yates). */
function pick(all: readonly string[], n: number, seed: number): string[] {
  let a = seed;
  const rnd = () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    ids = all.slice();
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids.slice(0, n).sort();
}
/** Six of the unseen texts, set aside in the first round. */
export const heldOut = () => pick(UNSEEN.map(([id]) => id), HELD, HELD_SEED); // prettier-ignore
// ---- round two: the third set (FRESH), drawn once by the rules as they stood (`fresh-before`), then split by a
// fixed seed into seven the rules may be fitted on (`ffit`) and seven not looked at again until the end (`fheld`) ----
const FRESH_SEED = 20261116;
export const freshHeld = () => pick(FRESH.map(([id]) => id), 7, FRESH_SEED); // prettier-ignore
// ---- round three: the fourth set (FRESH2), drawn once by the rules as they stood (`fresh2-before`), then split by
// a fixed seed into seven to fit on (`f2fit`) and seven not looked at again until the end (`f2held`) ----
const FRESH2_SEED = 20261117;
export const fresh2Held = () => pick(FRESH2.map(([id]) => id), 7, FRESH2_SEED); // prettier-ignore
const EVERY: [string, string][] = [...ALL_TEXTS, ...FRESH.map(([id, t]) => [id, t] as [string, string]), ...FRESH2];
const setOf = (id: string) =>
  TUNED.some(t => t[0] === id)
    ? 'tuned'
    : FRESH2.some(t => t[0] === id)
      ? fresh2Held().includes(id)
        ? 'f2held'
        : 'f2fit'
      : FRESH.some(t => t[0] === id)
        ? freshHeld().includes(id)
          ? 'fheld'
          : 'ffit'
        : heldOut().includes(id)
          ? 'held'
          : 'fit';

type Drawn = { R: number; polys: [number, number][][] };
interface Result {
  id: string;
  text: string;
  /** What is drawn (a fallback to level lines when the rules gave nothing), and whether the rules gave it. */
  drawn: Drawn | null;
  arranged: boolean;
  facts: string[];
  cap: string[];
}
const nibs = (v: number) => (v / NIB).toFixed(1);
/** Whether all the ink keeps the margin from the circle. */
const inside = (l: Drawn) => Math.max(...l.polys.flat().map(([x, y]) => Math.hypot(x, y))) <= l.R - MARGIN + 0.02;
function describeIt(l: Canopied, said: string[]): { facts: string[]; cap: string[] } {
  const f = l.factors.slice().sort((p, q) => p - q),
    names = ['canopy', 'sub-canopy', 'cradle', 'sub-cradle'] as const,
    arcs = names.map(n => `${n}: ${l.arcs.filter(a => a.name === n).map(a => `${a.what} (${Math.abs(a.from - a.to).toFixed(0)} degrees: ${a.from.toFixed(0)} to ${a.to.toFixed(0)})`).join(' + ') || 'none'}`); // prettier-ignore
  return {
    facts: [
      `radius ${nibs(l.R)} nibs; lines: ${l.lines.join(' / ')}`,
      ...arcs,
      `stems ${l.stems}, risen ${f.length}${f.length ? `: x${f.map(v => v.toFixed(2)).join(' x')}` : ''}; ${l.note}`,
      `clearances: every piece measured clear by the composer; all ink inside the margin: ${inside(l) ? 'yes' : 'NO'}`,
      ...said,
    ],
    cap: [`radius ${nibs(l.R)} nibs; stems risen ${f.length} of ${l.stems}`, l.arcs.map(a => a.name).join(', ') || 'no arc'], // prettier-ignore
  };
}
function run(id: string, text: string, stage: string): Result {
  const said: string[] = [];
  let l: Canopied | null = null;
  try {
    if (stage === 'before') {
      const base = plain(text);
      l = base && nested(text, base, said);
    } else l = arrange(text, said);
  } catch (e) {
    said.push(`threw: ${(e as Error).message}`);
  }
  if (l) return { id, text, drawn: l, arranged: true, ...describeIt(l, said) };
  const level = cradleCompose(text, { cradle: false });
  return {
    id,
    text,
    drawn: level,
    arranged: false,
    facts: [
      `NO ARRANGEMENT; drawn on level lines${level ? `, radius ${nibs(level.R)} nibs` : ': none either'}`,
      ...said,
    ],
    cap: ['no arrangement: level lines', ''],
  };
}

describe('the rules on the wider set of texts', () => {
  it('sets six unseen texts aside by a fixed seed', () => {
    const held = heldOut();
    expect(held).toHaveLength(6);
    expect(heldOut()).toEqual(held);
    expect(held.every(id => UNSEEN.some(t => t[0] === id))).toBe(true);
    expect(freshHeld()).toHaveLength(7);
    expect(freshHeld().every(id => FRESH.some(t => t[0] === id))).toBe(true);
    expect(fresh2Held()).toHaveLength(7);
    expect(fresh2Held().every(id => FRESH2.some(t => t[0] === id))).toBe(true);
  });
  it('names the letters that carry the arcs of every text, without drawing', () => {
    const all = ALL_TEXTS.map(([id, t]) => `${id}: ${carriers(t)}`);
    expect(all).toHaveLength(22);
    expect(all.every(v => /canopy: .+; cradle: .+; sub-cradle: .+/.test(v))).toBe(true);
    // the tuned texts keep their letters; the basmala's canopy is the arc led into the ba (owner, 15 November)
    expect(all.slice(0, 4)).toEqual([
      'names: canopy: an entry into the م of محمد; cradle: the ي of علي; sub-cradle: none',
      'basmala: canopy: an entry into the ب of بسم; cradle: the ن of الرحمن; sub-cradle: the م of الرحيم',
      'salawat: canopy: a stem of اللهم; cradle: the ى of على; sub-cradle: the ل of وآل',
      'ikhlas: canopy: a stem of قل; cradle: the ن of يكن; sub-cradle: the د of أحد',
    ]);
  });
  it('forces no arc: no word is drawn out, no entry into a tail, no tail returns', () => {
    for (const [, t] of ALL_TEXTS) expect(modesWide(t.split(' ')[0])).not.toContain('kashida');
    // a ra, a zay and a waw take no entry; a word with a stem cannot hang from the rim
    expect(modesWide('رب')).toEqual([null]);
    expect(modesWide('زينب')).toEqual([null]);
    expect(modesWide('وما')).toEqual(['stem', null]);
    expect(modesWide('سبحان')).toEqual(['entry', 'stem', null]);
    expect(modesWide('بسم')).toEqual(['entry', null]);
    // (not a nun, a ta or a tha: the arc hides the tooth, and its dots stay where they are written)
    expect(modesWide('نور')).toEqual([null]);
    expect(modesWide('ثابت')).toEqual(['stem', null]);
    // (a roof is written to the left: it takes no entry from the right, and is drawn out to the left)
    expect(modesWide('حسين')).toEqual(['roof', null]);
    expect(modesWide('عليم')).toEqual(['roof', 'stem', null]);
    // a tail runs forth from the last word, and only where there is no bowl
    expect(cradleWide('نور')).toMatchObject({ cr: { wi: 0, c: 'ر' }, forth: true });
    expect(cradleWide('نور على نور')).toMatchObject({ cr: { wi: 1, c: 'ى' } });
    expect(cradleWide('نور على نور').forth).toBeUndefined();
    // a bowl that returns of itself is a cradle; no bowl and no tail: none
    expect(cradleWide('الصبر مفتاح الفرج')).toMatchObject({ cr: { wi: 2, c: 'ج' } });
    expect(cradleWide('الحمد لله').cr).toBeNull();
    expect(cradleWide('لا إله إلا الله').cr).toBeNull();
  });
  it('writes a line the same whatever was written before it', () => {
    const sig = (t: string) => JSON.stringify(th.buildStrokes(t, {}).strokes.map(k => k.s.map(q => [q.x, q.y]))),
      alone = JSON.stringify(thuluth(th.style).buildStrokes('على محمد', {}).strokes.map(k => k.s.map(q => [q.x, q.y]))); // prettier-ignore
    for (const [, t] of ALL_TEXTS) sig(t);
    expect(sig('على محمد')).toBe(alone);
  });
  it.runIf(!!process.env.WIDE)(
    'writes the sheets',
    () => {
      const out = process.env.WIDE_OUT ?? join(import.meta.dirname, '../docs/wide');
      const only = process.env.WIDE_ONLY?.split(','),
        sets = process.env.WIDE_SET?.split(',') ?? ['tuned', 'fit', 'held'],
        texts = EVERY.filter(([id]) => (!only || only.includes(id)) && sets.includes(setOf(id)));
      for (const stage of process.env.WIDE_STAGE?.split(',') ?? ['after']) {
        mkdirSync(join(out, stage), { recursive: true });
        const res = texts.map(([id, t]) => {
          const t0 = Date.now(),
            r = run(id, t, stage);
          r.facts.push(`(${((Date.now() - t0) / 1000).toFixed(0)} s)`);
          if (r.drawn) writeFileSync(join(out, stage, `${id}.png`), toPNG(svgOf(r.drawn), 900));
          return r;
        });
        const sheet = (name: string, rs: Result[], per: number, cell: number) => {
          const rows: (Drawn | null)[][] = [],
            caps: string[][][] = [];
          rs.forEach((r, i) => {
            if (i % per === 0) {
              rows.push([]);
              caps.push([]);
            }
            rows[rows.length - 1].push(r.drawn);
            caps[caps.length - 1].push([`${r.id}: ${r.text}`, ...r.cap]);
          });
          if (rs.length) writeFileSync(join(out, `${name}.png`), toPNG(labelled(rows, caps, cell), Math.min(rs.length, per) * cell)); // prettier-ignore
        };
        const tag = only || sets.join() !== 'tuned,fit,held' ? `-${(only ?? sets).join('-')}` : '';
        sheet(`wide-${stage}${tag}`, res, 6, 480);
        for (const set of sets) {
          const rs = res.filter(r => setOf(r.id) === set);
          const per = set === 'tuned' ? 4 : 3;
          for (let i = 0; i < rs.length; i += per)
            sheet(`${stage}-${set}${set === 'tuned' ? '' : `-${i / per + 1}`}`, rs.slice(i, i + per), 4, 480);
        }
        writeFileSync(join(out, `wide-${stage}-facts${tag}.txt`), res.map(r => `${r.id} [${setOf(r.id)}] ${r.text}\n${r.facts.map(f => `    ${f}`).join('\n')}`).join('\n') + '\n'); // prettier-ignore
        expect(res.length).toBe(texts.length);
      }
    },
    3_600_000,
  );
});
