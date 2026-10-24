// The Timurid band (PLAN-2 §9): jali thuluth with a Kufic line in its upper zone, between the uprights, the uprights
// passing over it with a hairline in the ground's colour, as on Timurid tile bands. Built from the repo's own
// engines: the thuluth band pen for the large line, the Kufic engine justified into the zone above its letters' bodies.
import { DEFAULT_STYLE } from '../model/style';
import { kufi, repeat } from '../script/kufi';
import { thuluthStyleOf } from '../script/registry';
import { thuluth } from '../script/thuluth/engine';
import { isLetter } from '../script/thuluth/engine';
import type { CellStrip } from '../script/types';

export interface TimuridOptions {
  /** Pixels per pen unit. */
  U?: number;
  ink?: string;
  kufiInk?: string;
  ground?: string;
  /** The hairline round the thuluth where it passes over the Kufic line (pen units). */
  hairline?: number;
}
export interface TimuridBand {
  svg: string;
  /** The Kufic zone (pen units, y up): above the thuluth bodies, below the stems' tops. */
  zone: { y0: number; y1: number };
  /** The Kufic line's cell size, and its cells drawn. */
  cell: number;
  kufiCells: number;
  /** Thuluth uprights that pass through the Kufic zone. */
  uprights: number;
}

const STEMS = new Set(['ا', 'أ', 'إ', 'آ', 'ٱ', 'ل', 'ك', 'ط', 'ظ']);

export function timuridBand(thuluthText: string, kufiText: string, o: TimuridOptions = {}): TimuridBand | null {
  const th = thuluth(thuluthStyleOf({ preset: 'band' })),
    nib = th.style.nib,
    b = th.buildStrokes(thuluthText, { kashida: 2 });
  if (!b.strokes.length) return null;
  const all = b.strokes.flatMap(s => s.s),
    x0 = Math.min(...all.map(q => q.x)),
    x1 = Math.max(...all.map(q => q.x)),
    y0 = Math.min(...all.map(q => q.y)),
    stemTop = Math.max(...all.map(q => q.y));
  // the bodies' top: high among the samples of letters without a stem (by stroke ownership), not counting marks
  const letterOf = new Map(b.placed.filter(isLetter).map(p => [p.wi + ':' + p.li, p.c]));
  const body = b.strokes
    .filter(s => !s.mark && s.own)
    .flatMap(s => s.s.filter((_, k) => s.own![k] >= 0 && !STEMS.has(letterOf.get(s.wi + ':' + s.own![k]) ?? '')).map(q => q.y))
    .sort((a, c) => a - c); // prettier-ignore
  const bodyTop = body.length ? body[Math.floor(body.length * 0.92)] : stemTop / 2,
    zone = { y0: bodyTop + nib * 1.2, y1: stemTop - nib };
  if (zone.y1 - zone.y0 < nib * 2) return null;
  // the Kufic line, justified across the band's width at the zone's height
  const style = { ...DEFAULT_STYLE.letter, marks: 'off' as const },
    prepared = kufi.prepare(kufi.shape(kufiText, style), style),
    cell = (zone.y1 - zone.y0) / prepared.Hb,
    width = Math.floor((x1 - x0) / cell),
    opts = { wrap: false, rhythm: true, wordGap: 2, terminals: 'none' as const },
    segs = kufi.segments(prepared, 'words', 2),
    natural = kufi.layout(segs, prepared, null, opts) as CellStrip | null,
    // repeated to fill the band, then justified to it (a short text stretched across would be all kashida)
    reps = natural ? Math.max(1, Math.floor(width / (natural.W + 2))) : 1,
    strip = (kufi.layout(repeat(segs, reps), prepared, width, opts) ?? natural) as CellStrip | null;
  if (!strip) return null;
  const U = o.U ?? 12,
    pad = 2,
    W = (x1 - x0 + 2 * pad) * U,
    H = (stemTop - y0 + 2 * pad) * U,
    X = (x: number) => (x - x0 + pad) * U,
    Y = (y: number) => (stemTop + pad - y) * U,
    ink = o.ink ?? '#f4f6f7',
    ground = o.ground ?? '#1f3f8f';
  // Kufic cells as horizontal runs, centred across the band, row 0 at the zone's top
  const kx0 = (x0 + x1) / 2 - (strip.W * cell) / 2;
  let kd = '',
    kufiCells = 0;
  for (let r = 0; r < strip.Hb; r++) {
    let run = -1;
    for (let c = 0; c <= strip.W; c++) {
      const v = c < strip.W ? strip.data[r * strip.W + c] : 0,
        on = v === 1 || v === 4;
      if (on) kufiCells++;
      if (on && run < 0) run = c;
      if (!on && run >= 0) {
        const xa = X(kx0 + run * cell),
          xb = X(kx0 + c * cell),
          ya = Y(zone.y1 - r * cell),
          yb = Y(zone.y1 - (r + 1) * cell);
        kd += `M${xa.toFixed(1)} ${ya.toFixed(1)}H${xb.toFixed(1)}V${yb.toFixed(1)}H${xa.toFixed(1)}Z`;
        run = -1;
      }
    }
  }
  // the thuluth over it, edged in the ground's colour so the uprights cross the Kufic line with a hairline
  const polys = [...b.strokes.flatMap(s => th.strokePolys(s)), ...b.dots.flatMap(([x, y]) => th.dotPolysAt(x, y))],
    td = polys.map(q => 'M' + q.map(([x, y]) => X(x).toFixed(1) + ' ' + Y(y).toFixed(1)).join('L') + 'Z').join('');
  const uprights = b.strokes.filter(s => {
    const ys = s.s.map(q => q.y);
    return !s.mark && Math.min(...ys) < zone.y0 && Math.max(...ys) > zone.y1 - nib;
  }).length;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W.toFixed(0)} ${H.toFixed(0)}" width="${W.toFixed(0)}" height="${H.toFixed(0)}">` +
    `<rect width="100%" height="100%" fill="${ground}"/>` +
    `<path fill="${o.kufiInk ?? '#2aa6a0'}" d="${kd}"/>` +
    `<path fill="${ink}" fill-rule="nonzero" stroke="${ground}" stroke-width="${((o.hairline ?? 0.35) * U).toFixed(1)}" stroke-linejoin="round" paint-order="stroke" d="${td}"/>` +
    `</svg>`; // prettier-ignore
  return { svg, zone, cell, kufiCells, uprights };
}
