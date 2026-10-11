// The engine's mutable glyph state: active letter variants and the user's glyph edits.
import type { Form, GlyphDef, LetterOptions, LetterVariants, Rows } from '../types';
import { D, LAMALEF_KNOT, VARIANTS } from './tables';
import { clearBitmapCache } from './bitmap';

/** Active letter variants. compose(), alphabet() and getRows() set these before drawing. */
export const V: LetterVariants = { ra: 'desc', ayn: 'open', la: 'plain' };
let OVR: Record<string, Rows | undefined> = {}; // user glyph edits: 'KEY.form' -> rows

export function setVariants(opts: LetterOptions) {
  V.ra = opts.ra || 'desc';
  V.ayn = opts.ayn || 'open';
  V.la = opts.la || 'plain';
}

export function baseDef(key: string, form: Form): GlyphDef {
  if (key === 'REH') {
    const g = VARIANTS.ra[V.ra];
    return (g[form] || g.iso)!;
  }
  if (key === 'LAMALEF' && V.la === 'knot') return LAMALEF_KNOT.iso;
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
  clearBitmapCache();
}
