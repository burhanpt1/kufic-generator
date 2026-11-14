// The engine's mutable glyph state: active letter variants and the user's glyph edits.
import type { Form, GlyphDef, LetterOptions, LetterVariants, Rows } from '../types';
import { ALTS, ANCHOR, D, FATIMID, FATIMID_ALTS, FATIMID_ANCHOR, LAMALEF_KNOT, VARIANTS } from './tables';
import { clearBitmapCache } from './bitmap';

/** Active letter variants. compose(), alphabet() and getRows() set these before drawing. */
export const V: LetterVariants = {
  ra: 'desc',
  ayn: 'cup',
  la: 'plain',
  meem: 'drop',
  sad: 'short',
  loops: 'rigid',
  set: 'square',
};
/** A user glyph edit: the rows with the baseline they were drawn on ({ rows, base }, base = rows below the
 *  baseline), or rows alone (the format before the baseline was stored), which take the baseline of whichever
 *  variant is active. */
export type GlyphOverride = Rows | { rows: Rows; base: number };
let OVR: Record<string, GlyphOverride | undefined> = {}; // user glyph edits: 'KEY.form' -> override
let epoch = 0;
/** Changes whenever the glyph edits change, for caches keyed on letter shapes. */
export const glyphEpoch = () => epoch;

/** The values each variant takes, its default first. */
const CHOICES: { [K in keyof LetterVariants]-?: readonly NonNullable<LetterVariants[K]>[] } = {
  ra: ['desc', 'short', 'hook'],
  ayn: ['cup', 'open'],
  la: ['plain', 'knot'],
  meem: ['drop', 'flat'],
  sad: ['short', 'tall'],
  loops: ['rigid', 'stretch'],
  set: ['square', 'fatimid'],
};
/** A variant's value, or its default when it is missing or not one of its choices (a stale link, a typo). */
const pick = <K extends keyof LetterVariants>(k: K, v: unknown): NonNullable<LetterVariants[K]> =>
  ((CHOICES[k] as readonly unknown[]).includes(v) ? v : CHOICES[k][0]) as NonNullable<LetterVariants[K]>;

export function setVariants(opts: LetterOptions) {
  V.ra = pick('ra', opts.ra);
  V.ayn = pick('ayn', opts.ayn);
  V.la = pick('la', opts.la);
  V.meem = pick('meem', opts.meem);
  V.sad = pick('sad', opts.sad);
  V.loops = pick('loops', opts.loops);
  V.set = pick('set', opts.set);
}

export function baseDef(key: string, form: Form): GlyphDef {
  if (V.set === 'fatimid') {
    const f = FATIMID[key];
    // a set with only an isolated form uses it for the final too (the letter joins only from the right)
    const d = f?.[form] ?? (form === 'fin' ? f?.iso : undefined);
    if (d && !(key === 'LAMALEF' && V.la === 'knot')) return d;
  }
  if (key === 'REH') {
    const g = VARIANTS.ra[V.ra];
    return (g[form] || g.iso)!;
  }
  if (key === 'LAMALEF' && V.la === 'knot') return LAMALEF_KNOT.iso;
  if (key === 'MEEM' && (form === 'fin' || form === 'iso')) return VARIANTS.meem[V.meem ?? 'drop'];
  if (key === 'SAD' && (form === 'ini' || form === 'med')) return VARIANTS.sad[V.sad ?? 'short'];
  if (key === 'AIN') {
    const g = VARIANTS.ayn[V.ayn];
    return (g[form] || (form === 'iso' ? g.fin : g.ini))!;
  }
  return D[key][form];
}
export function def(key: string, form: Form): GlyphDef {
  const o = OVR[key + '.' + form];
  if (Array.isArray(o)) {
    // rows alone: the baseline of the active variant
    const b = baseDef(key, form);
    return Array.isArray(b) ? o : { rows: o, base: b.base };
  }
  if (o && Array.isArray(o.rows)) return { rows: o.rows, base: o.base || 0 };
  return baseDef(key, form);
}
/** The override to store for an edit of a letter form drawn under the given variants: the rows with the baseline
 *  of the glyph they replace, so the edit sits the same under every variant. */
export function overrideFor(key: string, form: Form, rows: Rows, opts: LetterOptions = {}): GlyphOverride {
  setVariants(opts);
  const b = baseDef(key, form);
  return { rows: rows.slice(), base: Array.isArray(b) ? 0 : b.base };
}

export function getRows(key: string, form: Form, opts: LetterOptions = {}): Rows {
  setVariants(opts);
  const d = def(key, form);
  return (Array.isArray(d) ? d : d.rows).slice();
}
export function setOverrides(o: Record<string, GlyphOverride | undefined>) {
  OVR = { ...o };
  epoch++;
  clearBitmapCache();
}

/** The long alternate of a letter form, if it has one. The long م drops its tail below the line, so a flat م (chosen
 *  to keep it on the line) has none. */
export const altDef = (key: string, form: Form): GlyphDef | null =>
  key === 'MEEM' && V.meem === 'flat'
    ? null
    : ((V.set === 'fatimid' ? FATIMID_ALTS[key]?.[form] : undefined) ?? ALTS[key]?.[form] ?? null);
/** Where marks above a letter form centre, when not its middle column (per the active letter set). */
export const anchorOf = (key: string): Partial<Record<Form, number>> | undefined =>
  (V.set === 'fatimid' && FATIMID_ANCHOR[key]) || ANCHOR[key];
