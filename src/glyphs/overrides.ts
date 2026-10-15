// The engine's mutable glyph state: active letter variants and the user's glyph edits.
import type { Form, GlyphDef, LetterOptions, LetterVariants, Rows } from '../types';
import { ALTS, D, LAMALEF_KNOT, VARIANTS } from './tables';
import { clearBitmapCache } from './bitmap';

/** Active letter variants. compose(), alphabet() and getRows() set these before drawing. */
export const V: LetterVariants = { ra: 'desc', ayn: 'cup', la: 'plain', meem: 'flat', sad: 'tall', loops: 'stretch' };
let OVR: Record<string, Rows | undefined> = {}; // user glyph edits: 'KEY.form' -> rows
let epoch = 0;
/** Changes whenever the glyph edits change, for caches keyed on letter shapes. */
export const glyphEpoch = () => epoch;

export function setVariants(opts: LetterOptions) {
  V.ra = opts.ra || 'desc';
  V.ayn = opts.ayn || 'cup';
  V.la = opts.la || 'plain';
  V.meem = opts.meem || 'flat';
  V.sad = opts.sad || 'tall';
  V.loops = opts.loops || 'stretch';
}

export function baseDef(key: string, form: Form): GlyphDef {
  if (key === 'REH') {
    const g = VARIANTS.ra[V.ra];
    return (g[form] || g.iso)!;
  }
  if (key === 'LAMALEF' && V.la === 'knot') return LAMALEF_KNOT.iso;
  if (key === 'MEEM' && (form === 'fin' || form === 'iso')) return VARIANTS.meem[V.meem ?? 'flat'];
  if (key === 'SAD' && (form === 'ini' || form === 'med')) return VARIANTS.sad[V.sad ?? 'tall'];
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
export const altDef = (key: string, form: Form): GlyphDef | null => ALTS[key]?.[form] ?? null;
