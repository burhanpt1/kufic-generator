// SVG path data -> dense closed polyline. Supports M L H V C S Q T A Z, absolute and relative. Curves are flattened
// adaptively (subdivided until flat to a tolerance relative to the path's size); arcs are converted to centre form
// and sampled. The largest closed subpath is the outline.
import { area, bounds, dedupe } from './poly';
import type { Pt } from './types';

type Seg = { cmd: string; args: number[] };

const ARGC: Record<string, number> = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };

export function parsePath(d: string): Seg[] {
  const toks = d.match(/[MmLlHhVvCcSsQqTtAaZz]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) || [];
  const out: Seg[] = [];
  let i = 0,
    cmd = '';
  while (i < toks.length) {
    if (/[a-zA-Z]/.test(toks[i])) cmd = toks[i++];
    else if (!cmd) throw new Error('path data must start with a command');
    const n = ARGC[cmd.toUpperCase()];
    if (n === undefined) throw new Error(`unknown path command ${cmd}`);
    if (n === 0) {
      out.push({ cmd, args: [] });
      continue;
    }
    // arc flags may be written without separators ("a1 1 0 01 2 2"); split them out
    if (cmd.toUpperCase() === 'A') {
      const args: number[] = [];
      while (args.length < 7 && i < toks.length && !/[a-zA-Z]/.test(toks[i])) {
        const k = args.length;
        const t = toks[i];
        if ((k === 3 || k === 4) && t.length > 1 && /^[01]/.test(t)) {
          args.push(+t[0]);
          toks[i] = t.slice(1);
          continue;
        }
        args.push(+t);
        i++;
      }
      if (args.length < 7) throw new Error('incomplete arc');
      out.push({ cmd, args });
    } else {
      const args: number[] = [];
      for (let k = 0; k < n; k++) {
        if (i >= toks.length || /[a-zA-Z]/.test(toks[i])) throw new Error(`not enough numbers for ${cmd}`);
        args.push(+toks[i++]);
      }
      out.push({ cmd, args });
    }
    // implicit repeats: after M, further pairs are L
    if (cmd === 'M') cmd = 'L';
    else if (cmd === 'm') cmd = 'l';
  }
  return out;
}

function flattenCubic(out: Pt[], p0: Pt, p1: Pt, p2: Pt, p3: Pt, tol: number, depth = 0) {
  // flat enough when the control points are close to the chord
  const dx = p3[0] - p0[0],
    dy = p3[1] - p0[1],
    l = Math.hypot(dx, dy) || 1e-12;
  const d1 = Math.abs((p1[0] - p3[0]) * dy - (p1[1] - p3[1]) * dx) / l,
    d2 = Math.abs((p2[0] - p3[0]) * dy - (p2[1] - p3[1]) * dx) / l;
  if (depth > 16 || d1 + d2 <= tol) {
    out.push(p3);
    return;
  }
  const m = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const p01 = m(p0, p1),
    p12 = m(p1, p2),
    p23 = m(p2, p3),
    p012 = m(p01, p12),
    p123 = m(p12, p23),
    mid = m(p012, p123);
  flattenCubic(out, p0, p01, p012, mid, tol, depth + 1);
  flattenCubic(out, mid, p123, p23, p3, tol, depth + 1);
}

function arcPoints(
  out: Pt[],
  p0: Pt,
  rx: number,
  ry: number,
  phiDeg: number,
  large: number,
  sweep: number,
  p1: Pt,
  tol: number,
) {
  if (!rx || !ry) {
    out.push(p1);
    return;
  }
  rx = Math.abs(rx);
  ry = Math.abs(ry);
  const phi = (phiDeg * Math.PI) / 180,
    cos = Math.cos(phi),
    sin = Math.sin(phi);
  const dx = (p0[0] - p1[0]) / 2,
    dy = (p0[1] - p1[1]) / 2,
    x1 = cos * dx + sin * dy,
    y1 = -sin * dx + cos * dy;
  const lam = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry);
  if (lam > 1) {
    rx *= Math.sqrt(lam);
    ry *= Math.sqrt(lam);
  }
  const num = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1,
    den = rx * rx * y1 * y1 + ry * ry * x1 * x1;
  let co = Math.sqrt(Math.max(0, num / den));
  if (large === sweep) co = -co;
  const cxp = (co * rx * y1) / ry,
    cyp = (-co * ry * x1) / rx;
  const cx = cos * cxp - sin * cyp + (p0[0] + p1[0]) / 2,
    cy = sin * cxp + cos * cyp + (p0[1] + p1[1]) / 2;
  const ang = (ux: number, uy: number, vx: number, vy: number) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const t0 = ang(1, 0, (x1 - cxp) / rx, (y1 - cyp) / ry);
  let dt = ang((x1 - cxp) / rx, (y1 - cyp) / ry, (-x1 - cxp) / rx, (-y1 - cyp) / ry);
  if (!sweep && dt > 0) dt -= 2 * Math.PI;
  else if (sweep && dt < 0) dt += 2 * Math.PI;
  const r = Math.max(rx, ry),
    step = 2 * Math.acos(Math.max(-1, Math.min(1, 1 - tol / r))) || 0.1,
    k = Math.max(2, Math.ceil(Math.abs(dt) / step));
  for (let i = 1; i <= k; i++) {
    const t = t0 + (dt * i) / k,
      x = rx * Math.cos(t),
      y = ry * Math.sin(t);
    out.push([cos * x - sin * y + cx, sin * x + cos * y + cy]);
  }
}

/** Closed subpaths of path data, flattened. tol is the flatness tolerance; default 0.1% of the path's size. */
export function flattenPath(d: string, tol?: number): Pt[][] {
  const segs = parsePath(d);
  // a first pass with a coarse tolerance gives the size for the real tolerance
  if (tol === undefined) {
    const rough = flattenSegs(segs, 1e9).flat();
    const b = bounds(rough.length ? rough : [[0, 0]]);
    tol = Math.max(b.x1 - b.x0, b.y1 - b.y0) * 0.001 || 0.001;
  }
  return flattenSegs(segs, tol);
}

function flattenSegs(segs: Seg[], tol: number): Pt[][] {
  const subs: Pt[][] = [];
  let cur: Pt[] = [],
    p: Pt = [0, 0],
    start: Pt = [0, 0],
    lastC: Pt | null = null,
    lastQ: Pt | null = null;
  const end = () => {
    if (cur.length > 2) subs.push(cur);
    cur = [];
  };
  for (const { cmd, args } of segs) {
    const rel = cmd === cmd.toLowerCase() && cmd !== 'Z' && cmd !== 'z',
      C = cmd.toUpperCase(),
      ox = rel ? p[0] : 0,
      oy = rel ? p[1] : 0;
    const pt = (i: number): Pt => [args[i] + ox, args[i + 1] + oy];
    let nextC: Pt | null = null,
      nextQ: Pt | null = null;
    switch (C) {
      case 'M':
        end();
        p = pt(0);
        start = p;
        cur.push(p);
        break;
      case 'L':
        p = pt(0);
        cur.push(p);
        break;
      case 'H':
        p = [args[0] + ox, p[1]];
        cur.push(p);
        break;
      case 'V':
        p = [p[0], args[0] + oy];
        cur.push(p);
        break;
      case 'C': {
        const c1 = pt(0),
          c2 = pt(2),
          e = pt(4);
        flattenCubic(cur, p, c1, c2, e, tol);
        nextC = c2;
        p = e;
        break;
      }
      case 'S': {
        const c1: Pt = lastC ? [2 * p[0] - lastC[0], 2 * p[1] - lastC[1]] : p,
          c2 = pt(0),
          e = pt(2);
        flattenCubic(cur, p, c1, c2, e, tol);
        nextC = c2;
        p = e;
        break;
      }
      case 'Q':
      case 'T': {
        const q: Pt = C === 'Q' ? pt(0) : lastQ ? [2 * p[0] - lastQ[0], 2 * p[1] - lastQ[1]] : p,
          e = C === 'Q' ? pt(2) : pt(0);
        // quadratic as cubic
        const c1: Pt = [p[0] + ((q[0] - p[0]) * 2) / 3, p[1] + ((q[1] - p[1]) * 2) / 3],
          c2: Pt = [e[0] + ((q[0] - e[0]) * 2) / 3, e[1] + ((q[1] - e[1]) * 2) / 3];
        flattenCubic(cur, p, c1, c2, e, tol);
        nextQ = q;
        p = e;
        break;
      }
      case 'A': {
        const e: Pt = [args[5] + ox, args[6] + oy];
        arcPoints(cur, p, args[0], args[1], args[2], args[3], args[4], e, tol);
        p = e;
        break;
      }
      case 'Z':
        p = start;
        end();
        break;
    }
    lastC = nextC;
    lastQ = nextQ;
  }
  end();
  return subs.map(s => dedupe(s));
}

/** The largest closed subpath of the path data, as a dense polyline (in the path's own coordinates). */
export function importSvgPath(d: string): Pt[] {
  const subs = flattenPath(d).filter(s => s.length >= 3);
  if (!subs.length) throw new Error('path has no closed area');
  return subs.reduce((a, b) => (area(b) > area(a) ? b : a));
}

/** Polyline -> path data (absolute, rounded), for export and round-trip tests. */
export function toPathData(P: Pt[], digits = 4): string {
  const f = (n: number) => (Math.round(n * 10 ** digits) / 10 ** digits).toString();
  return P.map(([x, y], i) => (i ? 'L' : 'M') + f(x) + ' ' + f(y)).join('') + 'Z';
}
