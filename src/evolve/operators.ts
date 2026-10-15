// Genetic operators on composition trees (COMPOSITION_ENGINE.md §7): random compositions, mutation (trait tweaks,
// structural changes, re-seeding) and crossover (branch swaps and gene mixing). Every result is validated against
// the schema; an operator that would produce an invalid tree falls back to its parent.
import type {
  BorderNode,
  Composition,
  FillerNode,
  MonogramMethod,
  Outline,
  PatternSpec,
  TextBorder,
} from '../model/schema';
import { isValidComposition } from '../model/schema';
import { DEFAULT_STYLE } from '../model/style';
import { PALETTE_LIST, TRAITS, traitsOf } from './genes';
import type { Trait, TraitSpec, Traits } from './genes';
import type { Rng } from './rng';
import type { Taste } from './taste';

export interface OperatorOptions {
  rng: Rng;
  taste?: Taste;
  /** Trait values that every child keeps. */
  locks?: Traits;
}
type V = string | number | boolean;

const clone = <T>(x: T): T => structuredClone(x);
const textBorders = (c: Composition) => c.root.child.borders.filter((b): b is TextBorder => b.type === 'textBorder');
/** The slot evolution writes with: the first text border's, else the first slot. */
const mainSlot = (c: Composition) => textBorders(c)[0]?.text ?? Object.keys(c.texts)[0];

/** Taste-biased choice among a trait's values (lab pickPref). */
export function pickValue(trait: Trait, rng: Rng, taste?: Taste): V {
  const spec: TraitSpec = TRAITS[trait],
    vals = spec.values as readonly V[],
    p = taste?.pref[trait] ?? {};
  return rng.weighted(
    vals,
    vals.map(v => (spec.prior?.[String(v)] ?? 1) * (1 + 0.7 * (p[String(v)] ?? 0))),
  );
}

const patternOf = (t: Traits): PatternSpec => ({
  tiling: (t.tiling as PatternSpec['tiling']) ?? '488',
  angle: (t.angle as number) ?? 67,
  scale: (t.scale as number) ?? 5,
});
function outlineFor(kind: string, t: Traits): Outline {
  if (kind === 'circle') return { kind: 'circle' };
  if (kind === 'polygon') return { kind: 'polygon', sides: (t.sides as number) ?? 6 };
  if (kind === 'star') return { kind: 'star', points: (t.points as number) ?? 8, depth: (t.depth as number) ?? 0.55 };
  return { kind: 'preset', name: kind as 'teardrop' };
}
function fillFor(kind: string, c: Composition, t: Traits, rng: Rng): FillerNode {
  const text = mainSlot(c);
  switch (kind) {
    case 'monogram':
      return {
        type: 'monogram',
        text,
        method: ((t.monogram as MonogramMethod) ?? 'seal') as MonogramMethod,
        params: {
          H: 7,
          sym: 'mirror',
          tries: 2,
          seed: rng.seed(),
          ...(t.monogram === 'tughra' ? { curved: true } : {}),
        },
      };
    case 'abjad':
      return { type: 'abjad', text };
    case 'pattern':
      return { type: 'pattern', pattern: patternOf(t) };
    case 'lines':
      return { type: 'lines', text, lineGap: 1, vary: (t.vary as number) ?? 0.5 };
    case 'flow':
      return { type: 'flow', text, lineGap: 1, strength: 0.8 };
    case 'maze':
      return { type: 'maze', text, corridors: 0.7, wall: false, seed: rng.seed(), interlace: !!t.interlace };
    case 'strapwork':
      return { type: 'strapwork', text, tiling: patternOf(t).tiling };
    case 'lattice':
      return { type: 'lattice', text };
    default:
      return { type: kind as 'rings' };
  }
}

/** Set one trait on a composition (in place). */
export function applyTrait(c: Composition, trait: Trait, v: V, rng: Rng): void {
  const r = c.root.child,
    tb = textBorders(c),
    t = { ...traitsOf(c), [trait]: v };
  const s = c.style;
  switch (trait) {
    case 'outline':
      r.outline = outlineFor(v as string, t);
      break;
    case 'sides':
      if (r.outline.kind === 'polygon') r.outline = { ...r.outline, sides: v as number };
      break;
    case 'points':
      if (r.outline.kind === 'star') r.outline = { ...r.outline, points: v as number };
      break;
    case 'depth':
      if (r.outline.kind === 'star') r.outline = { ...r.outline, depth: v as number };
      break;
    case 'spread':
      r.spread = v as number;
      break;
    case 'borders': {
      const n = v as number,
        others: BorderNode[] = r.borders.filter(b => b.type !== 'textBorder');
      const base: TextBorder = tb[0] ?? {
        type: 'textBorder',
        text: mainSlot(c),
        separator: { kind: 'lines', width: 2 },
      };
      const next: TextBorder[] = [];
      for (let i = 0; i < n; i++) next.push(tb[i] ? tb[i] : { ...clone(base), taper: (t.taper as number) ?? 0.5 });
      next.forEach((b, i) => (b.taper = i ? (b.taper ?? 0.5) : 0));
      r.borders = [...next, ...others];
      break;
    }
    case 'taper':
      tb.forEach((b, i) => (b.taper = i ? (v as number) : 0));
      break;
    case 'ascenders':
      s.letter.ascenders = v as 9;
      break;
    case 'separator':
      tb.forEach(b => (b.separator = { kind: v as 'lines', width: b.separator?.width ?? 2 }));
      break;
    case 'separatorWidth':
      tb.forEach(b => (b.separator = { kind: b.separator?.kind ?? 'lines', width: v as number }));
      break;
    case 'ground':
      tb.forEach(
        b =>
          (b.ground =
            v === 'plain'
              ? undefined
              : v === 'pattern'
                ? { kind: 'pattern', pattern: patternOf(t) }
                : { kind: v as 'tint' }),
      );
      break;
    case 'fill':
      r.fill = fillFor(v as string, c, t, rng);
      break;
    case 'vary':
      if (r.fill?.type === 'lines') r.fill = { ...r.fill, vary: v as number };
      break;
    case 'interlace':
      if (r.fill?.type === 'maze') r.fill = { ...r.fill, interlace: v as boolean };
      break;
    case 'monogram':
      if (r.fill?.type === 'monogram')
        r.fill = {
          ...r.fill,
          method: v as MonogramMethod,
          params: v === 'tughra' ? { ...r.fill.params, curved: true } : r.fill.params,
        };
      break;
    case 'spandrels':
      c.root.spandrels =
        v === 'none'
          ? undefined
          : v === 'pattern'
            ? { type: 'pattern', pattern: patternOf(t) }
            : { type: v as 'stars' };
      break;
    case 'tiling':
    case 'angle':
    case 'scale': {
      const key = trait === 'tiling' ? 'tiling' : trait === 'angle' ? 'angle' : 'scale';
      const set = (p?: PatternSpec) => p && ((p as unknown as Record<string, V>)[key] = v);
      if (r.fill?.type === 'pattern') set(r.fill.pattern);
      if (r.fill?.type === 'strapwork' && trait === 'tiling')
        r.fill = { ...r.fill, tiling: v as PatternSpec['tiling'] };
      tb.forEach(b => set(b.ground?.pattern));
      if (c.root.spandrels?.type === 'pattern') set(c.root.spandrels.pattern);
      break;
    }
    case 'tips':
      r.features = { ...r.features, tips: v as 'finial' };
      break;
    case 'corners':
      r.features = { ...r.features, corners: v as 'diamond' };
      break;
    case 'terminal':
      s.terminals.kind = v as 'none';
      break;
    case 'reach':
      s.terminals.reach = v as 'tails';
      break;
    case 'palette':
      s.palette = { ...PALETTE_LIST[v as number] };
      break;
    case 'colouring':
      s.colouring = v as 'solid';
      break;
    case 'stroke':
      s.stroke.kind = v as 'blocks';
      if (v === 'blocks') tb.forEach(b => b.plait && (b.plait = false));
      break;
    case 'corner':
      s.stroke.corner = v as number;
      break;
    case 'banded':
      s.stroke.banded = v as boolean;
      break;
    case 'weight':
      s.stroke.weight = v as number;
      break;
    case 'softness':
      s.stroke.softness = v as number;
      break;
    case 'lamAlif':
      s.letter.lamAlif = v as 'knot';
      break;
    case 'ra':
      s.letter.ra = v as 'desc';
      break;
    case 'marks':
      s.letter.marks = v as 'dots';
      break;
    case 'alternates':
      s.letter.alternates = v as boolean;
      break;
    // plaits on text bands drawn with curved or pen strokes only (owner's review: they don't read in blocks, mazes or
    // line fills)
    case 'plait':
      tb.forEach(b => (b.plait = !!v && s.stroke.kind !== 'blocks'));
      break;
    case 'contrast':
      s.stroke.contrast = v as number;
      break;
    case 'stemTaper':
      s.stroke.taper = v as number;
      break;
    case 'sprouts':
      s.terminals.flourish = v ? 'sprouts' : 'none';
      break;
  }
}

/** Traits whose value matters for this composition (e.g. star points only on a star). */
export function relevantTraits(c: Composition): Trait[] {
  const t = traitsOf(c);
  return (Object.keys(TRAITS) as Trait[]).filter(k => {
    if (k === 'sides') return t.outline === 'polygon';
    if (k === 'points' || k === 'depth') return t.outline === 'star';
    if (k === 'taper') return (t.borders as number) > 1;
    if (k === 'monogram') return t.fill === 'monogram';
    if (k === 'vary') return t.fill === 'lines';
    if (k === 'interlace') return t.fill === 'maze';
    if (k === 'tiling' && t.fill === 'strapwork') return true;
    if (k === 'tiling' || k === 'angle' || k === 'scale')
      return t.fill === 'pattern' || t.ground === 'pattern' || t.spandrels === 'pattern';
    if (k === 'reach') return t.terminal !== 'none';
    if (k === 'corner') return t.stroke !== 'blocks';
    if (k === 'contrast' || k === 'stemTaper' || k === 'sprouts') return t.stroke === 'curved';
    // plaits need tall stems, and text in bands, lines or a maze
    if (k === 'plait') return (t.ascenders as number) >= 9 && (t.borders as number) > 0 && t.stroke !== 'blocks';
    return true;
  });
}

function applyLocks(c: Composition, locks: Traits | undefined, rng: Rng) {
  if (!locks) return;
  for (const [k, v] of Object.entries(locks))
    if (v !== undefined && traitsOf(c)[k as Trait] !== v) applyTrait(c, k as Trait, v, rng);
}
const valid = (c: Composition, fallback: Composition) => (isValidComposition(c) ? c : clone(fallback));

/** A random composition for the given texts (first slot is the main text), biased by taste. */
export function randomComposition(texts: Composition['texts'], o: OperatorOptions): Composition {
  const { rng, taste, locks } = o,
    main = Object.keys(texts)[0];
  const c: Composition = {
    version: 1,
    seed: rng.seed(),
    canvas: { shape: 'square', margin: 3 },
    style: clone(DEFAULT_STYLE),
    texts: clone(texts),
    root: {
      type: 'frame',
      child: {
        type: 'region',
        outline: { kind: 'circle' },
        borders: [{ type: 'textBorder', text: main, separator: { kind: 'lines', width: 2 } }],
      },
    },
  };
  // outline first, then structure, then style
  const order: Trait[] = [
    'outline',
    'sides',
    'points',
    'depth',
    'borders',
    'taper',
    'fill',
    'monogram',
    'spandrels',
    'ground',
    'tiling',
    'angle',
    'scale',
  ];
  for (const k of [...order, ...(Object.keys(TRAITS) as Trait[]).filter(k => !order.includes(k))])
    applyTrait(c, k, pickValue(k, rng, taste), rng);
  applyLocks(c, locks, rng);
  return valid(c, {
    ...c,
    root: {
      type: 'frame',
      child: { type: 'region', outline: { kind: 'circle' }, borders: [{ type: 'textBorder', text: main }] },
    },
  });
}

/** Mutate: each relevant trait changes with probability `rate` (ordinal traits step to a neighbour); node seeds are
 *  re-drawn now and then. */
export function mutate(parent: Composition, rate: number, o: OperatorOptions): Composition {
  const { rng, taste, locks } = o,
    c = clone(parent);
  for (const k of relevantTraits(c)) {
    if (rng.next() > rate) continue;
    const spec = TRAITS[k],
      cur = traitsOf(c)[k];
    let v: V;
    if ('ordinal' in spec && spec.ordinal) {
      const vals = spec.values as readonly V[],
        i = vals.indexOf(cur as V),
        j = i < 0 ? 0 : Math.max(0, Math.min(vals.length - 1, i + (rng.next() < 0.5 ? -1 : 1)));
      v = vals[j];
    } else v = pickValue(k, rng, taste);
    applyTrait(c, k, v, rng);
  }
  // re-seed a maze or seal
  const f = c.root.child.fill;
  if (f && rng.next() < rate) {
    if (f.type === 'maze') f.seed = rng.seed();
    if (f.type === 'monogram') f.params = { ...f.params, seed: rng.seed() };
  }
  c.seed = rng.next() < rate ? rng.seed() : c.seed;
  applyLocks(c, locks, rng);
  return valid(c, parent);
}

/** Crossover: swap whole branches (border stack, fill, outline, spandrels) and mix style groups. */
export function crossover(a: Composition, b: Composition, o: OperatorOptions): Composition {
  const { rng, locks } = o,
    c = clone(a),
    B = clone(b);
  c.texts = { ...B.texts, ...c.texts };
  if (rng.next() < 0.5) c.root.child.borders = B.root.child.borders;
  if (rng.next() < 0.5) c.root.child.fill = B.root.child.fill;
  if (rng.next() < 0.5) c.root.child.outline = B.root.child.outline;
  if (rng.next() < 0.5) c.root.spandrels = B.root.spandrels;
  if (rng.next() < 0.5) c.root.child.features = B.root.child.features;
  if (rng.next() < 0.5) c.root.child.spread = B.root.child.spread;
  for (const g of ['letter', 'stroke', 'terminals', 'palette', 'colouring'] as const)
    if (rng.next() < 0.5) (c.style as unknown as Record<string, unknown>)[g] = B.style[g];
  applyLocks(c, locks, rng);
  return valid(c, a);
}
