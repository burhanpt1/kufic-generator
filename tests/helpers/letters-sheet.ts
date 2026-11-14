// Comparison sheets for letter drawing (tests/letters.test.ts): words set by the line engine, their ink drawn as a
// roundel draws it (each stroke through cleanOutline), laid out in labelled cells on a light ground.
import type { Form, LineOptions, SkelPt, Stroke, Thuluth } from '../../src/script/thuluth';
import { sampleStroke } from '../../src/script/thuluth';
import { cleanOutline } from '../../src/script/thuluth/outline';

export interface Cell {
  /** The cell's drawing, in its own units (y down), and that drawing's box. */
  body: string;
  box: [x0: number, y0: number, x1: number, y1: number];
  label?: string;
  /** Scale group: cells of one group are drawn at one scale (the default is the cell's column). */
  group?: string;
  /** A red frame round the cell (the audit's weakest forms), with its rank. */
  mark?: string;
}
export interface InkOptions {
  label?: string;
  group?: string;
  line?: LineOptions;
  /** Crop to a box in pen units (y up): x0, y0, x1, y1. */
  window?: [number, number, number, number];
  /** Overlay the skeleton and its control points. */
  skel?: boolean;
  ink?: string;
  mark?: string;
  pad?: number;
}

const path = (polys: readonly (readonly [number, number])[][]) =>
  polys.map(q => 'M' + q.map(([x, y]) => `${x.toFixed(3)} ${(-y).toFixed(3)}`).join('L') + 'Z').join('');

/** One letter form alone, as the table has it (no dots), or null if the letter has no such form. A faint line marks
 *  the baseline and a tick the point where the letter is joined from. */
export function glyphCell(th: Thuluth, c: string, form: Form, o: InkOptions = {}): Cell | null {
  const g = th.glyphFor(c, form);
  if (!g) return null;
  const st = th.style,
    k = typeof st.slant === 'number' ? st.slant : st.slant === 'left' ? -0.06 : st.slant === 'right' ? 0.14 : 0;
  const strokes: Stroke[] = g.s.map(sd => ({
    ang: sd.ang ?? st.ang,
    s: sampleStroke((sd.lean ? sd.pts.map(([x, y, w, cn]) => [x + k * y, y, w, cn]) : sd.pts) as SkelPt[], st.tension),
    raw: sd.pts.map(q => [q[0] + (sd.lean ? k * q[1] : 0), q[1]] as [number, number]),
  }));
  const cell = inkOf(th, strokes, [], o);
  cell.body = `<path d="M${cell.box[0]} 0H${cell.box[2]}" stroke="#c9bfa5" stroke-width="0.06"/>` + cell.body;
  return cell;
}

/** A line of text as ink (pen units, y flipped for the page). */
export function inkCell(th: Thuluth, text: string, o: InkOptions = {}): Cell {
  const b = th.buildStrokes(text, o.line ?? {});
  return inkOf(th, b.strokes, b.dots, o);
}

function inkOf(
  th: Thuluth,
  strokes: Stroke[],
  dots: readonly (readonly [number, number, ...unknown[]])[],
  o: InkOptions,
): Cell {
  const b = { strokes, dots },
    ink = o.ink ?? '#1b1b1b';
  let body = '',
    x0 = 1e9,
    x1 = -1e9,
    y0 = 1e9,
    y1 = -1e9;
  const grow = (polys: readonly (readonly [number, number])[][]) => {
    for (const q of polys)
      for (const [x, y] of q) {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
  };
  for (const s of b.strokes) {
    const polys = cleanOutline(th.strokePolys(s));
    body += `<path fill="${ink}" fill-rule="nonzero" d="${path(polys)}"/>`;
    grow(polys);
  }
  for (const [x, y] of b.dots) {
    const polys = th.dotPolysAt(x, y);
    body += `<path fill="${ink}" d="${path(polys)}"/>`;
    grow(polys);
  }
  if (o.skel)
    for (const s of b.strokes) {
      body += `<path fill="none" stroke="#e03131" stroke-width="0.04" d="M${s.s.map(q => `${q.x.toFixed(3)} ${(-q.y).toFixed(3)}`).join('L')}"/>`;
      for (const [x, y] of s.raw ?? []) body += `<circle cx="${x}" cy="${-y}" r="0.09" fill="#1971c2"/>`;
    }
  const pad = o.pad ?? 0.8;
  const box: Cell['box'] = o.window
    ? [o.window[0], -o.window[3], o.window[2], -o.window[1]]
    : [x0 - pad, -y1 - pad, x1 + pad, -y0 + pad];
  return { body, box, label: o.label, group: o.group, mark: o.mark };
}

const FONT = 'font-family="DejaVu Sans, Inter, sans-serif"';
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

/** A sheet: rows of cells, each row with a label on the left; cells of one column (or scale group) share a scale. */
export function sheet(
  rows: { label: string; cells: Cell[] }[],
  o: { cell?: [number, number]; title?: string; paper?: string; cols?: string[]; labelW?: number } = {},
): string {
  const [cw, ch] = o.cell ?? [420, 420],
    lw = o.labelW ?? 190,
    top = (o.title ? 56 : 12) + (o.cols ? 30 : 0),
    n = Math.max(...rows.map(r => r.cells.length)),
    W = lw + n * cw + 12,
    H = top + rows.length * ch + 12,
    paper = o.paper ?? '#f6f1e4';
  const scale = new Map<string, number>();
  rows.forEach(r =>
    r.cells.forEach((c, i) => {
      const k = c.group ?? `col${i}`,
        s = Math.min((cw - 24) / (c.box[2] - c.box[0]), (ch - 44) / (c.box[3] - c.box[1]));
      scale.set(k, Math.min(scale.get(k) ?? 1e9, s));
    }),
  );
  let out = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="100%" height="100%" fill="${paper}"/>`;
  if (o.title) out += `<text x="14" y="36" ${FONT} font-size="24" font-weight="bold" fill="#1d2440">${esc(o.title)}</text>`; // prettier-ignore
  o.cols?.forEach((c, i) => (out += `<text x="${lw + i * cw + cw / 2}" y="${top - 8}" text-anchor="middle" ${FONT} font-size="17" fill="#5b6377">${esc(c)}</text>`)); // prettier-ignore
  rows.forEach((r, ri) => {
    const y = top + ri * ch;
    r.label.split('\n').forEach((ln, k) => (out += `<text x="14" y="${y + 34 + k * 22}" ${FONT} font-size="${k ? 14 : 19}" font-weight="${k ? 'normal' : 'bold'}" fill="${k ? '#5b6377' : '#1d2440'}">${esc(ln)}</text>`)); // prettier-ignore
    r.cells.forEach((c, i) => {
      const x = lw + i * cw,
        s = scale.get(c.group ?? `col${i}`)!,
        bw = c.box[2] - c.box[0],
        bh = c.box[3] - c.box[1],
        tx = x + (cw - bw * s) / 2 - c.box[0] * s,
        ty = y + 8 + (ch - 36 - bh * s) / 2 - c.box[1] * s,
        id = `c${ri}_${i}`;
      out += `<rect x="${x + 4}" y="${y + 4}" width="${cw - 8}" height="${ch - 8}" rx="6" fill="#fffdf6" stroke="${c.mark ? '#e03131' : '#d9d2bf'}" stroke-width="${c.mark ? 4 : 1}"/>`;
      out += `<clipPath id="${id}"><rect x="${x + 5}" y="${y + 5}" width="${cw - 10}" height="${ch - 10}"/></clipPath>`;
      out += `<g clip-path="url(#${id})"><g transform="translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${s.toFixed(4)})">${c.body}</g></g>`;
      if (c.label) out += `<text x="${x + cw / 2}" y="${y + ch - 12}" text-anchor="middle" ${FONT} font-size="14" fill="#5b6377">${esc(c.label)}</text>`; // prettier-ignore
      if (c.mark) out += `<circle cx="${x + 26}" cy="${y + 26}" r="16" fill="#e03131"/><text x="${x + 26}" y="${y + 32}" text-anchor="middle" ${FONT} font-size="17" font-weight="bold" fill="#fff">${esc(c.mark)}</text>`; // prettier-ignore
    });
  });
  return out + '</svg>';
}
