// Which script engine a style asks for (style.script), built once per distinct pen.
import type { Style, ThuluthPen } from '../model/schema';
import { kufi } from './kufi';
import { thuluthScript } from './thuluth/adapter';
import { DEFAULT_THULUTH, ROUNDEL_PEN, TILE_PEN } from './thuluth/engine';
import type { ThuluthStyle } from './thuluth/types';
import type { ScriptEngine } from './types';

/** The lab's calibrated pens (HANDOVER §5): lines 0.95–1.1, bands 1.3, roundels 1.35–1.6; tile and roundel contrast. */
export const PEN_PRESETS: Record<ThuluthPen['preset'], ThuluthStyle> = {
  line: { ...DEFAULT_THULUTH, body: 1.25, nib: 1.05, ang: 69, floor: 0.3, loopGap: 0.9 },
  band: { ...DEFAULT_THULUTH, body: 1.35, nib: 1.3, ang: 69, floor: 0.43, loopGap: 0.9 },
  tile: TILE_PEN,
  roundel: ROUNDEL_PEN,
};

/** The thuluth style for a pen: its preset with any adjustments. */
export function thuluthStyleOf(pen?: Partial<ThuluthPen>): ThuluthStyle {
  const base = PEN_PRESETS[pen?.preset ?? 'band'];
  return {
    ...base,
    nib: pen?.nib ?? base.nib,
    ang: pen?.angle ?? base.ang,
    body: pen?.body ?? base.body,
    floor: pen?.floor ?? base.floor,
    loopGap: pen?.loopGap ?? base.loopGap,
    heh: pen?.heh ?? base.heh,
  };
}

const engines = new Map<string, ScriptEngine>();
/** The engine for a style. Thuluth engines are cached per pen (each keeps a cache of built words). */
export function scriptFor(style: Pick<Style, 'script' | 'pen'>): ScriptEngine {
  if (style.script !== 'thuluth') return kufi;
  const st = thuluthStyleOf(style.pen),
    k = JSON.stringify(st);
  let e = engines.get(k);
  if (!e) {
    e = thuluthScript(st);
    engines.set(k, e);
  }
  return e;
}
