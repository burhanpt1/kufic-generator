// The ratings kernel (src/kernels/ratings.c): fitPairwise's gradient descent in WebAssembly, the same weights as the
// TypeScript in evolve/ratings.ts, which stays as the fallback.
import { WASM_BASE64 } from './ratings.wasm';

interface RatingsWasm {
  memory: WebAssembly.Memory;
  fit_setup: (m: number, k: number) => number;
  fit: (m: number, k: number, l2: number, iters: number) => void;
}
let wasm: RatingsWasm | null | undefined;
let forced: 'auto' | 'js' = 'auto';
function kernel(): RatingsWasm | null {
  if (forced === 'js') return null;
  if (wasm === undefined) {
    try {
      const bytes = Uint8Array.from(atob(WASM_BASE64), c => c.charCodeAt(0));
      wasm = new WebAssembly.Instance(new WebAssembly.Module(bytes), {}).exports as unknown as RatingsWasm;
    } catch {
      wasm = null;
    }
  }
  return wasm;
}
export const setRatingsBackend = (b: 'auto' | 'js') => (forced = b);
export const ratingsWasmLoaded = () => !!kernel();

/** Weights for rows of feature differences d (k each) and outcomes y, by `iters` steps of gradient descent with an
 *  L2 penalty; null without the kernel. */
export function fitKernel(
  rows: readonly { d: readonly number[]; y: number }[],
  k: number,
  l2: number,
  iters: number,
): number[] | null {
  const K = kernel(),
    m = rows.length;
  if (!K) return null;
  const at = K.fit_setup(m, k);
  if (!at) return null;
  const mem = new Float64Array(K.memory.buffer, at, m * k + m + k);
  rows.forEach((r, i) => {
    mem.set(r.d, i * k);
    mem[m * k + i] = r.y;
  });
  K.fit(m, k, l2, iters);
  return Array.from(mem.subarray(m * k + m, m * k + m + k));
}
