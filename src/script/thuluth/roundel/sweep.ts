// The sweep: many roundels per text, across reading-path families, seeds and sampled recipes, each with its critic
// features, taste score (within its text) and checks, ready to look at and to rate (scripts: `npm run sweep`).
import type { Thuluth } from '../engine';
import type { RoundelOptions } from './compose';
import type { RoundelChecks } from './checks';
import { roundelChecks } from './checks';
import type { DecoFeatures } from './deco';
import { featuresIn, roundelFeatures, tasteScores } from './deco';
import { buildRoundel, sampleRecipe } from './index';
import { musenna, musennaArt, musennaSVG, refusesMirror } from './musenna';
import { renderRoundel } from './render';

/** A family of layouts: free, fitted lanes, a named path, or mirrored. */
export type SweepFamily = 'free' | 'lanes' | 'mirror' | `path:${string}`;
export interface SweepOptions {
  /** Seeds per text and family. */
  n?: number;
  families?: SweepFamily[];
  /** Composer effort per candidate. */
  tries?: number;
  iters?: number;
  /** Options every candidate shares (the sampled ones fill in the rest). */
  base?: RoundelOptions;
  /** Pixels per pen unit for the SVGs. */
  U?: number;
}
export interface SweepItem {
  id: string;
  text: string;
  family: SweepFamily;
  seed: number;
  recipe: RoundelOptions;
  features: DecoFeatures;
  checks: RoundelChecks | null;
  /** The fitted taste, standardised within the text's candidates. */
  score: number;
  svg: string;
}

export function sweep(th: Thuluth, texts: readonly string[], o: SweepOptions = {}): SweepItem[] {
  const out: SweepItem[] = [],
    fams = o.families ?? ['free', 'lanes', 'path:stag3', 'path:calliar3'];
  let id = 0;
  texts.forEach((text, ti) => {
    const mine: Omit<SweepItem, 'score'>[] = [],
      words = text.trim().split(/\s+/).length;
    for (const family of fams) {
      if (family === 'mirror' && refusesMirror(text)) continue;
      for (let k = 0; k < (o.n ?? 3); k++) {
        const seed = 11 + k * 101 + ti * 7,
          recipe: RoundelOptions = { elongate: true, cross: true, kern: true, ...o.base, ...sampleRecipe(o.base ?? {}, words, seed), tries: o.tries ?? 3, iters: o.iters ?? 3000, seed }; // prettier-ignore
        delete recipe.lanes;
        if (family === 'lanes') recipe.lanes = {};
        if (family.startsWith('path:')) recipe.path = family.slice(5);
        const tag = `s${String(id++).padStart(3, '0')}`;
        if (family === 'mirror') {
          const c = musenna(th, text, { seeds: [seed], tries: recipe.tries, iters: recipe.iters })[0];
          if (!c) continue;
          const art = musennaArt(th, c);
          mine.push({ id: tag, text, family, seed, recipe, features: featuresIn(th, c.units, { cx: c.axis, cy: c.cy, rx: c.rad, ry: c.rad }, 480, c.axis), checks: null, svg: musennaSVG(art, { U: o.U ?? 8 }) }); // prettier-ignore
          continue;
        }
        const b = buildRoundel(th, { text, compose: recipe, frame: { ornaments: true, density: 0.35 } });
        if (!b) continue;
        mine.push({ id: tag, text, family, seed, recipe, features: roundelFeatures(th, b.r, b.f), checks: roundelChecks(th, b.r, b.f), svg: renderRoundel(th, b.r, b.f, { U: o.U ?? 8 }) }); // prettier-ignore
      }
    }
    const s = tasteScores(mine.map(m => m.features));
    mine.forEach((m, i) => out.push({ ...m, score: s[i] }));
  });
  return out;
}
