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
// stems straight, WIDE_NONEST=1 leaves out the nested bowls, WIDE_NOROOF=1 the roofs drawn out (round two also had
// WIDE_NODOTS; entries into dotted teeth are now off unless WIDE_RIDE=1).
// Round three: WIDE_SET also takes f2fit and f2held (the fourth set); a rule is switched off, the rest held, by
// WIDE_NOTIERS=1 (level lines at one pitch), WIDE_NOSTACK=1, WIDE_NORISE=1 (lower lines' stems), WIDE_HEAVY=1 (arcs
// at full weight on small circles), WIDE_SINGLE=99 (a single word's arc at any size), WIDE_NOSLIDE=1, WIDE_HOLLOW=0.4,
// WIDE_RIDE=1 (entries into dotted teeth, dots riding the arc), WIDE_DOTSGO=1 (a dot goes with its redrawn bowl),
// WIDE_NOMEND=1 (dots left touching strokes).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { toPNG } from '../scripts/raster.mjs';
import { thuluth } from '../src/script/thuluth';
import type { Sample } from '../src/script/thuluth/types';
import { EVEN_OVER, MARGIN, NIB, bowlLast, bowlPen, cradleCompose, findStems, fine, lighter, meridians, raise, stemFoot, svgOf, sweep, takeOver, th } from './helpers/char-first'; // prettier-ignore
import type { Canopied } from './helpers/char-roundel';
import { arrange, canopyArc, carriers, cradleWide, labelled, modesWide, nested, openHeads, plain } from './helpers/char-roundel'; // prettier-ignore
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

// ---- the strokes (round four: the owner's notes on round two's drawings that no arrangement can mend) ----
// An arrangement is found with the strokes as they were and then drawn with the mended ones (char-first.ts STROKES,
// `fine`), so no layout moves with the pen: these are the mended strokes.
const DEGREE = Math.PI / 180;
/** How thick the pen draws at each sample of a stroke (nibs): the nib's width across the way the stroke is going. */
function thickness(ang: number, s: readonly Sample[]): number[] {
  return s.map((q, i) => {
    const a = s[Math.max(0, i - 1)],
      b = s[Math.min(s.length - 1, i + 1)];
    return q.w * Math.abs(Math.sin(ang * DEGREE + (q.rot ?? 0) - Math.atan2(b.y - a.y, b.x - a.x)));
  });
}
/** The sharpest turn from one sample to the next (radians) and the largest step in a list of numbers. */
const turnOf = (s: readonly Sample[]) => {
  let most = 0;
  for (let i = 1; i + 1 < s.length; i++) {
    const d =
      Math.atan2(s[i + 1].y - s[i].y, s[i + 1].x - s[i].x) - Math.atan2(s[i].y - s[i - 1].y, s[i].x - s[i - 1].x);
    most = Math.max(most, Math.abs(d - 2 * Math.PI * Math.round(d / (2 * Math.PI))));
  }
  return most;
};
const stepOf = (v: readonly number[]) => Math.max(...v.slice(1).map((x, i) => Math.abs(x - v[i])));

describe('the strokes', () => {
  it('draws a risen stem as one stroke: no corner, no step in its weight, its head whole on top', () => {
    let spread = 0;
    for (const text of ['الحق', 'لا إله إلا الله', 'ما شاء الله', 'فاطمة', 'وآل']) {
      const b = th.buildStrokes(text, {}),
        stems = findStems(b, text);
      expect(stems.length).toBeGreaterThan(0);
      for (const [k, m] of stems.entries())
        for (const [times, rho] of [
          [0.5, 0],
          [2, 0],
          [2, 40],
        ] as const) {
          const e = times * m.top,
            was = b.strokes[m.si].s,
            f = fine(() => stemFoot(was, m.cut, m.base)),
            extra = stems.map((_, j) => (j === k ? e : 0)),
            // (straight, and on its meridian in a circle of radius rho, its line 14 to the right of the axis)
            now = fine(() => rho ? meridians(b, stems, extra, stems.map((_, j) => (j === k ? { ox: 14, oy: -12, rho, k: 1 } : null))).strokes[m.si].s : raise(b, stems, extra)[m.si].s), // prettier-ignore
            foot = now.length - (was.length - f),
            shaft = now.slice(m.cut, foot + 1);
          // it stands e taller; its head is moved whole (straight) and what is under its foot is as written
          expect(Math.max(...now.map(q => q.y)) - Math.max(...was.map(q => q.y))).toBeGreaterThan(e * 0.9);
          expect(now.slice(foot)).toEqual(was.slice(f));
          if (!rho)
            was.slice(0, m.cut + 1).forEach((q, i) => {
              expect(now[i].x).toBeCloseTo(q.x + m.lean * e, 9);
              expect(now[i].y).toBeCloseTo(q.y + e, 9);
              expect(now[i].w).toBe(q.w);
            });
          // between them: always downward, no corner (under 6 degrees from one sample to the next), samples close,
          // the weight changing evenly, and no heavier or lighter than the written stem is between split and foot
          for (let i = 1; i < shaft.length; i++) expect(shaft[i].y).toBeLessThan(shaft[i - 1].y);
          expect(turnOf(shaft)).toBeLessThan(0.1);
          expect(Math.max(...shaft.slice(1).map((q, i) => Math.hypot(q.x - shaft[i].x, q.y - shaft[i].y)))).toBeLessThan(0.85); // prettier-ignore
          expect(stepOf(shaft.map(q => q.w))).toBeLessThan(0.06);
          const ws = was.slice(m.cut, f + 1).map(q => q.w);
          for (const q of shaft) expect(q.w).toBeGreaterThanOrEqual(Math.min(...ws) - 1e-9);
          for (const q of shaft) expect(q.w).toBeLessThanOrEqual(Math.max(...ws) + 1e-9);
          // (an alif tapers to its foot: its taper is spread over the whole risen stem, not left at the foot under
          // a rod of one weight, which is how the layout's stroke has it)
          if (was[m.cut].w - was[f].w > 0.2) {
            const half = shaft[shaft.length >> 1],
              rod = raise(b, stems, extra)[m.si].s;
            spread = Math.max(spread, was[m.cut].w - half.w);
            expect(half.w).toBeLessThan(was[m.cut].w - 0.2 * (was[m.cut].w - was[f].w));
            if (!rho) expect(rod[m.cut + (rod.length - was.length) / 2].w).toBeGreaterThan(0.97);
          }
        }
    }
    expect(spread).toBeGreaterThan(0.08);
  });
  it('turns a stem into its arc as one stroke: no corner, no step, no swelling and no waist at the shoulder', () => {
    for (const [text, rho] of [
      ['الحق', 26],
      ['فاطمة', 16],
      ['اللهم', 12],
    ] as const) {
      const b = th.buildStrokes(text, {}),
        stems = findStems(b, text),
        m = stems[0],
        st = b.strokes[m.si],
        e = 0.6 * m.top,
        risen = fine(() => raise(b, stems, stems.map((_, j) => (j ? 0 : e)))[m.si].s), // prettier-ignore
        C = risen[m.cut],
        // the stem stands 0.4 of the radius to the right of the axis, its split 4 inside the arc's circle
        dx = 0.4 * rho - C.x,
        dy = Math.sqrt((rho - 4) ** 2 - (0.4 * rho) ** 2) - C.y,
        n = Math.hypot(m.lean, 1),
        arc = canopyArc([C.x + dx, C.y + dy], [m.lean / n, 1 / n], C.w, st.ang, rho)!,
        one = [...arc.fine, ...risen.slice(m.cut).map(q => ({ ...q, x: q.x + dx, y: q.y + dy }))],
        t = thickness(st.ang, one),
        join = arc.fine.length,
        // (the way up to the rim: from where the arc leaves its circle to the stem's split)
        up =
          arc.fine.length -
          arc.fine
            .slice()
            .reverse()
            .findIndex(q => Math.hypot(q.x, q.y) > rho - 0.01),
        onRim = t[up - 1];
      expect(arc.fine.length).toBeGreaterThan(40);
      // one stroke through the turn: its direction and its weight both pass without a break, from the stem's foot
      // side of the split to well onto the rim
      expect(turnOf(one.slice(up - 20, join + 20))).toBeLessThan(0.1);
      expect(stepOf(t.slice(up - 20, join + 20))).toBeLessThan(0.03);
      expect(Math.abs(t[join - 1] - t[join])).toBeLessThan(0.03);
      // and on the way it is never heavier or lighter than its two ends (by more than a twentieth of the nib)
      for (const v of t.slice(up, join)) {
        expect(v).toBeGreaterThan(Math.min(onRim, t[join]) - 0.05);
        expect(v).toBeLessThan(Math.max(onRim, t[join]) + 0.05);
      }
      // the layout's stroke (the pen turned with the rim) holds it: the same path, nowhere lighter but by EVEN_OVER
      expect(arc.s.map(q => [q.x, q.y])).toEqual(arc.fine.map(q => [q.x, q.y]));
      const was = thickness(st.ang, arc.s);
      thickness(st.ang, arc.fine).forEach((v, i) => expect(v).toBeLessThanOrEqual(was[i] + EVEN_OVER + 1e-9));
    }
  });
  it('draws the great arcs with the fixed pen: they thin and swell, and are never heavier than the layout drew them', () => {
    // a bowl taken over at the left of a circle of 30, heading down, run to far up the right side
    const head = {
        pre: [],
        ang: th.style.ang,
        C: [0, 0] as [number, number],
        u: [-0.2, -0.98] as [number, number],
        dots: 0,
      },
      sw = sweep([20, -8], [0.2, -0.98], 1, 30, () => -1.4)!,
      pen = bowlPen(head, sw.s, false),
      turned = bowlPen(head, sw.s),
      t = thickness(th.style.ang, pen),
      was = thickness(th.style.ang, turned),
      // (the clock: degrees clockwise from the top)
      clock = pen.map(q => (Math.atan2(q.x, q.y) / DEGREE + 360) % 360),
      at = (deg: number) => t[clock.findIndex(c => Math.abs(c - deg) < 0.5)];
    // the nib is not turned at all: the line's pen from end to end
    for (const q of pen) expect(q.rot).toBeCloseTo(0, 9);
    for (const q of turned.slice(-200, -100)) expect(Math.abs(q.rot!)).toBeGreaterThan(0.3);
    t.forEach((v, i) => expect(v).toBeLessThanOrEqual(was[i] + 1e-9));
    // heavy along the bottom, the hairline towards 3:40 (110 degrees), evenly between
    expect(at(180)).toBeGreaterThan(0.9);
    expect(at(200)).toBeGreaterThan(0.9);
    expect(at(150)).toBeLessThan(0.7);
    expect(at(125)).toBeLessThan(0.3);
    expect(at(150)).toBeGreaterThan(at(125));
    expect(stepOf(t)).toBeLessThan(0.03);
    // the turned pen gave one weight all the way
    expect(Math.max(...was.slice(-400, -100)) - Math.min(...was.slice(-400, -100))).toBeLessThan(0.01);
  });
  it('lightens an arc with its circle, with no threshold', () => {
    const at = (nibs: number) => lighter(nibs * NIB);
    for (let r = 2; r < 40; r += 0.25) {
      expect(at(r + 0.25)).toBeGreaterThanOrEqual(at(r));
      expect(at(r + 0.25) - at(r)).toBeLessThan(0.03);
      // never heavier than the layout's pen (the radius over 9 nibs, at most the full pen), never under 0.55
      expect(at(r)).toBeLessThanOrEqual(Math.min(1, Math.max(0.55, r / 9)) + 1e-9);
      expect(at(r)).toBeGreaterThanOrEqual(0.55);
    }
    expect(at(9)).toBeCloseTo(0.84, 2);
    expect(at(12)).toBeCloseTo(0.93, 2);
    expect(at(20)).toBeGreaterThan(0.98);
  });
  it('keeps the head of a final jim whose bowl becomes the cradle', () => {
    // as written, the letter's stroke starts at the line and goes down into its bowl: taken over there, the head is lost
    const lost = takeOver(th.buildStrokes('الفرج', {}), 0).head.pre;
    expect(Math.max(...lost.map(q => q.y))).toBeLessThan(1);
    // turned round, it is written from its head: the roof and the slope back are kept, and the bowl is taken over
    // where the slope comes down across the line, heading down and to the left
    const b = th.buildStrokes('الفرج', {}),
      turned = bowlLast(b),
      { si, head } = takeOver(turned, 0);
    expect(turned.strokes.length).toBe(b.strokes.length);
    expect(Math.max(...head.pre.map(q => q.y))).toBeGreaterThan(4.5);
    expect(Math.abs(head.C[1])).toBeLessThan(0.5);
    expect(head.u[1]).toBeLessThan(-0.7);
    expect(head.C[0]).toBeLessThan(Math.min(...lost.map(q => q.x)) - 4);
    expect(turned.strokes[si].s.slice().reverse()).toEqual(b.strokes[si].s);
    // joined (والفتح): the letter is a stroke of its own, and the join is drawn on along the line to that crossing
    const j = th.buildStrokes('والفتح', {}),
      jt = bowlLast(j),
      t2 = takeOver(jt, 0),
      join = jt.strokes.find((st, i) => st.s.length !== j.strokes[i]?.s.length && i < j.strokes.length)!,
      end = join.s[join.s.length - 1];
    expect(jt.strokes.length).toBe(j.strokes.length + 1);
    expect(t2.si).toBe(j.strokes.length);
    expect(Math.max(...t2.head.pre.map(q => q.y))).toBeGreaterThan(4.5);
    expect(Math.hypot(end.x - t2.head.C[0], end.y - t2.head.C[1])).toBeLessThan(0.5);
    // a letter written head first is left alone (a nun, a qaf, a lam, a ya, an ayn)
    for (const w of ['من', 'الحق', 'قل', 'علي', 'مع']) {
      const v = th.buildStrokes(w, {});
      expect(bowlLast(v)).toBe(v);
    }
  });
  it('opens the head of an initial hah', () => {
    // the closed leaf of the engine's initial hah: the side that closes it is the stretch not drawn
    for (const w of ['حكيم', 'حسبنا', 'خير', 'جاء']) {
      const b = th.buildStrokes(w, {}),
        gaps = openHeads(b);
      expect(gaps.size).toBe(1);
      const [[si, [from, to]]] = [...gaps],
        s = b.strokes[si].s;
      // from the roof's left end down to the line, where the stroke turns back
      expect(s[from].y - s[to].y).toBeGreaterThan(1.5);
      expect(s[from].x).toBeLessThan(s[0].x - 5);
      expect(Math.abs(s[from].x - s[to].x)).toBeLessThan(1.5);
    }
    // not a medial or a final one, and no other letter
    for (const w of ['محمد', 'الفرج', 'عليم', 'صل']) expect(openHeads(th.buildStrokes(w, {})).size).toBe(0);
  });
});
