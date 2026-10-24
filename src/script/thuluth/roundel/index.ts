// Roundels and cartouches in thuluth (lab roundel.js, bowl.js, counters.js, marks2.js): a phrase arranged to fill a
// disc or an oval, finished by hand-like steps, its marks solved as one even distribution, drawn on a gilded field.
import type { Thuluth } from '../engine';
import type { BowlOptions, FrameOptions, RiseOptions, TailOptions } from './bowl';
import { extendTails, fitFrame, placeUnder, riseStems, scaleGroup, shapeBowl } from './bowl';
import type { Roundel, RoundelOptions } from './compose';
import { composeRoundel } from './compose';
import type { Finished } from './finish';
import { finishRoundel } from './finish';

export * from './bowl';
export * from './compose';
export * from './counters';
export * from './finish';
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
  /** Each word's letters (and so its marks) in its own colour, by word in turn; groups tinted by a tweak, or a waw
   *  opening a word, take the accent instead. */
  wordTints?: string[];
  accent?: string;
  /** A short companion text set small in the space left (only without `frame`). */
  companion?: string;
}
export interface BuiltRoundel {
  r: Roundel;
  f: Finished;
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
  const wt = spec.wordTints;
  if (wt?.length)
    r.groups.forEach((g, i) => {
      const conj = !!g.tint || (g.s === 'و' && (i === 0 || r.groups[i - 1].word !== g.word));
      g.tint = conj && spec.accent ? spec.accent : (g.tint ?? wt[g.word % wt.length]);
    });
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
