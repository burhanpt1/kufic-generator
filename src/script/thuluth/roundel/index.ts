// Roundels and cartouches in thuluth (lab roundel.js, bowl.js, counters.js, marks2.js): a phrase arranged to fill a
// disc or an oval, finished by hand-like steps, its marks solved as one even distribution, drawn on a gilded field.
import type { Thuluth } from '../engine';
import type { BowlOptions, FrameOptions, RiseOptions, TailOptions } from './bowl';
import { extendTails, fitFrame, placeUnder, riseStems, scaleGroup, shapeBowl } from './bowl';
import type { Roundel, RoundelOptions } from './compose';
import { composeRoundel } from './compose';
import type { DecoFeatures } from './deco';
import { roundelFeatures, tasteScores } from './deco';
import type { Finished } from './finish';
import { finishRoundel } from './finish';

export * from './bowl';
export * from './compose';
export * from './deco';
export * from './counters';
export * from './finish';
export * from './musenna';
export * from './paths';
export * from './render';
export * from './shapes';
export * from './solve';

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
  /** Compose with this many seeds (from compose.seed) and keep the one the fitted taste (deco.ts) likes best: in
   *  almost every test in the lab one seed worked and another didn't. */
  choose?: number;
}
export interface BuiltRoundel {
  r: Roundel;
  f: Finished;
  /** With `choose`: each seed's features and taste score, and the one kept. */
  taste?: { seed: number; features: DecoFeatures; score: number }[];
  picked?: number;
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

/** The arrangements a great bowl is weighed over, best first by the composer's own measure. */
const BOWL_CHOICES = 6;

/** Compose, adjust and finish a roundel. Null when the text has no letters. With a great bowl, the composer's best
 *  arrangements are each finished with their bowl, and the first whose bowl clears the letters as drawn (within a
 *  little widening) is kept, else the one that needed the least: the composer places the letters before the bowl is
 *  redrawn, so it cannot see a tail that the new bowl will run into. */
export function buildRoundel(th: Thuluth, spec: RoundelSpec): BuiltRoundel | null {
  if ((spec.choose ?? 1) > 1 && !spec.compose?.fixed) {
    const seed0 = spec.compose?.seed ?? 7,
      built = Array.from({ length: spec.choose! }, (_, k) => {
        const seed = seed0 + k * 101;
        return { seed, b: buildOne(th, { ...spec, compose: { ...spec.compose, seed } }) };
      }).filter((c): c is { seed: number; b: BuiltRoundel } => !!c.b);
    if (!built.length) return null;
    const features = built.map(c => roundelFeatures(th, c.b.r, c.b.f)),
      scores = tasteScores(features),
      picked = scores.indexOf(Math.max(...scores));
    return { ...built[picked].b, taste: built.map((c, i) => ({ seed: c.seed, features: features[i], score: scores[i] })), picked }; // prettier-ignore
  }
  return buildOne(th, spec);
}

function buildOne(th: Thuluth, spec: RoundelSpec): BuiltRoundel | null {
  const all = composeRoundel(th, spec.text, spec.compose);
  if (!all.length) return null;
  let r: Roundel;
  if (spec.bowl && all.length > 1) {
    const done = all.slice(0, BOWL_CHOICES).map(c => adjust(th, structuredClone(c), spec));
    r = done.find(c => (c.bowlGrow ?? 0) <= 0.08) ?? done.reduce((m, c) => ((c.bowlGrow ?? 0) < (m.bowlGrow ?? 0) ? c : m)); // prettier-ignore
  } else r = adjust(th, all[0], spec);
  const f = spec.frame === false ? finishRoundel(th, r, spec.companion || '', {}) : fitFrame(th, r, spec.frame || {});
  return { r, f };
}
