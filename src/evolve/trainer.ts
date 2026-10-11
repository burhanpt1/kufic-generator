// The taste trainer (lab port §3): ratings of single compositions (veto 0, meh 0.5, like 1) train two logistic
// regressions. The veto model sees only one-hot traits, so it can screen genomes before they are rendered; the
// liking model also sees the critic measures. Also the importer for the lab's rating format.
import type { Composition } from '../model/schema';
import type { Metrics } from './critic';
import { TRAITS, traitsOf } from './genes';
import type { Trait, Traits } from './genes';
import { applyTrait, mutate, randomComposition } from './operators';
import type { OperatorOptions } from './operators';
import { Rng } from './rng';
import { DEFAULT_WEIGHTS } from './taste';

export type Grade = 0 | 0.5 | 1;
export interface Rating {
  comp: Composition;
  r: Grade;
  /** Critic measures, recomputed here (never taken from an import). */
  m: Metrics;
  at: number;
}
/** Ratings kept per browser. */
export const MAX_RATINGS = 600;
/** Fewer ratings than this and there is no model. */
export const MIN_RATINGS = 6;
export const VETO_LIMIT = 0.55;

// ---- features ----
type V = string | number | boolean;
/** Every trait value, as "trait=value". Fixed by TRAITS, so weights stay comparable as ratings grow. */
export const TRAIT_FEATURES: { trait: Trait; value: V; key: string }[] = (Object.keys(TRAITS) as Trait[]).flatMap(t =>
  (TRAITS[t].values as readonly V[]).map(value => ({ trait: t, value, key: `${t}=${String(value)}` })),
);
const featIndex = new Map(TRAIT_FEATURES.map((f, i) => [f.key, i]));
/** The critic measures the liking model sees. */
export const MEASURES = Object.keys(DEFAULT_WEIGHTS);

export function traitFeatures(c: Composition): number[] {
  const x = new Array<number>(TRAIT_FEATURES.length).fill(0);
  for (const [k, v] of Object.entries(traitsOf(c))) {
    const i = featIndex.get(`${k}=${String(v)}`);
    if (i !== undefined) x[i] = 1;
  }
  return x;
}
/** Measures a composition lacks (e.g. monogram metrics on a pattern centre) sit at the neutral 0.5. */
export const measureFeatures = (m: Metrics | null) => MEASURES.map(k => m?.[k] ?? 0.5);

// ---- logistic regression ----
export interface Logit {
  w: Float64Array;
  b: number;
  predict(x: readonly number[]): number;
}
/** Batch gradient descent with L2, as in the lab. Targets may be soft (meh = 0.5). */
export function fitLogit(
  X: readonly (readonly number[])[],
  y: readonly number[],
  l2 = 0.02,
  iters = 400,
  lr = 0.5,
): Logit {
  const n = X.length,
    d = X[0]?.length ?? 0,
    w = new Float64Array(d),
    gw = new Float64Array(d);
  let b = 0;
  for (let it = 0; it < iters; it++) {
    gw.fill(0);
    let gb = 0;
    for (let i = 0; i < n; i++) {
      const xi = X[i];
      let z = b;
      for (let j = 0; j < d; j++) if (xi[j]) z += w[j] * xi[j];
      const e = 1 / (1 + Math.exp(-z)) - y[i];
      gb += e;
      for (let j = 0; j < d; j++) if (xi[j]) gw[j] += e * xi[j];
    }
    b -= (lr * gb) / n;
    for (let j = 0; j < d; j++) w[j] -= lr * (gw[j] / n + l2 * w[j]);
  }
  return {
    w,
    b,
    predict(x) {
      let z = b;
      for (let j = 0; j < d; j++) z += w[j] * x[j];
      return 1 / (1 + Math.exp(-z));
    },
  };
}

export interface TasteModel {
  n: number;
  veto: Logit;
  like: Logit;
  /** Probability of a veto, from traits alone (no rendering needed). */
  pVeto(c: Composition): number;
  /** Predicted liking (0 veto … 1 like). */
  pLike(c: Composition, m: Metrics | null): number;
}
/** Train both models; null with fewer than MIN_RATINGS ratings. */
export function train(ratings: readonly Rating[]): TasteModel | null {
  if (ratings.length < MIN_RATINGS) return null;
  const T = ratings.map(r => traitFeatures(r.comp)),
    veto = fitLogit(
      T,
      ratings.map(r => (r.r === 0 ? 1 : 0)),
    ),
    like = fitLogit(
      T.map((t, i) => [...t, ...measureFeatures(ratings[i].m)]),
      ratings.map(r => r.r),
    );
  return {
    n: ratings.length,
    veto,
    like,
    pVeto: c => veto.predict(traitFeatures(c)),
    pLike: (c, m) => like.predict([...traitFeatures(c), ...measureFeatures(m)]),
  };
}

/** Breed ranking with a model: 0.4 × critic + 0.6 × liking. */
export const blendScore = (critic: number, model: TasteModel | null, c: Composition, m: Metrics | null) =>
  model ? 0.4 * critic + 0.6 * model.pLike(c, m) : critic;

/** Re-make a genome while the veto model expects a veto (lab `screened`). */
export function screened(make: () => Composition, model: TasteModel | null, tries = 25): Composition {
  let g = make(),
    k = 0;
  while (model && model.pVeto(g) > VETO_LIMIT && k++ < tries) g = make();
  return g;
}
/** Swap out the candidates of a generation the veto model expects to be vetoed; returns how many were swapped. */
export function screenGeneration(
  comps: Composition[],
  model: TasteModel | null,
  make: (i: number) => Composition,
  tries = 25,
): { comps: Composition[]; swapped: number } {
  if (!model) return { comps, swapped: 0 };
  let swapped = 0;
  const out = comps.map((c, i) => {
    if (model.pVeto(c) <= VETO_LIMIT) return c;
    swapped++;
    return screened(() => make(i), model, tries - 1);
  });
  return { comps: out, swapped };
}

/** The next genomes to render for rating: 40% variations of a liked composition (rate 0.3), otherwise fresh ones;
 *  each screened by the veto model. */
export function proposals(
  n: number,
  texts: Composition['texts'],
  ratings: readonly Rating[],
  model: TasteModel | null,
  o: OperatorOptions,
): Composition[] {
  const liked = ratings.filter(r => r.r === 1);
  const make = () => {
    if (liked.length && o.rng.next() < 0.4) {
      const p = structuredClone(o.rng.pick(liked).comp);
      p.texts = structuredClone(texts);
      return mutate(p, 0.3, o);
    }
    return randomComposition(texts, o);
  };
  return Array.from({ length: n }, () => screened(make, model));
}
/** The candidate the liking model is least sure about (closest to 0.5); the first one without a model. */
export function leastSure(cands: { comp: Composition; m: Metrics | null }[], model: TasteModel | null): number {
  if (!model) return 0;
  let best = 0,
    bd = Infinity;
  cands.forEach((c, i) => {
    const d = Math.abs(model.pLike(c.comp, c.m) - 0.5);
    if (d < bd) [best, bd] = [i, d];
  });
  return best;
}

// ---- what it has learned ----
export interface Learned {
  likes: { trait: Trait; value: V; w: number }[];
  lower: { trait: Trait; value: V; w: number }[];
  vetoes: { trait: Trait; value: V; w: number }[];
  measures: { key: string; w: number }[];
}
/** Trait values with liking or veto weights over 0.15 (strongest first, at most `top`), and the three critic
 *  measures the liking model weighs most. */
export function learned(model: TasteModel, top = 6, min = 0.15): Learned {
  const traits = (w: Float64Array, sign: 1 | -1) =>
    TRAIT_FEATURES.map((f, i) => ({ trait: f.trait, value: f.value, w: w[i] * sign }))
      .filter(f => f.w > min)
      .sort((a, b) => b.w - a.w)
      .slice(0, top)
      .map(f => ({ ...f, w: f.w * sign }));
  const T = TRAIT_FEATURES.length;
  return {
    likes: traits(model.like.w, 1),
    lower: traits(model.like.w, -1),
    vetoes: traits(model.veto.w, 1),
    measures: MEASURES.map((key, i) => ({ key, w: model.like.w[T + i] }))
      .sort((a, b) => b.w - a.w)
      .slice(0, 3),
  };
}

// ---- the lab's rating format ----
export interface LabRecord {
  g: Record<string, unknown>;
  text?: string;
  r: number;
  m?: unknown;
}
// lab gene → studio trait, with value renames; numeric genes map to the nearest studio value
const LAB: Record<string, { trait: Trait; map?: Record<string, V>; byIndex?: readonly number[] } | null> = {
  layout: { trait: 'outline', map: { poly: 'polygon' } },
  sides: { trait: 'sides' },
  points: { trait: 'points' },
  depth: { trait: 'depth' },
  // the lab's sizes were [1, 1.25, 1.6]; the studio's narrower range keeps their order
  spread: { trait: 'spread', byIndex: [1, 1.25, 1.6] },
  rings: { trait: 'borders' },
  taper: { trait: 'taper' },
  centre: null, // reserved centre size: no studio trait
  H: { trait: 'ascenders' },
  gap: { trait: 'separatorWidth' },
  terminal: { trait: 'terminal' },
  reach: { trait: 'reach', map: { asc: 'tall' } },
  bandStyle: { trait: 'separator' },
  ground: { trait: 'ground', map: { geo: 'pattern' } },
  corners: { trait: 'spandrels', map: { geo: 'pattern' } },
  center: { trait: 'fill', map: { mono: 'monogram', geo: 'pattern', squares: 'rings' } },
  tiling: { trait: 'tiling', map: { sq: 'square' } },
  geoAngle: { trait: 'angle' },
  geoScale: { trait: 'scale' },
  palette: { trait: 'palette' },
  colourMode: { trait: 'colouring', map: { ring: 'byRing', repeat: 'byRepeat' } },
  letterStyle: { trait: 'banded', map: { solid: false, banded: true } },
  weight: { trait: 'weight' },
  soft: { trait: 'softness' },
  la: { trait: 'lamAlif' },
  ra: { trait: 'ra' },
  marks: { trait: 'marks' },
  stroke: { trait: 'stroke' },
  curve: { trait: 'corner' },
  plait: null, // plaited stems aren't in the studio yet
};
const ORDER: Trait[] = ['outline', 'sides', 'points', 'depth', 'borders', 'taper', 'fill', 'spandrels', 'ground'];

/** Studio traits for a lab genome, and what didn't carry over (unknown genes, values without a match, values
 *  moved to the nearest one the studio offers). */
export function labTraits(g: Record<string, unknown>): { traits: Traits; dropped: string[] } {
  const traits: Traits = {},
    dropped: string[] = [];
  for (const [k, raw] of Object.entries(g)) {
    if (!(k in LAB)) {
      dropped.push(`${k} (unknown gene)`);
      continue;
    }
    const spec = LAB[k];
    if (!spec) {
      dropped.push(`${k} (no studio equivalent)`);
      continue;
    }
    const vals = TRAITS[spec.trait].values as readonly V[];
    let v: unknown = raw;
    if (spec.map && String(raw) in spec.map) v = spec.map[String(raw)];
    if (spec.byIndex && typeof raw === 'number') {
      const i = spec.byIndex.indexOf(raw);
      if (i >= 0) v = vals[Math.min(i, vals.length - 1)];
    }
    if (vals.includes(v as V)) traits[spec.trait] = v as V;
    else if (typeof v === 'number' && typeof vals[0] === 'number') {
      const near = (vals as readonly number[]).reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));
      traits[spec.trait] = near;
      dropped.push(`${k} ${v} → ${near}`);
    } else dropped.push(`${k}=${String(raw)} (no match)`);
  }
  return { traits, dropped };
}

/** A composition for a lab genome: the mapped traits over a seeded random base (so unmapped traits are
 *  reproducible), monograms as seals. */
export function compositionFromLab(g: Record<string, unknown>, text: string, seed: number) {
  const { traits, dropped } = labTraits(g),
    rng = new Rng(seed),
    texts: Composition['texts'] = { main: { text, repeat: 'fill', wordGap: 2 } },
    c = randomComposition(texts, { rng });
  if (traits.fill === 'monogram') traits.monogram ??= 'seal';
  const keys = [...ORDER.filter(k => k in traits), ...(Object.keys(traits) as Trait[]).filter(k => !ORDER.includes(k))];
  for (const k of keys) applyTrait(c, k, traits[k]!, rng);
  return { comp: c, dropped };
}

const grade = (r: unknown): Grade | null => (r === 1 || r === 0.5 || r === 0 ? r : null);
/** Parse pasted lab ratings into compositions to re-measure. Bad records are skipped and counted. */
export function parseLabRatings(json: string, fallbackText = 'بسم الله الرحمن الرحيم') {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return { items: [], dropped: new Map<string, number>(), skipped: 0, error: 'Not valid JSON.' };
  }
  if (!Array.isArray(data))
    return { items: [], dropped: new Map<string, number>(), skipped: 0, error: 'Expected a JSON array.' };
  const items: { comp: Composition; r: Grade }[] = [],
    dropped = new Map<string, number>();
  let skipped = 0;
  data.forEach((rec: Partial<LabRecord>, i) => {
    const r = grade(rec?.r);
    if (!rec || typeof rec.g !== 'object' || rec.g === null || r === null) return void skipped++;
    const text = typeof rec.text === 'string' && rec.text.trim() ? rec.text.trim() : fallbackText;
    const { comp, dropped: d } = compositionFromLab(rec.g, text, 1 + i * 7919);
    for (const x of d) dropped.set(x, (dropped.get(x) ?? 0) + 1);
    items.push({ comp, r });
  });
  return { items, dropped, skipped, error: null as string | null };
}

/** Keep the newest MAX_RATINGS. */
export const capRatings = (rs: Rating[]) => (rs.length > MAX_RATINGS ? rs.slice(rs.length - MAX_RATINGS) : rs);
