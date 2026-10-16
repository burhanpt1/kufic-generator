// The partition kernel (src/kernels/partition.c): the ring and side splitter's dynamic program in WebAssembly. Same
// arithmetic in the same order as the TypeScript in layout/solvers.ts, which stays as the fallback, so both give the
// same groups. The module is small enough (under 4 KB) to compile synchronously anywhere, so it loads on first use.
import type { Segs } from '../types';
import { WASM_BASE64 } from './partition.wasm';

interface PartitionWasm {
  memory: WebAssembly.Memory;
  inbuf: () => number;
  outbuf: () => number;
  maxn: () => number;
  maxg: () => number;
  run: (n: number, G: number, wg: number) => number;
}
let wasm: PartitionWasm | null | undefined;
let forced: 'auto' | 'js' = 'auto';

function kernel(): PartitionWasm | null {
  if (forced === 'js') return null;
  if (wasm === undefined) {
    try {
      const bytes = Uint8Array.from(atob(WASM_BASE64), c => c.charCodeAt(0));
      wasm = new WebAssembly.Instance(new WebAssembly.Module(bytes), {}).exports as unknown as PartitionWasm;
    } catch {
      wasm = null;
    }
  }
  return wasm;
}

/** For tests and benchmarks: use the TypeScript only, or the kernel when it loads. */
export const setPartitionBackend = (b: 'auto' | 'js') => (forced = b);
export const partitionWasmLoaded = () => !!kernel();

/** Group boundaries [0, …, n] of the best split, null if none fits, or undefined when the kernel can't run it (not
 *  loaded, or the input is larger than its tables). */
export function partitionBounds(segs: Segs, caps: readonly number[]): Int32Array | null | undefined {
  const k = kernel(),
    n = segs.length,
    G = caps.length;
  // without a word gap the TypeScript's arithmetic goes through NaN; leave those to it
  if (!k || n > k.maxn() || G > k.maxg() || segs.wg == null) return undefined;
  const inp = new Float64Array(k.memory.buffer, k.inbuf(), 2 * n + G);
  for (let i = 0; i < n; i++) {
    inp[i] = segs[i].minW;
    inp[n + i] = segs[i].endsWord ? 1 : 0;
  }
  for (let g = 0; g < G; g++) inp[2 * n + g] = caps[g];
  if (!k.run(n, G, segs.wg)) return null;
  return new Int32Array(k.memory.buffer, k.outbuf(), G + 1).slice();
}
