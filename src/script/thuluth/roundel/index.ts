// Roundels and cartouches in thuluth (lab roundel.js, bowl.js, counters.js, marks2.js): a phrase arranged to fill a
// disc or an oval, finished by hand-like steps, its marks solved as one even distribution, drawn on a gilded field.
import type { Thuluth } from '../engine';
import type { BowlOptions, FrameOptions } from './bowl';
import { fitFrame, placeUnder, scaleGroup, shapeBowl } from './bowl';
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
}
/** Everything that makes a roundel, as data (the lab's layouts/*.json recipes). */
export interface RoundelSpec {
  text: string;
  compose?: RoundelOptions;
  tweaks?: GroupTweak[];
  /** Redraw a great final bowl to follow the frame (false: leave it). */
  bowl?: BowlOptions | false;
  /** Fit the frame to everything drawn (false: finish inside the composed disc). */
  frame?: FrameOptions | false;
  /** A short companion text set small in the space left (only without `frame`). */
  companion?: string;
}
export interface BuiltRoundel {
  r: Roundel;
  f: Finished;
}

/** Compose, adjust and finish a roundel. Null when the text has no letters. */
export function buildRoundel(th: Thuluth, spec: RoundelSpec): BuiltRoundel | null {
  const r = composeRoundel(th, spec.text, spec.compose)[0];
  if (!r) return null;
  for (const t of spec.tweaks || []) {
    const gi = r.groups.findIndex(g => g.s === t.at);
    if (gi < 0) continue;
    if (t.scale) scaleGroup(th, r, gi, t.scale);
    if (t.tint) r.groups[gi].tint = t.tint;
    if (t.under && t.under.group !== gi && r.groups[t.under.group])
      placeUnder(r, gi, t.under.group, t.under.gap ?? 1, t.under.dx ?? 0);
  }
  if (spec.bowl) shapeBowl(th, r, spec.bowl);
  const f = spec.frame === false ? finishRoundel(th, r, spec.companion || '', {}) : fitFrame(th, r, spec.frame || {});
  return { r, f };
}
