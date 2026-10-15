// The script engine interface (COMPOSITION_ENGINE.md §4): everything letter-specific sits behind it, so a cursive
// engine can later replace Kufi for borders and line fills.
import type { Shaped } from '../types';

export interface LetterStyle {
  ascenders: number;
  ra: 'desc' | 'short' | 'hook';
  ayn: 'open' | 'cup';
  lamAlif: 'plain' | 'knot';
  /** Final م with its tail on the line ('flat') or dropped below it (absent = 'drop'). */
  meem?: 'flat' | 'drop';
  /** Initial and medial ص ض with a tall or a short tooth after the loop (absent = 'short'). */
  sad?: 'tall' | 'short';
  /** Justification may widen the small loops of م و ف ق ه ('stretch') or not ('rigid'); absent = 'rigid'. */
  loops?: 'stretch' | 'rigid';
  /** Letter set: 'square' (absent) or 'fatimid'. */
  set?: 'square' | 'fatimid';
  marks: 'off' | 'dots' | 'all';
  vowels: 'modern' | 'early';
  /** Long alternates of final letters, used where a line has room (off when absent). */
  alternates?: boolean;
}

/** One unbreakable piece of text for the partition solver, with its natural width in cells. */
export interface Segment {
  minW: number;
  endsWord: boolean;
  /** Repeat index when the text is repeated (0 for the first pass). */
  rep?: number;
}
/** A list of segments and the word gap used to measure it. */
export type Segments<S extends Segment = Segment> = S[] & { wg?: number };

/** A justified line, x left to right (text reads right to left), y from the band's outer edge inward. */
export type Strip = CellStrip | VectorStrip;
export interface CellStrip {
  kind: 'cells';
  W: number;
  /** Band height in cells, and the baseline row. */
  Hb: number;
  base: number;
  /** W × Hb cells, row 0 first: 1 letter, 2 vowel, 3 dot, 4 stem terminal. */
  data: Uint8Array;
  /** Repeat index + 1 per cell. */
  tag: Uint8Array;
}
/** Reserved for a future cursive engine: outlines in strip units. */
export interface VectorStrip {
  kind: 'vector';
  W: number;
  Hb: number;
  base: number;
  paths: { d: string; role: 'letter' | 'mark' | 'vowel'; tag: number }[];
}

export interface Prepared {
  /** Engine-specific word data. */
  words: unknown[];
  Hb: number;
  base: number;
  ascenders: number;
}

export interface LayoutOptions {
  /** The strip closes on itself (a full circle), so stem rhythm wraps around. */
  wrap: boolean;
  rhythm: boolean;
  wordGap: number;
  /** Which stem tops to mark for floriated endings. */
  terminals: 'none' | 'tall' | 'tails' | 'all';
  /** Plait neighbouring tall stems (Fatimid style); needs ascenders of 9 or more. */
  plait?: boolean;
}

export interface ScriptEngine {
  id: string;
  shape(text: string, style: LetterStyle): Shaped;
  prepare(shaped: Shaped, style: LetterStyle): Prepared;
  /** Prepare several lines together so they share one band height (one ring per line). */
  prepareLines(lines: string[], style: LetterStyle): Prepared[];
  /** 'words' keeps words whole; 'breaks' also allows breaks inside words (after non-joining letters). */
  segments(prepared: Prepared, mode: 'words' | 'breaks', wordGap: number): Segments;
  /** Justify segments to exactly `width` cells (null = natural width). null if they don't fit. */
  layout(segments: Segments, prepared: Prepared, width: number | null, opts: LayoutOptions): Strip | null;
  /** Abjad value of the text. */
  abjad(text: string, opts?: { taMarbuta?: 5 | 400; system?: 'mashriqi' | 'maghribi' }): number;
  /** Grid-based extras; a cursive engine may not support these, and fillers must check. */
  capabilities: { grid: boolean; seals: boolean; mazes: boolean };
}
