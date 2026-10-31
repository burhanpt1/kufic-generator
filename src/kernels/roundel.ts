// The roundel kernels (src/kernels/roundel.c): the mark solver's empty-space measure, the composer's enclosing disc
// and the frame's oval search in WebAssembly, the same numbers as the TypeScript in script/thuluth/roundel, which
// stays as the fallback. Each use gets its own instance (its own memory, a few kilobytes to set up), so no two
// computations ever share state, however they interleave.
import { WASM_BASE64 } from './roundel.wasm';

interface RoundelWasm {
  memory: WebAssembly.Memory;
  gap_setup: (ncells: number, nitems: number) => number;
  gap_move: (k: number, x: number, y: number, r: number, fresh: number) => void;
  gap_rescan_all: () => void;
  gap_sum: () => number;
  disc_setup: (npts: number, nhulls: number, ngroups: number) => number;
  disc_index: () => void;
  disc: (ng: number, oval: number) => number;
  oval_setup: (npts: number, novals: number) => number;
  oval: (np: number, nv: number, mx: number, my: number, wd: number, hd: number, pull: number, pref: number) => number;
}
let mod: WebAssembly.Module | null | undefined;
let forced: 'auto' | 'js' = 'auto';
function instance(): RoundelWasm | null {
  if (forced === 'js') return null;
  if (mod === undefined) {
    try {
      mod = new WebAssembly.Module(Uint8Array.from(atob(WASM_BASE64), c => c.charCodeAt(0)));
    } catch {
      mod = null;
    }
  }
  return mod ? (new WebAssembly.Instance(mod, {}).exports as unknown as RoundelWasm) : null;
}
// the oval search keeps nothing between calls, so it reuses one
let ovalInstance: RoundelWasm | null | undefined;
const kernel = (k: 'gap' | 'disc' | 'oval') =>
  forced === 'js' ? null : k === 'oval' ? (ovalInstance ??= instance()) : instance();
export const setRoundelBackend = (b: 'auto' | 'js') => (forced = b);
export const roundelWasmLoaded = () => !!kernel('oval');

/** The empty-space measure over nc cells (centre x, y and clearance to the ink) and ni items; null without the
 *  kernel. Items are moved one at a time; `sum` is the mean squared excess over 1.6 of each cell's clearance. */
export function gapKernel(cx: ArrayLike<number>, cy: ArrayLike<number>, cb: ArrayLike<number>, ni: number) {
  const k = kernel('gap'),
    nc = cx.length;
  if (!k) return null;
  const at = k.gap_setup(nc, ni);
  if (!at) return null;
  const d = new Float64Array(k.memory.buffer, at, 3 * nc);
  d.set(cx, 0);
  d.set(cy, nc);
  d.set(cb, 2 * nc);
  return {
    move: (i: number, x: number, y: number, r: number, fresh: boolean) => k.gap_move(i, x, y, r, fresh ? 1 : 0),
    rescanAll: () => k.gap_rescan_all(),
    sum: () => k.gap_sum(),
  };
}

/** The enclosing disc of placed hulls: hulls are registered once (their points written into the kernel), then each
 *  call places them. Null without the kernel. */
export function discKernel(hulls: readonly (readonly (readonly [number, number])[])[], ngroups: number) {
  const k = kernel('disc');
  if (!k) return null;
  const npts = hulls.reduce((a, h) => a + h.length, 0),
    nh = hulls.length,
    at = k.disc_setup(npts, nh, ngroups);
  if (!at) return null;
  const pool = new Float64Array(k.memory.buffer, at, 2 * npts),
    table = new Float64Array(k.memory.buffer, at + 16 * npts, 2 * nh),
    grp = new Float64Array(k.memory.buffer, at + 16 * npts + 16 * nh, 3 * ngroups),
    out = new Float64Array(k.memory.buffer, at + 16 * npts + 16 * nh + 24 * ngroups, 3),
    index = new Map<readonly (readonly [number, number])[], number>();
  let o = 0;
  hulls.forEach((h, j) => {
    index.set(h, j);
    table[2 * j] = o;
    table[2 * j + 1] = h.length;
    for (const [x, y] of h) {
      pool[2 * o] = x;
      pool[2 * o + 1] = y;
      o++;
    }
  });
  k.disc_index();
  return {
    /** Group i at (x, y) with hull h (one of those registered). */
    place: (i: number, x: number, y: number, h: readonly (readonly [number, number])[]) => {
      grp[3 * i] = x;
      grp[3 * i + 1] = y;
      grp[3 * i + 2] = index.get(h)!;
    },
    /** cx, cy and the radius in the oval metric (before any margin), or null if there are no points. */
    run: (ng: number, oval: number): [number, number, number] | null =>
      k.disc(ng, oval) ? [out[0], out[1], out[2]] : null,
  };
}

/** The least oval round x y margin points over a grid of centres about (mx, my), for each proportion in `ovals`. */
export function ovalKernel(
  pts: readonly (readonly [number, number, number])[],
  ovals: readonly number[],
  mx: number,
  my: number,
  wd: number,
  hd: number,
  pull: number,
  pref: number,
): { area: number; cx: number; cy: number; R: number; v: number } | null | undefined {
  const k = kernel('oval');
  if (!k) return undefined;
  const at = k.oval_setup(pts.length, ovals.length);
  if (!at) return undefined;
  const p = new Float64Array(k.memory.buffer, at, 3 * pts.length + ovals.length + 5);
  pts.forEach(([x, y, m], i) => p.set([x, y, m], 3 * i));
  p.set(ovals, 3 * pts.length);
  if (!k.oval(pts.length, ovals.length, mx, my, wd, hd, pull, pref)) return null;
  const o = 3 * pts.length + ovals.length;
  return { area: p[o], cx: p[o + 1], cy: p[o + 2], R: p[o + 3], v: p[o + 4] };
}
