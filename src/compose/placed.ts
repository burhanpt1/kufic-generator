// Placed: the resolved composition, renderer-agnostic and serialisable (COMPOSITION_ENGINE.md §3.3). Coordinates are
// in cells, centred on the region's outline; canvas.origin is where that centre sits on the canvas.
import type { Pt } from '../geometry/types';
import type { IznikSpec, PatternSpec, RoundelColours, SeparatorKind, Style } from '../model/schema';
import type { CellStrip, Strip } from '../script/types';

/** Where a strip goes: strip (x, y) in cells -> canvas. y runs from the band's outer edge inward. */
export type StripPlace =
  /** Straight edge: O + (x·t + y·n)·s. */
  | { type: 'line'; O: Pt; t: Pt; n: Pt; s: number }
  /** Curved run: the point at arc length off + x·sx along pts, moved y·s along the inward normal. */
  | { type: 'run'; pts: Pt[]; cum: number[]; off: number; sx: number; s: number }
  /** Full circle: angle π/2 + rot + 2π(N − x)/N, radius (R − y)·s; R in strip cells. Text starts at the bottom, clockwise. */
  | { type: 'arc'; C: Pt; R: number; N: number; s: number; rot: number };

/** A cell grid (monogram, maze), y down, placed with its top-left at `at` and `cell` canvas units per cell. */
export interface PlacedGrid {
  w: number;
  h: number;
  data: Uint8Array;
}

/** Areas are lists of closed rings combined even-odd (a band is its outer ring plus its inner ring). */
export type Area = Pt[][];

export type PlacedItem =
  | {
      type: 'ground';
      style: number;
      kind: 'tint' | 'vine' | 'pattern';
      index: number;
      area: Area;
      pattern?: PatternSpec;
      centre: Pt;
      radius: number;
    }
  | {
      type: 'spandrels';
      style: number;
      kind: 'pattern' | 'vine' | 'solid' | 'tint';
      area: Area;
      pattern?: PatternSpec;
      centre: Pt;
      radius: number;
    }
  | { type: 'star'; style: number; centre: Pt; r: number }
  | { type: 'strip'; style: number; strip: Strip; place: StripPlace; ring: number }
  | { type: 'grid'; style: number; grid: PlacedGrid; at: Pt; cell: number; colour: 'ink' | 'accent'; ring: number }
  | { type: 'separator'; style: number; kind: SeparatorKind; path: Pt[]; width: number; circle?: { C: Pt; r: number } }
  | { type: 'finial'; style: number; p: Pt; bisector: Pt; phi: number; length: number; size: number }
  | { type: 'diamond'; style: number; p: Pt; r: number }
  | { type: 'abjad'; style: number; value: number; centre: Pt; maxW: number; maxH: number; frame: Pt[] | null }
  | { type: 'pattern'; style: number; area: Area; pattern: PatternSpec; centre: Pt; radius: number; strength: number }
  | { type: 'fill'; style: number; kind: 'solid' | 'vine'; area: Area }
  /** Iznik tilework over an area, symmetric about centre, reaching radius. */
  | { type: 'tilework'; style: number; area: Area; centre: Pt; radius: number; iznik: IznikSpec }
  | { type: 'rule'; style: number; path: Pt[]; width: number; colour: 'accent' | 'ink' }
  /** A region's outline and the space left inside its borders (not drawn; for clipping and layering effects). */
  | { type: 'outline'; style: number; outer: Pt[]; inner: Pt[] | null }
  /** Edges of interlaced ribbons: open polylines (broken where a ribbon passes under another). */
  | { type: 'ribbon'; style: number; paths: Pt[][]; width: number; pen?: boolean }
  /** A thuluth roundel: its drawing scaled by s (canvas cells per unit) about centre, framed by a gilded rim. */
  | ({
      type: 'roundel';
      style: number;
      centre: Pt;
      s: number;
      framed: boolean;
      colours: Required<RoundelColours>;
      /** Tiles under the letters, and the rim's form. */
      fieldTiles?: IznikSpec & { wash?: number };
      rimStyle?: 'single' | 'double';
    } & RoundelDrawing);

/** A roundel's drawing in its own units (pen units, y down, centred on the oval), ready to scale onto the canvas. */
export interface RoundelDrawing {
  oval: number;
  /** Field radius (vertical) and rim width. */
  Rf: number;
  rim: number;
  /** Ink as path data: the untinted letters and marks, then each tint. */
  ink: string;
  tints: { colour: string; d: string }[];
  counters: string;
  /** Marks placed / missing, and ornaments, for the meta. */
  marks: number;
  missing: number;
  /** For the critic: how far the great bowl had to grow, the words' overlap, tails drawn out, distinct levels. */
  grow: number;
  overlap: number;
  tails: number;
  levels: number;
  /** Stacked pieces out of reading order (0: none). */
  order: number;
}

/** Draw order, back to front. */
export const LAYER_ORDER = ['ground', 'pattern', 'spandrels', 'letters', 'separators', 'features'] as const;
export type Layer = (typeof LAYER_ORDER)[number];
export const layerOf = (it: PlacedItem): Layer =>
  it.type === 'ground' || it.type === 'fill' || it.type === 'tilework'
    ? 'ground'
    : it.type === 'pattern'
      ? 'pattern'
      : it.type === 'spandrels'
        ? 'spandrels'
        : it.type === 'strip' ||
            it.type === 'grid' ||
            it.type === 'abjad' ||
            it.type === 'rule' ||
            it.type === 'roundel'
          ? 'letters'
          : it.type === 'separator' || it.type === 'ribbon'
            ? 'separators'
            : 'features';

export interface BorderMeta {
  slot: string;
  /** Rings this border produced (one per line of its text). */
  rings: {
    /** Letter scale and whole repeats of the text. */
    scale: number;
    rep: number;
    /** Text segments in one pass, and per group (run) in reading order. */
    segsPerRep: number;
    groupSizes: number[];
    /** Run index (counter-clockwise from the first run) each group sits on. */
    groupRun: number[];
    mode: 'words' | 'breaks';
    Hb: number;
    /** Stretched cells / natural width, over the whole ring. */
    slack: number;
    strips: number[];
  }[];
}
export interface Placed {
  version: 1;
  seed: number;
  canvas: { w: number; h: number; origin: Pt };
  /** Resolved styles referenced by items (index). */
  styles: Style[];
  items: PlacedItem[];
  meta: {
    size: number;
    outline: Pt[];
    borders: BorderMeta[];
    fill: { type: string; scale?: number; ok: boolean; note?: string; metrics?: Record<string, number> } | null;
    /** Free centre: sqrt(inner area / outline area) of the root region after its borders. */
    inner: number;
    warnings: string[];
  };
}
export type { CellStrip };
