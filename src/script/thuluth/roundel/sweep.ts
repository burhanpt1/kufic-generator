// The sweep: many roundels per text, across reading-path families, seeds and sampled recipes, each with its critic
// features, genre and fitted taste score, and checks, ready to look at and to rate (scripts: `npm run sweep`).
import type { Thuluth } from '../engine';
import type { RoundelOptions } from './compose';
import type { RoundelChecks } from './checks';
import { roundelChecks } from './checks';
import type { DecoFeatures } from './deco';
import type { Genre } from './deco';
import { featuresIn, genreOf, roundelFeatures, tasteScore } from './deco';
import { buildRoundel, nearSame, sampleRecipe } from './index';
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
  /** Prefix for the ids, so several sweeps can be rated together. */
  prefix?: string;
}
export interface SweepItem {
  id: string;
  text: string;
  family: SweepFamily;
  seed: number;
  recipe: RoundelOptions;
  features: DecoFeatures;
  checks: RoundelChecks | null;
  /** The genre it is judged in, and the fitted taste there (0: the rated set's average). */
  genre: Genre;
  score: number;
  svg: string;
}

export function sweep(th: Thuluth, texts: readonly string[], o: SweepOptions = {}): SweepItem[] {
  const out: SweepItem[] = [],
    fams = o.families ?? ['free', 'lanes', 'path:stag3', 'path:calliar3'];
  let id = 0;
  texts.forEach((text, ti) => {
    const mine: Omit<SweepItem, 'score' | 'genre'>[] = [],
      words = text.trim().split(/\s+/).length,
      // the mirrored candidates, ranked once: the k-th seed takes the k-th distinct design
      mirrored = fams.includes('mirror') && !refusesMirror(text) ? musenna(th, text, { tries: o.tries ?? 3, iters: o.iters ?? 3000 }) : [], // prettier-ignore
      add = (m: Omit<SweepItem, 'score' | 'genre'>) => {
        // a near-duplicate of one already in the sweep adds nothing to rate
        if (!mine.some(q => q.family === m.family && nearSame(q.features, m.features))) mine.push(m);
      };
    for (const family of fams) {
      if (family === 'mirror' && refusesMirror(text)) continue;
      for (let k = 0; k < (o.n ?? 3); k++) {
        const seed = 11 + k * 101 + ti * 7,
          recipe: RoundelOptions = { elongate: true, cross: true, kern: true, ...o.base, ...sampleRecipe(o.base ?? {}, words, seed), tries: o.tries ?? 3, iters: o.iters ?? 3000, seed }; // prettier-ignore
        delete recipe.lanes;
        if (family === 'lanes') recipe.lanes = {};
        if (family.startsWith('path:')) recipe.path = family.slice(5);
        const tag = `${o.prefix ?? 's'}${String(id++).padStart(3, '0')}`;
        if (family === 'mirror') {
          // only designs with a tall stroke shared on the axis
          const c = mirrored.filter((q, i) => (q.shared ?? 0) > 0 && !mirrored.slice(0, i).some(p => nearSame(p.features, q.features)))[k]; // prettier-ignore
          if (!c) continue;
          const art = musennaArt(th, c);
          add({ id: tag, text, family, seed, recipe, features: featuresIn(th, c.units, { cx: c.axis, cy: c.cy, rx: c.rad, ry: c.rad }, 480, c.axis), checks: null, svg: musennaSVG(art, { U: o.U ?? 8 }) }); // prettier-ignore
          continue;
        }
        const b = buildRoundel(th, { text, compose: recipe, frame: { ornaments: true, density: 0.35 } });
        if (!b) continue;
        add({ id: tag, text, family, seed, recipe, features: roundelFeatures(th, b.r, b.f), checks: roundelChecks(th, b.r, b.f), svg: renderRoundel(th, b.r, b.f, { U: o.U ?? 8 }) }); // prettier-ignore
      }
    }
    mine.forEach(m => {
      const genre = genreOf(text, m.family === 'mirror');
      out.push({ ...m, genre, score: tasteScore(m.features, genre) });
    });
  });
  return out;
}
