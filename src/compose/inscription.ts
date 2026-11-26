// Text along a straight segment: an inscription on a wall, a lintel, the edge of a panel. The same fitting as a
// border's side (whole repeats, least stretching, words kept whole where they can be), without a region round it.
import type { Frame, Pt, Run } from '../geometry/types';
import { makeRun } from '../geometry/runs';
import type { Style } from '../model/schema';
import { scriptFor } from '../script/registry';
import type { ScriptEngine } from '../script/types';
import type { Placed, PlacedItem } from './placed';
import { bandRoom, layoutOpts } from './resolve';
import { fitRing, layRing } from './textBorder';
import type { BandGeom } from './textBorder';

export interface Inscription {
  text: string;
  /** The segment, in cells. The text reads right to left for someone facing it with `from` on their left and `to`
   *  on their right; the letters rise to their left of the direction from → to (up, for a segment drawn left to
   *  right on the page). A level segment drawn the other way is turned upright, as the top band of a frame is. */
  from: Pt;
  to: Pt;
  /** Letter scale. Default: what `depth` allows, or 1. */
  scale?: number;
  /** Depth of the band in cells (a wall's thickness): the letters are sized to fill it. */
  depth?: number;
  /** 'fill' repeats the text whole to fill the length (the default); 'once' writes it one time. */
  repeat?: 'fill' | 'once';
  wordGap?: number;
  /** The segment is the letters' foot line ('base'), or runs through the middle of the band (the default). */
  align?: 'middle' | 'base';
  /** Colour key for "by ring" colouring. */
  ring?: number;
}

export interface Inscribed {
  items: PlacedItem[];
  scale: number;
  rep: number;
  /** Share of the length left to stretching. */
  slack: number;
  /** The band's depth in cells at this scale. */
  depth: number;
}

const END: (f: Frame) => Run['start'] = f => ({
  index: -1,
  p: f.p,
  interior: Math.PI / 2,
  convex: true,
  bisector: f.n,
  clearance: 0,
});

/** Lay one inscription; null when the text doesn't fit the segment. `sid` is the style's index in the Placed the
 *  items are for. */
export function inscribe(ins: Inscription, style: Style, sid: number, script?: ScriptEngine): Inscribed | null {
  const eng = script ?? scriptFor(style),
    p = eng.prepareLines([ins.text], style.letter)[0];
  if (!p) return null;
  const room = bandRoom(p, style),
    s = ins.scale ?? (ins.depth ? ins.depth / room : 1),
    dx = ins.to[0] - ins.from[0],
    dy = ins.to[1] - ins.from[1],
    len = Math.hypot(dx, dy);
  if (!(len > 0) || !(s > 0)) return null;
  const t: Pt = [dx / len, dy / len],
    n: Pt = [t[1], -t[0]],
    // the band's outer line: the segment itself, or half the band's depth behind it
    back = (ins.align ?? 'middle') === 'middle' ? (room * s) / 2 : 0,
    a: Pt = [ins.from[0] - n[0] * back, ins.from[1] - n[1] * back],
    b: Pt = [ins.to[0] - n[0] * back, ins.to[1] - n[1] * back],
    run = makeRun([a, b], END({ p: a, t, n }), END({ p: b, t, n })),
    bg: BandGeom = { kind: 'runs', R: 0, runs: [run] },
    wordGap = ins.wordGap ?? 2,
    fit = fitRing(bg, eng, p, { sTarget: s, fixed: s, once: ins.repeat === 'once', wordGap, sMax: s, room });
  if (!fit) return null;
  const laid = layRing(bg, fit, eng, p, layoutOpts(style, wordGap));
  if (!laid.length) return null;
  return {
    items: laid.map(l => ({ type: 'strip', style: sid, strip: l.strip, place: l.place, ring: ins.ring ?? 1 })),
    scale: fit.s,
    rep: fit.rep,
    slack: fit.slack,
    depth: room * fit.s,
  };
}

/** Several inscriptions in one style as a drawing of their own (to render, or to set into a sheet). Those that
 *  don't fit are named in the warnings. */
export function inscriptions(list: Inscription[], style: Style, seed = 1, script?: ScriptEngine): Placed {
  const items: PlacedItem[] = [],
    warnings: string[] = [];
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  list.forEach((ins, i) => {
    const got = inscribe({ ring: i + 1, ...ins }, style, 0, script);
    if (!got) {
      warnings.push(`inscription ${i + 1} doesn't fit its segment`);
      return;
    }
    items.push(...got.items);
    for (const q of [ins.from, ins.to]) {
      x0 = Math.min(x0, q[0] - got.depth);
      y0 = Math.min(y0, q[1] - got.depth);
      x1 = Math.max(x1, q[0] + got.depth);
      y1 = Math.max(y1, q[1] + got.depth);
    }
  });
  if (!items.length) [x0, y0, x1, y1] = [0, 0, 1, 1];
  return {
    version: 1,
    seed,
    canvas: { w: x1 - x0, h: y1 - y0, origin: [-x0, -y0] },
    styles: [style],
    items,
    meta: { size: 0, outline: [], borders: [], fill: null, inner: 0, warnings },
  };
}
