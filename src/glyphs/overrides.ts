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
let OVR: Record<string, Rows | undefined> = {}; // user glyph edits: 'KEY.form' -> rows
let epoch = 0;
/** Changes whenever the glyph edits change, for caches keyed on letter shapes. */
export const glyphEpoch = () => epoch;

export function setVariants(opts: LetterOptions) {
  V.ra = opts.ra || 'desc';
  V.ayn = opts.ayn || 'cup';
  V.la = opts.la || 'plain';
  V.meem = opts.meem || 'drop';
  V.sad = opts.sad || 'short';
  V.loops = opts.loops || 'rigid';
  V.set = opts.set || 'square';
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
  if (o) {
    const b = baseDef(key, form);
    return Array.isArray(b) ? o : { rows: o, base: b.base };
  }
  return baseDef(key, form);
}

export function getRows(key: string, form: Form, opts: LetterOptions = {}): Rows {
  setVariants(opts);
  const d = def(key, form);
  return (Array.isArray(d) ? d : d.rows).slice();
}
export function setOverrides(o: Record<string, Rows | undefined>) {
  OVR = { ...o };
  epoch++;
  clearBitmapCache();
}

/** The long alternate of a letter form, if it has one. */
export const altDef = (key: string, form: Form): GlyphDef | null =>
  (V.set === 'fatimid' ? FATIMID_ALTS[key]?.[form] : undefined) ?? ALTS[key]?.[form] ?? null;
/** Where marks above a letter form centre, when not its middle column (per the active letter set). */
export const anchorOf = (key: string): Partial<Record<Form, number>> | undefined =>
  (V.set === 'fatimid' && FATIMID_ANCHOR[key]) || ANCHOR[key];
