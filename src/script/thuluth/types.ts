// Thuluth: a pen-stroke engine (prototypes/thuluth-lab, HANDOVER.md). Letters are skeletons, short lists of control
// points, drawn with a broad nib held at a fixed angle; thick and thin come from the angle alone. Units are pen units
// (the alif is 10 tall at BODY 1), y up, baseline y = 0.

/** A control point: x, y, relative width (default 1) and corner (1 breaks the curve there). */
export type SkelPt = readonly [x: number, y: number, w?: number, corner?: number];
export interface StrokeDef {
  pts: readonly SkelPt[];
  /** Nib angle for this stroke (tall stems use 38°); the line's pen angle otherwise. */
  ang?: number;
  /** Slants with the writing (style.slant). */
  lean?: boolean;
}
export interface GlyphDef {
  s: readonly StrokeDef[];
  /** Where the connection leaves on the left (x), or null if the letter does not join onwards. */
  exit: number | null;
  /** Centre of the letter's dots (x), when it differs from the default. */
  dotX?: number | null;
}
export type Source = 'hand' | 'learned' | 'master';
export interface LetterForm extends GlyphDef {
  src: Source;
}
export type Form = 'ini' | 'med' | 'fin' | 'iso';
export type Family =
  | 'alif' | 'lam' | 'tooth' | 'sin' | 'mim' | 'ha' | 'ra' | 'hah' | 'nun' | 'dal' | 'waw' | 'kaf' | 'ain' | 'fa' | 'qaf'
  | 'sad' | 'ta' | 'ya' | 'lamalif'; // prettier-ignore
export type LetterTable = Record<Family, Partial<Record<Form, LetterForm>>>;

/** Everything the lab kept in globals, as one explicit style. */
export interface ThuluthStyle {
  /** Body scale of the non-stem letters (lab BODY): 1.25 lines, 1.35 bands, 1.45 roundels. */
  body: number;
  /** Nib width in pen units, and its angle in degrees (69° measured from the Topkapı tile bands). */
  nib: number;
  ang: number;
  /** Minimum stroke thickness as a fraction of the nib (lab NIB_FLOOR): 0.43 tile, 0.3 roundel, 0 none. */
  floor: number;
  /** Baseline between two joined loop letters, in body units (lab LOOP_GAP). */
  loopGap: number;
  /** Curve tension (lab CR_T): 0.5 is Catmull-Rom. */
  tension: number;
  /** Final heh design. */
  heh: 'round' | 'almond' | 'eye';
  /** Slant of leaning stems: a factor, or left (−0.06), right (0.14), none. */
  slant: number | 'left' | 'right' | 'none';
  /** The lab's letters exactly, without the later legibility fixes (fixes.ts), to compare with the lab. */
  labLetters?: boolean;
  /** Great roundel gestures (lab useGreat): the Husayn bowl as final nun or a returning ya, the long-headed hah. */
  great?: { nun?: boolean; hah?: boolean; ya?: boolean; yaWide?: number; yaDeep?: number };
}

/** A point on a sampled stroke; rot turns the nib (a pen following a curve). */
export interface Sample {
  x: number;
  y: number;
  w: number;
  rot?: number;
}
/** A sampled stroke, ready for the nib. */
export interface Stroke {
  ang: number;
  /** Nib width override (marks and the Allah sign use a finer pen). */
  nib?: number;
  s: Sample[];
  raw?: [number, number][];
  tint?: string;
  mark?: boolean;
  /** An ornament set in a gap (not a vowel or a sign): it fills what space is left, and does not size the field. */
  orn?: boolean;
  /** Which letter drew each sample: its index in the word (-1 for a join, a kashida or a stacked join's descent), so
   *  checks and crossings can tell letters apart within one continuous stroke. Absent on marks. */
  own?: number[];
  /** The word the stroke belongs to (its index in the line). */
  wi?: number;
}
/** A polygon, as a flat list of points. */
export type Poly = [number, number][];
