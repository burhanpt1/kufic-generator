// The tuning page's engine (demos/tune.html), off the main thread: the pieces and their variants once, then the
// roundel drawn from a pinned layout on every change, with each piece's box on the drawing so a tap can find it.
import { loadKernels } from '../kernels';
import { ROUNDEL_PEN, thuluth } from '../script/thuluth';
import type { Layout } from '../script/thuluth/roundel';
import { buildRoundel, renderRoundel, roundelArt, roundelPieces } from '../script/thuluth/roundel';
import type { Poly } from '../script/thuluth/types';
import { TUNE_RECIPE, TUNE_TEXT, TUNE_VOWELLED } from './recipe';
import type { TuneDraw, TuneFrame, TuneInit, TuneRequest, TuneShape } from './types';

const th = thuluth({ ...ROUNDEL_PEN, great: { ya: true } });
const ready = loadKernels();
const U = 8,
  PAD = 1.5;
const f1 = (n: number) => n.toFixed(1);
const pathOf = (ps: Poly[], X: (x: number) => number, Y: (y: number) => number) =>
  ps.map(q => 'M' + q.map(([x, y]) => f1(X(x)) + ' ' + f1(Y(y))).join('L') + 'Z').join('');

function init(): TuneInit {
  const p = roundelPieces(th, TUNE_TEXT, TUNE_RECIPE)!;
  return {
    pieces: p.groups.map((g, i) => ({
      s: g.s,
      word: g.word,
      first: i === 0 || p.groups[i - 1].word !== g.word,
      variants: p.shapes[i].map(S => {
        // each variant on its own, in a box of its ink, y down
        const X = (x: number) => (x - S.x0) * 10,
          Y = (y: number) => (S.y1 - y) * 10,
          d =
            S.b.strokes.map(s => pathOf(th.strokePolys({ ang: s.ang, nib: s.nib, s: s.s }), X, Y)).join('') +
            S.b.dots.map(([a, b, sc]) => pathOf(th.dotPolysAt(a, b, sc || 1, 0), X, Y)).join('');
        const label = S.tower ? 'tower' : S.stacked ? 'stacked' : S.elong ? `drawn out ${S.elong}` : S.emph ? 'emphasised' : 'plain'; // prettier-ignore
        return { d, w: (S.x1 - S.x0) * 10, h: (S.y1 - S.y0) * 10, label };
      }),
    })),
  };
}

function draw(shape: TuneShape, layout: Layout, frame: TuneFrame): TuneDraw {
  const t = performance.now(),
    text = frame.vowels ? TUNE_VOWELLED : TUNE_TEXT;
  const fr = { ornaments: frame.ornaments, density: frame.density, clearance: frame.clearance || undefined, fathaGap: frame.clearance > 0 || undefined }; // prettier-ignore
  // a line is set in a wide oval, so the marks have room, and drawn without it
  const b = buildRoundel(th, { text, compose: { ...TUNE_RECIPE, oval: shape === 'line' ? 4 : 1, tries: 1, fixed: layout }, frame: fr }); // prettier-ignore
  if (!b) throw new Error('The basmala could not be drawn.');
  const art = roundelArt(th, b.r, b.f, {});
  let svg: string, X: (x: number) => number, Y: (y: number) => number;
  if (shape === 'line') {
    // the ink alone, dark on paper, in a box round everything drawn
    const all = art.units.flatMap(u => u.polys.flat()),
      x0 = Math.min(...all.map(q => q[0])) - 3,
      x1 = Math.max(...all.map(q => q[0])) + 3,
      y0 = Math.min(...all.map(q => q[1])) - 3,
      y1 = Math.max(...all.map(q => q[1])) + 3;
    X = x => (x - x0) * U;
    Y = y => (y1 - y) * U;
    const ink = art.units.filter(u => !u.tint).map(u => pathOf(u.polys, X, Y)).join(''),
      tinted = art.units.filter(u => u.tint).map(u => `<path fill="${u.tint}" d="${pathOf(u.polys, X, Y)}"/>`).join(''); // prettier-ignore
    svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f1((x1 - x0) * U)} ${f1((y1 - y0) * U)}"><rect width="100%" height="100%" fill="#f6f1e4"/><path fill="#1d2440" d="${ink}"/>${tinted}</svg>`; // prettier-ignore
  } else {
    svg = renderRoundel(th, b.r, b.f, { U });
    // the same frame renderRoundel drew, to place each piece's box on it
    const C = (art.Rout * art.oval + PAD) * U;
    X = x => C + (x - art.cx) * U;
    Y = y => C - (y - art.cy) * U;
  }
  const boxes = b.r.shapes.map((S, i) => {
    const { x, y } = b.r.st[i];
    return { x0: X(x + S.x0), x1: X(x + S.x1), y0: Y(y + S.y1), y1: Y(y + S.y0) };
  });
  return { svg, boxes, ms: Math.round(performance.now() - t) };
}

self.onmessage = async (e: MessageEvent<TuneRequest>) => {
  await ready;
  const m = e.data;
  try {
    if (m.kind === 'init') self.postMessage({ id: m.id, init: init() });
    else self.postMessage({ id: m.id, draw: draw(m.shape, m.layout, m.frame) });
  } catch (err) {
    self.postMessage({ id: m.id, error: String((err as Error).message || err) });
  }
};
