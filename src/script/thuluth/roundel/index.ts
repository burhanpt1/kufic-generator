// Roundels and cartouches in thuluth (lab roundel.js, bowl.js, counters.js, marks2.js): a phrase arranged to fill a
// disc or an oval, finished by hand-like steps, its marks solved as one even distribution, drawn on a gilded field.
import type { Thuluth } from '../engine';
import type { BowlOptions, FrameOptions, RiseOptions, TailOptions } from './bowl';
import { clashes, extendTails, fitFrame, placeUnder, riseStems, scaleGroup, shapeBowl } from './bowl';
import type { Roundel, RoundelOptions } from './compose';
import { composeRoundel, roundelOrderFault } from './compose';
import type { DecoFeatures } from './deco';
import { genreOf, roundelFeatures, tasteScore, tasteScores } from './deco';
import { AUTO_PATHS } from './paths';
import type { Finished } from './finish';
import { finishRoundel } from './finish';

export * from './bowl';
export * from './checks';
export * from './compose';
export * from './deco';
export * from './counters';
export * from './finish';
export * from './musenna';
export * from './paths';
export * from './render';
export * from './shapes';
export * from './solve';
export * from './sweep';

/** A hand adjustment to one group, found by its letters (the first group spelling `at`). */
export interface GroupTweak {
  at: string;
  /** Scale about its own origin. */
  scale?: number;
  /** Its own colour. */
  tint?: string;
  /** Centred under the last letter of another group (by index), with a gap. */
  under?: { group: number; gap?: number; dx?: number };
  /** Moved by (dx, dy) pen units, after it is placed. */
  move?: [number, number];
}
/** Everything that makes a roundel, as data (the lab's layouts/*.json recipes). */
export interface RoundelSpec {
  text: string;
  compose?: RoundelOptions;
  tweaks?: GroupTweak[];
  /** Draw out the tails that have the rest of their word nested in them (false or absent: leave them). */
  tails?: TailOptions | false;
  /** Let tall stems rise into the space above them (false or absent: leave them). */
  rise?: RiseOptions | false;
  /** Redraw a great final bowl to follow the frame (false: leave it). */
  bowl?: BowlOptions | false;
  /** Fit the frame to everything drawn (false: finish inside the composed disc). */
  frame?: FrameOptions | false;
  /** A short companion text set small in the space left (only without `frame`). */
  companion?: string;
  /** How many of the composer's best arrangements are finished and judged as drawn (3; 6 with a great bowl). */
  judge?: number;
  /** Compose with this many seeds (from compose.seed) and keep the one the fitted taste (deco.ts) likes best: in
   *  almost every test in the lab one seed worked and another didn't. Each seed after the first also samples the
   *  options the recipe leaves open (vary: false keeps them), and near-duplicates are dropped. */
  choose?: number;
  vary?: boolean;
}
export interface BuiltRoundel {
  r: Roundel;
  f: Finished;
  /** With `choose`: each seed's features and taste score, and the one kept. */
  taste?: { seed: number; varied: RoundelOptions; features: DecoFeatures; score: number }[];
  picked?: number;
  /** With path: 'auto', the family chosen. */
  path?: string;
}

function adjust(th: Thuluth, r: Roundel, spec: RoundelSpec): Roundel {
  for (const t of spec.tweaks || []) {
    const gi = r.groups.findIndex(g => g.s === t.at);
    if (gi < 0) continue;
    if (t.scale) scaleGroup(th, r, gi, t.scale);
    if (t.tint) r.groups[gi].tint = t.tint;
    if (t.under && t.under.group !== gi && r.groups[t.under.group])
      placeUnder(r, gi, t.under.group, t.under.gap ?? 1, t.under.dx ?? 0);
    if (t.move) r.st[gi] = { x: r.st[gi].x + t.move[0], y: r.st[gi].y + t.move[1] };
  }
  if (spec.tails) extendTails(th, r, { bowl: spec.bowl || undefined, ...spec.tails });
  if (spec.bowl) shapeBowl(th, r, spec.bowl);
  if (spec.rise) riseStems(th, r, spec.rise);
  return r;
}

/** A seeded sample of the composer options a recipe leaves open: the field's proportion and fill, stacking (by rule or
 *  learned), girift's gentle setting, and fitted lanes for texts of three words or more. */
export function sampleRecipe(given: RoundelOptions, words: number, seed: number): RoundelOptions {
  let sd = (seed * 48271) % 2147483647 || 1;
  const R = () => (sd = (sd * 16807) % 2147483647) / 2147483647,
    pick = <T>(xs: readonly T[]) => xs[Math.floor(R() * xs.length)],
    out: RoundelOptions = {};
  if (given.oval == null) out.oval = pick([1, 1, 1.15, 1.3]);
  if (given.fillTarget == null) out.fillTarget = pick([0.36, 0.45, 0.5]);
  if (given.stack == null) out.stack = R() < 0.5;
  if (given.learnedStack == null) out.learnedStack = R() < 0.5;
  if (given.girift == null) out.girift = pick([0, 0, 0.04]);
  if (given.lanes == null && given.path == null && words >= 3 && R() < 0.5) out.lanes = {};
  return out;
}
/** Two roundels whose critic features all but agree are the same choice. */
export const nearSame = (a: DecoFeatures, b: DecoFeatures) =>
  Math.abs(a.texture - b.texture) < 0.01 &&
  Math.abs(a.unity - b.unity) < 0.01 &&
  Math.abs(a.span - b.span) < 0.01 &&
  Math.abs(a.fill - b.fill) < 0.003 &&
  Math.abs(a.noise - b.noise) < 0.05;

/** The arrangements a great bowl is weighed over, best first by the composer's own measure. */
const BOWL_CHOICES = 6;

/** Compose, adjust and finish a roundel. Null when the text has no letters. The composer's best arrangements are
 *  each finished and judged as drawn (the fitted taste, less marks without room, clashes and reading-order faults);
 *  with a great bowl, only those whose bowl clears the letters (within a little widening) compete, else the one that
 *  needed the least: the composer places the letters before the bowl is redrawn, so it cannot see a tail that the new
 *  bowl will run into. */
export function buildRoundel(th: Thuluth, spec: RoundelSpec): BuiltRoundel | null {
  if (spec.compose?.path === 'auto' && !spec.compose.fixed) {
    // fit the path to the text: each family composed and finished, the best kept by the genre's taste, less marks
    // without room, clashes and order faults (one word has no reading path to fit)
    const genre = genreOf(spec.text),
      rest: RoundelOptions = { ...spec.compose, path: undefined },
      words = spec.text.trim().split(/\s+/).length;
    if (words < 2) return buildRoundel(th, { ...spec, compose: rest });
    let best: (BuiltRoundel & { score: number }) | null = null;
    for (const fam of AUTO_PATHS) {
      const compose: RoundelOptions = fam === 'lanes' ? { ...rest, lanes: rest.lanes ?? {} } : { ...rest, path: fam },
        b = buildRoundel(th, { ...spec, compose });
      if (!b) continue;
      const score = tasteScore(roundelFeatures(th, b.r, b.f), genre) - 3 * b.f.missing - clashes(th, b.r) / 6 - roundelOrderFault(b.r); // prettier-ignore
      if (!best || score > best.score) best = { ...b, path: fam, score };
    }
    return best;
  }
  if ((spec.choose ?? 1) > 1 && !spec.compose?.fixed) {
    const seed0 = spec.compose?.seed ?? 7,
      words = spec.text.trim().split(/\s+/).length,
      built: { seed: number; varied: RoundelOptions; b: BuiltRoundel; features: DecoFeatures }[] = [];
    for (let k = 0; k < spec.choose!; k++) {
      const seed = seed0 + k * 101,
        // the first seed takes the recipe as given; the others sample what it leaves open
        varied = k && spec.vary !== false ? sampleRecipe(spec.compose ?? {}, words, seed) : {},
        b = buildOne(th, { ...spec, compose: { ...spec.compose, ...varied, seed } });
      if (!b) continue;
      const features = roundelFeatures(th, b.r, b.f);
      // a near-duplicate of one already built adds nothing to choose from
      if (built.some(c => nearSame(c.features, features))) continue;
      built.push({ seed, varied, b, features });
    }
    if (!built.length) return null;
    const scores = tasteScores(
        built.map(c => c.features),
        genreOf(spec.text),
      ),
      picked = scores.indexOf(Math.max(...scores));
    return { ...built[picked].b, taste: built.map((c, i) => ({ seed: c.seed, varied: c.varied, features: c.features, score: scores[i] })), picked }; // prettier-ignore
  }
  return buildOne(th, spec);
}

function buildOne(th: Thuluth, spec: RoundelSpec): BuiltRoundel | null {
  const all = composeRoundel(th, spec.text, spec.compose);
  if (!all.length) return null;
  const finish = (r: Roundel) =>
    spec.frame === false ? finishRoundel(th, r, spec.companion || '', {}) : fitFrame(th, r, spec.frame || {});
  const k = Math.min(all.length, spec.judge ?? (spec.bowl ? BOWL_CHOICES : 3));
  if (k <= 1) {
    const r = adjust(th, all[0], spec);
    return { r, f: finish(r) };
  }
  // the composer's best few, each finished (bowl, tails, stems, marks, frame) and judged as drawn: a layout's merit
  // shows only once its bowl is redrawn and its marks are placed
  const done = all.slice(0, k).map(c => {
    const r = adjust(th, structuredClone(c), spec);
    return { r, f: finish(r) };
  });
  const taste = tasteScores(
      done.map(d => roundelFeatures(th, d.r, d.f)),
      genreOf(spec.text),
    ),
    judged = done.map((d, i) => ({
      ...d,
      // a bowl that had to widen much to clear the letters ran into them as composed
      bowlOk: (d.r.bowlGrow ?? 0) <= 0.08,
      score: taste[i] - 3 * d.f.missing - clashes(th, d.r) / 6 - roundelOrderFault(d.r),
    }));
  const pool = judged.some(d => d.bowlOk)
    ? judged.filter(d => d.bowlOk)
    : [judged.reduce((m, d) => ((d.r.bowlGrow ?? 0) < (m.r.bowlGrow ?? 0) ? d : m))];
  const best = pool.reduce((m, d) => (d.score > m.score ? d : m));
  return { r: best.r, f: best.f };
}
