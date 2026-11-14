// Clipper2's C++ compiled to WebAssembly (the clipper2-wasm build), for the polygon unions that dominate thuluth
// outlines (2–3× the TypeScript port). Its module only loads asynchronously, so `loadClipper2()` runs once at start
// (the studio's workers, the test setup) and the outline code uses the TypeScript port until it has.
//
// In a browser the binary is fetched as a file of its own: one download, compiled as it streams and cached for the
// page and every worker, instead of a base64 copy inside each of their scripts. The copy embedded in
// clipper2.wasm.ts is loaded only where there is nothing to fetch from (Node: the tests) or when the fetch fails,
// so the same binary runs everywhere.
import type { MainModule, PathsD } from 'clipper2-wasm/dist/clipper2z';
import wasmUrl from 'clipper2-wasm/dist/es/clipper2z.wasm?url';

export type Clipper2 = MainModule;
let mod: Clipper2 | null = null;
let loading: Promise<boolean> | null = null;
let forced: 'auto' | 'js' = 'auto';
const IN_NODE = !!(globalThis as { process?: { versions?: { node?: string } } }).process?.versions?.node;

/** Load the module (once; later calls return the same promise). Resolves false if WebAssembly is unavailable. */
export function loadClipper2(): Promise<boolean> {
  if (mod) return Promise.resolve(true);
  loading ??= (async () => {
    try {
      const { default: factory } = await import('clipper2-wasm/dist/es/clipper2z.js');
      if (!IN_NODE)
        try {
          mod = (await factory({ locateFile: () => wasmUrl })) as Clipper2;
          return true;
        } catch {
          // the file could not be fetched or compiled: the embedded copy
        }
      const { WASM_BASE64 } = await import('./clipper2.wasm');
      const wasmBinary = Uint8Array.from(atob(WASM_BASE64), c => c.charCodeAt(0)).buffer;
      mod = (await factory({ wasmBinary })) as Clipper2;
      return true;
    } catch {
      return false;
    }
  })();
  return loading;
}
/** The loaded module, or null (not loaded yet, or the TypeScript backend forced). */
export const clipper2 = (): Clipper2 | null => (forced === 'js' ? null : mod);
/** For tests and benchmarks: use the TypeScript port only, or the module when loaded. */
export const setClipperBackend = (b: 'auto' | 'js') => (forced = b);

/** Polygons (flat [x, y] lists) into the module's PathsD; the caller deletes it. */
export function toPathsD(C: Clipper2, polys: readonly (readonly (readonly [number, number])[])[]): PathsD {
  const out = new C.PathsD(),
    p = new C.PathD();
  for (const q of polys) {
    const v = new Float64Array(q.length * 3);
    for (let i = 0; i < q.length; i++) {
      v[i * 3] = q[i][0];
      v[i * 3 + 1] = q[i][1];
    }
    p.assign(v);
    out.push_back(p);
  }
  p.delete();
  return out;
}
/** The module's PathsD back to polygons. */
export function fromPathsD(ps: PathsD): [number, number][][] {
  const out: [number, number][][] = [];
  for (let i = 0, n = ps.size(); i < n; i++) {
    const path = ps.get(i),
      v = path.view(),
      q: [number, number][] = [];
    for (let k = 0; k < v.length; k += 3) q.push([v[k], v[k + 1]]);
    out.push(q);
    path.delete();
  }
  return out;
}
