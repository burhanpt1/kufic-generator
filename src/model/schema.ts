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
/** Thuluth's pen (ignored by Kufi): a calibrated preset, optionally adjusted. Kufi's letter, stroke and terminals
 *  groups do not apply to thuluth, except letter.marks ('all' shows the vowels). */
export interface ThuluthPen {
  /** line: a written line; band: an inscription band; tile: glazed tile (2.5:1 contrast); roundel: painted jali (6:1). */
  preset: 'line' | 'band' | 'tile' | 'roundel';
  /** Nib width (pen units) and angle (degrees). */
  nib?: number;
  angle?: number;
  /** Size of the letter bodies against the stems. */
  body?: number;
  /** Thinnest stroke, as a share of the nib. */
  floor?: number;
  /** Baseline between two joined loop letters (body units). */
  loopGap?: number;
  heh?: 'round' | 'almond' | 'eye';
}
export type ScriptId = 'kufi' | 'thuluth';
export interface Style {
  script: ScriptId;
  /** Thuluth only. */
  pen?: ThuluthPen;
  letter: LetterStyle;
  stroke: {
    kind: 'blocks' | 'curved' | 'pen';
    corner: number;
    weight: number;
    softness: number;
    banded: boolean;
    /** Curved strokes: verticals thinner than horizontals by up to half (0 = even width, the default). */
    contrast?: number;
    /** Curved strokes: free stem ends thin toward their tips (0 = none, the default). */
    taper?: number;
  };
  terminals: {
    kind: 'none' | 'notch' | 'bevel' | 'leaf' | 'palmette';
    reach: 'tall' | 'tails' | 'all';
    /** Curved strokes: leaves sprouting from long free stems, where there is room beside them. */
    flourish?: 'none' | 'sprouts';
  };
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
  /** mg8, mg10, mg12: quasi-periodic rhomb tilings (de Bruijn multigrids) with 8-, 10- and 12-fold symmetry. */
  tiling: 'square' | '488' | 'hex' | '31212' | 'mg8' | 'mg10' | 'mg12';
  /** Contact angle in degrees. */
  angle: number;
  /** Tile edge in cells. */
  scale: number;
}
/** Iznik tilework (the thuluth lab's dressing of a multigrid): cobalt vines, saz leaves and hatayi flowers on a
 *  quasi-periodic rhomb tiling with fold-fold symmetry; scale = rhomb edge in cells. */
export interface IznikSpec {
  fold: 8 | 10 | 12;
  scale: number;
  /** Square ceramic joints drawn over the field. */
  seams?: boolean;
}
export interface Ground {
  kind: 'plain' | 'tint' | 'vine' | 'pattern' | 'iznik';
  pattern?: PatternSpec;
  iznik?: IznikSpec;
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
  /** A gap in cells where a closed ring's text starts and ends, for a text read once (a verse) rather than a band
   *  that repeats; centred where the ring starts. Default: none (the text closes up on itself). */
  seam?: number;
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
  /** A star pattern; with text, its lines are written in the text (the stars outlined in words). */
  | { type: 'pattern'; pattern: PatternSpec; text?: string }
  /** Iznik tilework over the whole space. */
  | { type: 'iznik'; iznik: IznikSpec }
  | { type: 'rings' }
  | { type: 'vine' }
  | { type: 'solid' }
  | { type: 'region'; node: RegionNode }
  /** A thuluth roundel or cartouche: the text arranged to fill an oval, its marks solved, on a gilded field. */
  | {
      type: 'roundel';
      text: string;
      recipe?: RoundelRecipe;
      frame?: boolean;
      colours?: RoundelColours;
      /** Iznik tiles over the space round the cartouche (it sits on them, as on a tile panel). */
      ground?: IznikSpec;
      /** Iznik tiles under the letters, inside the field, washed with the field colour (0–1, default 0.5) so the
       *  letters read; the letters then get a halo in the field colour. */
      fieldTiles?: IznikSpec & { wash?: number };
      /** The rim: a band with a fine inner line (double, the default) or the band alone (single). */
      rim?: 'single' | 'double';
    };

/** How a roundel is made (the thuluth lab's layout recipes): composer options, a pinned layout, hand adjustments. */
export interface RoundelRecipe {
  /** Composer: stems may cross horizontals; words lift onto shelves and into great bowls; kerning; the field's
   *  proportion and fill; an emphasised letter; the reading-order rules. */
  elongate?: boolean;
  cross?: boolean;
  merge?: boolean;
  cradle?: boolean;
  kern?: boolean;
  /** The piece after a ra, zay, waw (or ya) nested in the curve of its tail. */
  nest?: boolean;
  /** The search may stack a piece of a word above the one before it, so words rise in layers. */
  stack?: boolean;
  /** Groups written only with a stacked join where they have one (e.g. 'شمير': the shin above the mim). */
  stackAt?: string[];
  /** Tall stems rise into the empty space above them, up to the oval. */
  rise?: { margin?: number; most?: number; oval?: number };
  /** Tails with the rest of their word nested in them drawn out level beneath it, like a tughra's arms. */
  tails?: { letters?: string; gap?: number; reach?: number; follow?: 'bowl' | 'level' };
  noRise?: boolean;
  ceiling?: boolean;
  topFirst?: boolean;
  fillTarget?: number;
  oval?: number;
  emph?: string;
  tries?: number;
  iters?: number;
  seed?: number;
  /** A recorded arrangement: each group's variant and each word's place. */
  fixed?: { lv: number[]; wp: { x: number; y: number }[]; up?: number[] };
  /** Great gestures: the returning ya (width, depth), the Husayn nun, the long-headed hah. */
  great?: { ya?: boolean; yaWide?: number; yaDeep?: number; nun?: boolean; hah?: boolean };
  tweaks?: {
    at: string;
    scale?: number;
    tint?: string;
    under?: { group: number; gap?: number; dx?: number };
    /** Moved by (dx, dy) pen units after it is placed. */
    move?: [number, number];
  }[];
  /** Redraw a great final bowl along the frame; dotAt places its dots along it (share of the left half, negative to
   *  the right; by default the middle, or the nearest place clear of other dots). */
  bowl?: {
    clear?: number;
    side?: number;
    tailUp?: number;
    lead?: number;
    autoOval?: boolean;
    dotAt?: number;
    free?: boolean;
  };
  /** Marks: how far a vowel may sit from its letter; ornaments in the gaps and their density. */
  markReach?: number;
  ornaments?: boolean;
  density?: number;
  ornStyle?: 'plume' | 'trefoil';
  /** A reading path for the words, read from the top: a named path (line, diagonal, zigzag, bolt, cup, rows2, rows3,
   *  stag2, stag3, calliar1–4, calliar6) or polylines in field coordinates (−1…1, y up), one per stroke. */
  path?: string | [number, number][][];
  /** Fitted lanes (best for many words): level by default (deg 180), their number and spacing fitted to the text. */
  lanes?: { deg?: number; n?: number; bandFrac?: number };
  /** On a path: its length as a share of the text's width, and how far a word may stray from its target. */
  pathFill?: number;
  pathTol?: number;
  /** On a path, the reading rules (across, then downward); on by default. */
  readRule?: boolean;
  /** The rules for the marks from the Arabic sources (on by default): each fatha as long as its space allows (short,
   *  medium, or long with the main pen), and with ornaments a clarifying letter under each of ح س ص ط ع ك م. false
   *  restores the short fatha, no long fatha, and only the small ح and س. */
  fathaRule?: boolean;
  longFatha?: boolean;
  allSigns?: boolean;
}
export interface RoundelColours {
  field?: string;
  letters?: string;
  /** The gilding's highlight across letters and rim (#f0d07a, gold); the letter colour itself for flat white. */
  sheen?: string;
  rim?: string;
  line?: string;
  counters?: string;
}

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
  meem: z.enum(['flat', 'drop']).optional(),
  sad: z.enum(['tall', 'short']).optional(),
  loops: z.enum(['stretch', 'rigid']).optional(),
  set: z.enum(['square', 'fatimid']).optional(),
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
  contrast: z.number().min(0).max(1).optional(),
  taper: z.number().min(0).max(1).optional(),
});
const terminals = z.object({
  kind: z.enum(['none', 'notch', 'bevel', 'leaf', 'palmette']),
  reach: z.enum(['tall', 'tails', 'all']),
  flourish: z.enum(['none', 'sprouts']).optional(),
});
const palette = z.object({ ink: colour, ink2: colour, paper: colour, mark: colour });
const num = z.number().finite();
const roundelRecipe = z
  .object({
    elongate: z.boolean(),
    cross: z.boolean(),
    merge: z.boolean(),
    cradle: z.boolean(),
    kern: z.boolean(),
    nest: z.boolean(),
    stack: z.boolean(),
    stackAt: z.array(z.string().min(1).max(40)).max(20),
    rise: z
      .object({ margin: z.number().min(0).max(10), most: z.number().min(1).max(4), oval: z.number().min(1).max(3) })
      .partial(),
    tails: z
      .object({
        letters: z.string().max(8),
        gap: z.number().min(0).max(6),
        reach: z.number().min(-6).max(10),
        follow: z.enum(['bowl', 'level']),
      })
      .partial(),
    noRise: z.boolean(),
    ceiling: z.boolean(),
    topFirst: z.boolean(),
    fillTarget: z.number().min(0.1).max(0.9),
    oval: z.number().min(1).max(3),
    emph: z.string().max(4),
    tries: z.number().int().min(1).max(40),
    iters: z.number().int().min(0).max(20000),
    seed: z.number().int(),
    fixed: z.object({
      lv: z.array(z.number().int().min(0)).max(200),
      wp: z.array(z.object({ x: num, y: num })).max(100),
      up: z.array(z.number().int().min(0)).max(200).optional(),
    }),
    great: z.object({ ya: z.boolean(), yaWide: num, yaDeep: num, nun: z.boolean(), hah: z.boolean() }).partial(),
    tweaks: z
      .array(
        z.object({
          at: z.string().min(1).max(40),
          scale: z.number().min(0.2).max(2).optional(),
          tint: colour.optional(),
          under: z.object({ group: z.number().int().min(0), gap: num.optional(), dx: num.optional() }).optional(),
          move: z.tuple([z.number().min(-40).max(40), z.number().min(-40).max(40)]).optional(),
        }),
      )
      .max(20),
    bowl: z
      .object({
        clear: num,
        side: num,
        tailUp: num,
        lead: num,
        autoOval: z.boolean(),
        dotAt: z.number().min(-1).max(1),
        free: z.boolean(),
      })
      .partial(),
    markReach: z.number().min(0.5).max(6),
    ornaments: z.boolean(),
    density: z.number().min(0).max(1),
    ornStyle: z.enum(['plume', 'trefoil']),
    path: z.union([
      z.string().max(20),
      z
        .array(
          z
            .array(z.tuple([z.number().min(-2).max(2), z.number().min(-2).max(2)]))
            .min(2)
            .max(40),
        )
        .min(1)
        .max(8),
    ]),
    lanes: z
      .object({
        deg: z.number().min(0).max(360),
        n: z.number().int().min(1).max(6),
        bandFrac: z.number().min(0.2).max(2),
      })
      .partial(),
    pathFill: z.number().min(0.2).max(1.5),
    pathTol: z.number().min(0).max(10),
    readRule: z.boolean(),
    fathaRule: z.boolean(),
    longFatha: z.boolean(),
    allSigns: z.boolean(),
  })
  .partial();
const abjadOpts = z.object({
  taMarbuta: z.union([z.literal(5), z.literal(400)]),
  system: z.enum(['mashriqi', 'maghribi']),
});
const pen = z.object({
  preset: z.enum(['line', 'band', 'tile', 'roundel']),
  nib: z.number().min(0.3).max(4).optional(),
  angle: z.number().min(0).max(90).optional(),
  body: z.number().min(0.8).max(2).optional(),
  floor: z.number().min(0).max(0.8).optional(),
  loopGap: z.number().min(0).max(4).optional(),
  heh: z.enum(['round', 'almond', 'eye']).optional(),
});
const script = z.enum(['kufi', 'thuluth']);
export const StyleSchema = z.object({
  script,
  pen: pen.optional(),
  letter,
  stroke,
  terminals,
  palette,
  colouring: z.enum(['solid', 'byRing', 'byRepeat', 'radial']),
  abjad: abjadOpts,
});
const StyleOverrideSchema = z
  .object({
    script,
    pen: pen.partial(),
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
  tiling: z.enum(['square', '488', 'hex', '31212', 'mg8', 'mg10', 'mg12']),
  angle: z.number().min(10).max(85),
  scale: z.number().min(1).max(30),
});
const iznik = z.object({
  fold: z.union([z.literal(8), z.literal(10), z.literal(12)]),
  scale: z.number().min(1).max(30),
  seams: z.boolean().optional(),
});
const ground = z.object({
  kind: z.enum(['plain', 'tint', 'vine', 'pattern', 'iznik']),
  pattern: pattern.optional(),
  iznik: iznik.optional(),
});
const slotName = z.string().min(1).max(64);
const border = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('textBorder'),
    text: slotName,
    scale: z.union([z.literal('auto'), z.number().min(0.2).max(3)]).optional(),
    taper: z.number().min(0).max(2).optional(),
    separator: separator.optional(),
    seam: z.number().min(0).max(60).optional(),
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
    z.object({ type: z.literal('pattern'), pattern, text: z.string().optional() }),
    z.object({ type: z.literal('iznik'), iznik }),
    z.object({ type: z.literal('rings') }),
    z.object({ type: z.literal('vine') }),
    z.object({ type: z.literal('solid') }),
    z.object({ type: z.literal('region'), node: RegionSchema }),
    z.object({
      type: z.literal('roundel'),
      text: slotName,
      recipe: roundelRecipe.optional(),
      frame: z.boolean().optional(),
      ground: iznik.optional(),
      fieldTiles: iznik.extend({ wash: z.number().min(0).max(1).optional() }).optional(),
      rim: z.enum(['single', 'double']).optional(),
      colours: z
        .object({ field: colour, letters: colour, sheen: colour, rim: colour, line: colour, counters: colour })
        .partial()
        .optional(),
    }),
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
      if ('text' in f && f.text !== undefined) check(f.text, [...path, 'text']);
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
