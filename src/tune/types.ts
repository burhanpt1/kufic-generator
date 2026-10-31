// Messages between the tuning page and its worker.
import type { Layout } from '../script/thuluth/roundel';

/** How the marks are finished: ornaments in the gaps (and how many), the vowels, and a clearance round each mark. */
export interface TuneFrame {
  ornaments: boolean;
  density: number;
  vowels: boolean;
  clearance: number;
}
/** A roundel (circle) or the words on one baseline (line), drawn without a frame. */
export type TuneShape = 'circle' | 'line';
/** What the page edits and saves. */
export interface TuneState {
  shape?: TuneShape;
  layout: Layout;
  frame: TuneFrame;
}
export type TuneRequest =
  { id: number; kind: 'init' } | { id: number; kind: 'draw'; shape: TuneShape; layout: Layout; frame: TuneFrame };
export interface TunePiece {
  s: string;
  word: number;
  /** The first piece of its word (it cannot be lifted onto the one before). */
  first: boolean;
  /** Each variant drawn on its own: a path in a w × h box, y down, and what kind it is. */
  variants: { d: string; w: number; h: number; label: string }[];
}
export interface TuneInit {
  pieces: TunePiece[];
}
export interface TuneDraw {
  svg: string;
  /** Each piece's box on the drawing, in the SVG's own units. */
  boxes: { x0: number; y0: number; x1: number; y1: number }[];
  ms: number;
}
