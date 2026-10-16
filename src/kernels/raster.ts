// The raster kernel (src/kernels/raster.c): Alpha.fill in WebAssembly, the same bytes as the TypeScript in
// script/thuluth/raster.ts, which stays as the fallback. Small enough to compile synchronously anywhere.
import { WASM_BASE64 } from './raster.wasm';

interface RasterWasm {
  memory: WebAssembly.Memory;
  ptsbuf: () => number;
  winbuf: () => number;
  maxpts: () => number;
  maxwin: () => number;
  fill: (npoly: number, px0: number, px1: number, py0: number, py1: number) => number;
}
let wasm: RasterWasm | null | undefined;
let forced: 'auto' | 'js' = 'auto';

function kernel(): RasterWasm | null {
  if (forced === 'js') return null;
  if (wasm === undefined) {
    try {
      const bytes = Uint8Array.from(atob(WASM_BASE64), c => c.charCodeAt(0));
      wasm = new WebAssembly.Instance(new WebAssembly.Module(bytes), {}).exports as unknown as RasterWasm;
    } catch {
      wasm = null;
    }
  }
  return wasm;
}
export const setRasterBackend = (b: 'auto' | 'js') => (forced = b);
export const rasterWasmLoaded = () => !!kernel();

/** Fill polygons into the window [px0, px1] × [py0, py1] of an alpha channel of width W. False when the kernel isn't
 *  available or the input is larger than its tables (nothing is changed then). */
export function fillAlpha(
  a: Uint8Array,
  W: number,
  polys: readonly (readonly (readonly [number, number])[])[],
  px0: number,
  px1: number,
  py0: number,
  py1: number,
): boolean {
  const k = kernel();
  if (!k) return false;
  const bw = px1 - px0 + 1,
    bh = py1 - py0 + 1;
  let np = 0;
  for (const q of polys) np += 1 + 2 * q.length;
  if (np > k.maxpts() || bw * bh > k.maxwin()) return false;
  const pts = new Float64Array(k.memory.buffer, k.ptsbuf(), np);
  let o = 0;
  for (const q of polys) {
    pts[o++] = q.length;
    for (const [x, y] of q) {
      pts[o++] = x;
      pts[o++] = y;
    }
  }
  const win = new Uint8Array(k.memory.buffer, k.winbuf(), bw * bh);
  for (let y = 0; y < bh; y++) win.set(a.subarray((py0 + y) * W + px0, (py0 + y) * W + px0 + bw), y * bw);
  if (!k.fill(polys.length, px0, px1, py0, py1)) return false;
  for (let y = 0; y < bh; y++) a.set(win.subarray(y * bw, y * bw + bw), (py0 + y) * W + px0);
  return true;
}
