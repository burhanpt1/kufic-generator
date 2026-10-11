// Every user-facing option as one plain object, so a composition can be saved, shared and restored.
import type { Lookup, State } from './controls';
import { SEGS, setSeg } from './controls';

const VALUES = ['text', 'asc', 'gap', 'weight', 'soft', 'rings', 'taper', 'centreSize', 'geoAngle', 'geoScale'];
const CHECKS = ['grid', 'contrast', 'repeat', 'rhythm'];

/** Option name -> value: segmented choices and sliders as strings, checkboxes as booleans, palette as a number. */
export type Settings = Record<string, string | number | boolean | Record<string, string[]>>;

export function readSettings($: Lookup, state: State): Settings {
  const s: Settings = {};
  for (const k of SEGS) s[k] = state[k];
  s.rot = state.rotation;
  s.palette = state.palette;
  for (const id of VALUES) s[id] = $(id).value;
  for (const id of CHECKS) s[id] = $(id).checked;
  const ovr = Object.fromEntries(Object.entries(state.ovr).filter(([, v]) => v)) as Record<string, string[]>;
  if (Object.keys(ovr).length) s.glyphs = ovr;
  return s;
}

/** Only the entries that differ from base. */
export function diffSettings(s: Settings, base: Settings): Settings {
  const out: Settings = {};
  for (const k in s) if (JSON.stringify(s[k]) !== JSON.stringify(base[k])) out[k] = s[k];
  return out;
}

/** Set the controls and state from (possibly partial, possibly untrusted) settings. Unknown or invalid values are ignored. */
export function applySettings($: Lookup, state: State, s: Settings) {
  const has = (id: string, v: unknown) =>
    [...$(id).children].some(
      c => (c as HTMLElement).dataset.v === String(v) && (c as HTMLElement).style.visibility !== 'hidden',
    );
  for (const k of SEGS) if (typeof s[k] === 'string' && has(k, s[k])) setSeg($, state, k, k, s[k] as string);
  if (has('rot', s.rot)) {
    state.rotation = Number(s.rot);
    [...$('rot').children].forEach(c =>
      c.setAttribute('aria-pressed', String((c as HTMLElement).dataset.v === String(s.rot))),
    );
  }
  const nPal = $('swatches').children.length;
  if (Number.isInteger(s.palette) && (s.palette as number) >= 0 && (s.palette as number) < nPal) {
    state.palette = s.palette as number;
    [...$('swatches').children].forEach((c, j) => c.setAttribute('aria-pressed', String(j === state.palette)));
  }
  for (const id of VALUES) if (typeof s[id] === 'string') $(id).value = s[id] as string;
  for (const id of CHECKS) if (typeof s[id] === 'boolean') $(id).checked = s[id] as boolean;
  const g = s.glyphs;
  if (g && typeof g === 'object')
    state.ovr = Object.fromEntries(
      Object.entries(g).filter(([, rows]) => Array.isArray(rows) && rows.every(r => typeof r === 'string')),
    );
}
