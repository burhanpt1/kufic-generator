// The composition model (COMPOSITION_ENGINE.md §3.2), version 1: a serialisable tree of regions, borders, fillers
// and features. Types are written out for readability; the zod schemas below validate untrusted JSON (links,
// saved files, mutated genomes) against them.
import { z } from 'zod';
import type { Outline } from '../geometry/outlines';
import type { LetterStyle } from '../script/types';

export type { Outline };
export type Seed = number;

export interface Palette {
  ink: string;
  ink2: string;
  paper: string;
  mark: string;
}
export interface Style {
  script: 'kufi';
  letter: LetterStyle;
  stroke: { kind: 'blocks' | 'curved' | 'pen'; corner: number; weight: number; softness: number; banded: boolean };
  terminals: { kind: 'none' | 'notch' | 'bevel' | 'leaf' | 'palmette'; reach: 'tall' | 'tails' | 'all' };
  palette: Palette;
  colouring: 'solid' | 'byRing' | 'byRepeat' | 'radial';
  /** Abjad conventions: ة counts 5 or 400; Eastern (mashriqi) or Western (maghribi) values. */
  abjad: { taMarbuta: 5 | 400; system: 'mashriqi' | 'maghribi' };
}
/** A partial style: any top-level group, itself partial. */
export type StyleOverride = { [K in keyof Style]?: Style[K] extends object ? Partial<Style[K]> : Style[K] };

export interface TextSlot {
  /** Line breaks give one ring per line in a multi-ring border stack. */
  text: string;
  /** 'fill' = whole repeats to fill; 'once' = exactly one pass. */
  repeat: 'fill' | 'once';
  wordGap: number;
}

export type SeparatorKind = 'none' | 'lines' | 'pearls' | 'chevron' | 'braid';
export interface Separator {
  kind: SeparatorKind;
  /** Width in cells. */
  width: number;
}
export interface PatternSpec {
  tiling: 'square' | '488' | 'hex' | '31212';
  /** Contact angle in degrees. */
  angle: number;
  /** Tile edge in cells. */
  scale: number;
}
export interface Ground {
  kind: 'plain' | 'tint' | 'vine' | 'pattern';
  pattern?: PatternSpec;
}

export interface TextBorder {
  type: 'textBorder';
  /** Text slot name. */
  text: string;
  /** Letter scale; 'auto' = tuned with the repeat count so the text fits whole. */
  scale?: 'auto' | number;
  /** Inner rings smaller: target scale = (ring size / outer size)^taper. */
  taper?: number;
  separator?: Separator;
  ground?: Ground;
  /** Plaited tall stems (needs ascenders of 9 or more). */
  plait?: boolean;
}
export interface OrnamentBorder {
  type: 'ornamentBorder';
  ornament: 'lines' | 'pearls' | 'chevron' | 'braid';
  width: number;
}
export type BorderNode = TextBorder | OrnamentBorder;

export type MonogramMethod =
  'mirror' | 'below' | 'quad' | 'pair' | 'pinwheel' | 'pinwheelIn' | 'block' | 'spiral' | 'tughra' | 'seal';
export type FillerNode =
  | {
      type: 'lines';
      text: string;
      lineGap: number;
      minWords?: number;
      /** Variable line height, 0–1: lines shrink where the region narrows (0 = one letter size throughout). */
      vary?: number;
      plait?: boolean;
    }
  | {
      type: 'maze';
      text: string;
      corridors: number;
      wall: boolean;
      seed?: number;
      /** Interlaced: ribbons that cross over and under on a lattice instead of one corridor. */
      interlace?: boolean;
      plait?: boolean;
    }
  /** Lines along streamlines that follow the outline near its edge; strength 0 = level lines, 1 = hug the edge. */
  | { type: 'flow'; text: string; lineGap: number; strength?: number }
  | { type: 'monogram'; text: string; method: MonogramMethod; params: Record<string, number | string | boolean> }
  | { type: 'abjad'; text: string }
  /** Text along the interlaced strands of a star pattern (lab port §4). */
  | { type: 'strapwork'; text: string; tiling: 'square' | '488' | 'hex' | '31212' }
  /** Horizontal and vertical text straps woven in a checkerboard (lab port §7). */
  | { type: 'lattice'; text: string }
  | { type: 'pattern'; pattern: PatternSpec }
  | { type: 'rings' }
  | { type: 'vine' }
  | { type: 'solid' }
  | { type: 'region'; node: RegionNode };

export interface FeatureSet {
  tips?: 'finial' | 'diamond' | 'none';
  corners?: 'diamond' | 'star' | 'none';
}

export interface RegionNode {
  type: 'region';
  outline: Outline;
  /** Outline scale in cells; 'auto' = solved from the outermost text border. */
  size?: 'auto' | number;
  /** Enlarges an auto size (an evolvable parameter). */
  spread?: number;
  /** Outermost first. */
  borders: BorderNode[];
  fill?: FillerNode;
  features?: FeatureSet;
  style?: StyleOverride;
}

export type SpandrelNode = FillerNode | { type: 'stars' };
export interface FrameNode {
  type: 'frame';
  spandrels?: SpandrelNode;
  child: RegionNode;
  style?: StyleOverride;
}

export interface Composition {
  version: 1;
  seed: Seed;
  canvas: { shape: 'square' | 'portrait' | 'landscape'; margin: number };
  style: Style;
  texts: Record<string, TextSlot>;
  root: FrameNode;
}

// ---------- zod ----------
const colour = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const letter = z.object({
  ascenders: z.union([z.literal(7), z.literal(9), z.literal(11), z.literal(13), z.literal(15)]),
  ra: z.enum(['desc', 'short', 'hook']),
  ayn: z.enum(['open', 'cup']),
  lamAlif: z.enum(['plain', 'knot']),
  marks: z.enum(['off', 'dots', 'all']),
  vowels: z.enum(['modern', 'early']),
  alternates: z.boolean().optional(),
});
const stroke = z.object({
  kind: z.enum(['blocks', 'curved', 'pen']),
  corner: z.number().min(0).max(2),
  weight: z.number().min(0.1).max(1.2),
  softness: z.number().min(0).max(1),
  banded: z.boolean(),
});
const terminals = z.object({
  kind: z.enum(['none', 'notch', 'bevel', 'leaf', 'palmette']),
  reach: z.enum(['tall', 'tails', 'all']),
});
const palette = z.object({ ink: colour, ink2: colour, paper: colour, mark: colour });
const abjadOpts = z.object({
  taMarbuta: z.union([z.literal(5), z.literal(400)]),
  system: z.enum(['mashriqi', 'maghribi']),
});
export const StyleSchema = z.object({
  script: z.literal('kufi'),
  letter,
  stroke,
  terminals,
  palette,
  colouring: z.enum(['solid', 'byRing', 'byRepeat', 'radial']),
  abjad: abjadOpts,
});
const StyleOverrideSchema = z
  .object({
    script: z.literal('kufi'),
    letter: letter.partial(),
    stroke: stroke.partial(),
    terminals: terminals.partial(),
    palette: palette.partial(),
    colouring: z.enum(['solid', 'byRing', 'byRepeat', 'radial']),
    abjad: abjadOpts.partial(),
  })
  .partial();

const point = z.tuple([z.number(), z.number()]);
export const OutlineSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('circle') }),
  z.object({ kind: z.literal('polygon'), sides: z.number().int().min(3).max(24), rotation: z.number().optional() }),
  z.object({ kind: z.literal('star'), points: z.number().int().min(3).max(24), depth: z.number().min(0.2).max(0.95) }),
  z.object({ kind: z.literal('preset'), name: z.enum(['teardrop', 'heart', 'mihrab']) }),
  z.object({ kind: z.literal('svg'), path: z.string().min(1).max(200_000) }),
  z.object({ kind: z.literal('poly'), points: z.array(point).min(3).max(20_000) }),
]);
const separator = z.object({
  kind: z.enum(['none', 'lines', 'pearls', 'chevron', 'braid']),
  width: z.number().min(0).max(12),
});
const pattern = z.object({
  tiling: z.enum(['square', '488', 'hex', '31212']),
  angle: z.number().min(10).max(85),
  scale: z.number().min(1).max(30),
});
const ground = z.object({ kind: z.enum(['plain', 'tint', 'vine', 'pattern']), pattern: pattern.optional() });
const slotName = z.string().min(1).max(64);
const border = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('textBorder'),
    text: slotName,
    scale: z.union([z.literal('auto'), z.number().min(0.2).max(3)]).optional(),
    taper: z.number().min(0).max(2).optional(),
    separator: separator.optional(),
    ground: ground.optional(),
    plait: z.boolean().optional(),
  }),
  z.object({
    type: z.literal('ornamentBorder'),
    ornament: z.enum(['lines', 'pearls', 'chevron', 'braid']),
    width: z.number().min(0.5).max(12),
  }),
]);
const features = z.object({
  tips: z.enum(['finial', 'diamond', 'none']).optional(),
  corners: z.enum(['diamond', 'star', 'none']).optional(),
});
const param = z.union([z.number(), z.string().max(64), z.boolean()]);

export const RegionSchema: z.ZodType<RegionNode> = z.lazy(() =>
  z.object({
    type: z.literal('region'),
    outline: OutlineSchema,
    size: z.union([z.literal('auto'), z.number().positive().max(2000)]).optional(),
    spread: z.number().min(0.5).max(8).optional(),
    borders: z.array(border).max(12),
    fill: FillerSchema.optional(),
    features: features.optional(),
    style: StyleOverrideSchema.optional(),
  }),
) as z.ZodType<RegionNode>;
export const FillerSchema: z.ZodType<FillerNode> = z.lazy(() =>
  z.discriminatedUnion('type', [
    z.object({
      type: z.literal('lines'),
      text: slotName,
      lineGap: z.number().min(0).max(6),
      minWords: z.number().int().min(1).optional(),
      vary: z.number().min(0).max(1).optional(),
      plait: z.boolean().optional(),
    }),
    z.object({
      type: z.literal('flow'),
      text: slotName,
      lineGap: z.number().min(0).max(6),
      strength: z.number().min(0).max(1).optional(),
    }),
    z.object({
      type: z.literal('maze'),
      text: slotName,
      corridors: z.number().min(0).max(1),
      wall: z.boolean(),
      seed: z.number().int().optional(),
      interlace: z.boolean().optional(),
      plait: z.boolean().optional(),
    }),
    z.object({
      type: z.literal('monogram'),
      text: slotName,
      method: z.enum([
        'mirror',
        'below',
        'quad',
        'pair',
        'pinwheel',
        'pinwheelIn',
        'block',
        'spiral',
        'tughra',
        'seal',
      ]),
      params: z.record(z.string(), param),
    }),
    z.object({ type: z.literal('abjad'), text: slotName }),
    z.object({ type: z.literal('strapwork'), text: slotName, tiling: z.enum(['square', '488', 'hex', '31212']) }),
    z.object({ type: z.literal('lattice'), text: slotName }),
    z.object({ type: z.literal('pattern'), pattern }),
    z.object({ type: z.literal('rings') }),
    z.object({ type: z.literal('vine') }),
    z.object({ type: z.literal('solid') }),
    z.object({ type: z.literal('region'), node: RegionSchema }),
  ]),
) as z.ZodType<FillerNode>;
const spandrels = z.union([FillerSchema, z.object({ type: z.literal('stars') })]);
export const CompositionSchema = z
  .object({
    version: z.literal(1),
    seed: z.number().int().min(1).max(2147483646),
    canvas: z.object({ shape: z.enum(['square', 'portrait', 'landscape']), margin: z.number().min(0).max(20) }),
    style: StyleSchema,
    texts: z.record(
      slotName,
      z.object({
        text: z.string().max(20_000),
        repeat: z.enum(['fill', 'once']),
        wordGap: z.number().int().min(1).max(6),
      }),
    ),
    root: z.object({
      type: z.literal('frame'),
      spandrels: spandrels.optional(),
      child: RegionSchema,
      style: StyleOverrideSchema.optional(),
    }),
  })
  .superRefine((c, ctx) => {
    // every text reference must name a slot
    const check = (name: string, path: (string | number)[]) => {
      if (!(name in c.texts)) ctx.addIssue({ code: 'custom', message: `unknown text slot "${name}"`, path });
    };
    const region = (r: RegionNode, path: (string | number)[]) => {
      r.borders.forEach((b, i) => b.type === 'textBorder' && check(b.text, [...path, 'borders', i, 'text']));
      if (r.fill) filler(r.fill, [...path, 'fill']);
    };
    const filler = (f: FillerNode, path: (string | number)[]) => {
      if ('text' in f) check(f.text, [...path, 'text']);
      if (f.type === 'region') region(f.node, [...path, 'node']);
    };
    region(c.root.child as RegionNode, ['root', 'child']);
    if (c.root.spandrels && c.root.spandrels.type !== 'stars')
      filler(c.root.spandrels as FillerNode, ['root', 'spandrels']);
  });

export class CompositionError extends Error {
  constructor(public issues: { path: string; message: string }[]) {
    super('invalid composition: ' + issues.map(i => `${i.path || '(root)'}: ${i.message}`).join('; '));
  }
}

/** Validate untrusted JSON as a composition (migrating older versions when there are any). */
export function parseComposition(json: unknown): Composition {
  const r = CompositionSchema.safeParse(json);
  if (!r.success) throw new CompositionError(r.error.issues.map(i => ({ path: i.path.join('.'), message: i.message })));
  return r.data as Composition;
}
export const isValidComposition = (json: unknown) => CompositionSchema.safeParse(json).success;
