// Shared engine types. Coordinates follow the conventions in CLAUDE.md.

export type Form = 'iso' | 'ini' | 'med' | 'fin';
/** Glyph rows, top row first, '#' = ink. */
export type Rows = string[];
/** A glyph definition: plain rows, or rows plus the number of rows below the baseline. */
export type GlyphDef = Rows | { rows: Rows; base: number };

export interface LetterVariants {
  ra: 'desc' | 'short' | 'hook';
  ayn: 'open' | 'cup';
  la: 'plain' | 'knot';
}
export type LetterOptions = Partial<LetterVariants>;

/** Bitmap with row 0 at the bottom. */
export interface Bitmap {
  w: number;
  h: number;
  data: Uint8Array;
  base: number;
}

/** Cell grid, y down. data: 1 letter, 2 vowel, 3 dot, 4 stem terminal; tag: repeat index + 1; ring: ring index + 1. */
export interface Grid {
  w: number;
  h: number;
  data: Uint8Array;
  tag: Uint8Array;
  ring: Uint8Array;
}

/** A justified line, x left to right, y up from the bottom of the band. */
export interface Strip {
  W: number;
  data: Uint8Array;
  tag: Uint8Array;
}

export interface Letter {
  c: string;
  marks: string[];
  ax?: number | null;
}
export interface Unit {
  key: string;
  canPrev: boolean;
  canNext: boolean;
  parts: Letter[];
  jp?: boolean;
  jn?: boolean;
  form: Form;
}
export interface Shaped {
  words: Unit[][];
  unsupported: string[];
}

export type MarksMode = 'off' | 'dots' | 'all';
export type VowelStyle = 'modern' | 'early';

/** A glyph composited to the band height, with its stretchable and tall-stem columns. */
export interface BandGlyph {
  w: number;
  data: Uint8Array;
  form: Form;
  str: { c: number; w: number }[];
  tall: number[];
  /** A long alternate the justifier may use instead (same band). */
  alt?: BandGlyph;
}
export interface Word {
  glyphs: BandGlyph[];
  seps: ('join' | 'gap')[];
}
export interface Seg extends Word {
  endsWord: boolean;
  minW: number;
  rep?: number;
}
/** A list of segments carrying the word gap used to measure it. */
export type Segs = Seg[] & { wg?: number };

export type Center = 'abjad' | 'letters' | 'geo' | 'squares' | 'solid' | 'none';

export interface ComposeOptions extends LetterOptions {
  text: string;
  layout: 'rings' | 'circle' | 'line';
  size?: number;
  H: number;
  wordGap: number;
  rotation?: number;
  center: Center;
  rings: number;
  marks?: MarksMode;
  vowels?: VowelStyle;
  repeat?: boolean;
  terminals?: 'none' | 'asc' | 'tails' | 'all';
  gap?: number;
  taper?: number;
  centre?: number;
  rhythm?: boolean;
  cornerBlocks?: boolean;
}

export interface ComposeInfo {
  unsupported: string[];
  rings: number;
  empty: boolean;
  gap: number;
  abjad: number;
  lines: number;
  band?: number;
  size?: number;
  rep?: number;
  tooBig?: boolean;
}

export interface SquareRing {
  grid: Grid;
  off: number;
  scale: number;
  ring: number;
  corners: { x: number; y: number; s: number }[];
  Hb: number;
}
export interface CircleRing {
  data: Uint8Array;
  tag: Uint8Array;
  W: number;
  N: number;
  Hb: number;
  Rout: number;
  scale: number;
  ring: number;
}
export interface Centre {
  type: Center;
  r?: number;
  o?: number;
  C?: number;
  emblem?: CircleRing | { grid: Grid; scale: number; Hb: number };
}

export type ComposeResult =
  | { kind: 'empty'; info: ComposeInfo }
  | { kind: 'grid'; grid: Grid; bands: { kind: 'line' }[]; info: ComposeInfo }
  | {
      kind: 'square' | 'circle';
      size: number;
      R: number | null;
      rotation: number;
      rings: (SquareRing | CircleRing)[];
      centre: Centre;
      bands: Record<string, number>[];
      rules: Record<string, number>[];
      info: ComposeInfo;
    };
