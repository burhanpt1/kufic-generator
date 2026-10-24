// Taste: metric weights and trait preferences learned from the user's picks (lab learn), persisted by the UI.
import type { Metrics } from './critic';
import { traitsOf } from './genes';
import type { Composition } from '../model/schema';

export interface Taste {
  /** Weight per metric (normalised to sum 1 over the metrics present). */
  w: Record<string, number>;
  /** Trait -> value -> times picked. */
  pref: Record<string, Record<string, number>>;
  picks: number;
}
export const DEFAULT_WEIGHTS: Record<string, number> = {
  rhythm: 0.26, kashida: 0.2, density: 0.2, rep: 0.08, centre: 0.1, fill: 0.16,
  legibility: 0.2, compact: 0.08, squareness: 0.06, symmetry: 0.03, sharing: 0.08, space: 0.3,
  clearance: 0.25, apart: 0.25, marked: 0.15, layers: 0.12, order: 0.3, clear: 0.35,
  // the taste fitted to the owner's votes (roundel/fits.data.ts) carries the decorative features; they are shown alone
  taste: 0.6,
}; // prettier-ignore
export const newTaste = (): Taste => ({ w: { ...DEFAULT_WEIGHTS }, pref: {}, picks: 0 });

/** Overall score: the weighted mean of the metrics a composition has. */
export function score(m: Metrics | null, taste: Taste): number {
  if (!m) return 0;
  let a = 0,
    t = 0;
  for (const [k, v] of Object.entries(m)) {
    const w = taste.w[k] ?? 0;
    a += w * v;
    t += w;
  }
  return t ? a / t : 0;
}

/** Picks shift metric weights toward what they do better than the population, and raise their traits' priors. */
export function learn(
  taste: Taste,
  picks: { comp: Composition; m: Metrics | null }[],
  population: (Metrics | null)[],
): Taste {
  const t: Taste = { w: { ...taste.w }, pref: structuredClone(taste.pref), picks: taste.picks };
  const ms = population.filter((m): m is Metrics => !!m);
  if (ms.length) {
    const keys = Object.keys(t.w),
      mean = Object.fromEntries(keys.map(k => [k, ms.reduce((a, m) => a + (m[k] ?? 0), 0) / ms.length]));
    for (const p of picks)
      if (p.m) for (const k of keys) if (p.m[k] != null) t.w[k] = Math.max(0.02, t.w[k] + 0.12 * (p.m[k] - mean[k]));
    const sum = Object.values(t.w).reduce((a, b) => a + b, 0);
    for (const k of keys) t.w[k] /= sum;
  }
  for (const p of picks)
    for (const [k, v] of Object.entries(traitsOf(p.comp))) {
      t.pref[k] = t.pref[k] ?? {};
      t.pref[k][String(v)] = (t.pref[k][String(v)] ?? 0) + 1;
    }
  t.picks += picks.length;
  return t;
}
