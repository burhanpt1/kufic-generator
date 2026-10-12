// Seal search kernel: simulated annealing over letter positions and variants (src/kernels/seal.c).
// Two backends with bit-identical results: the C kernel compiled to WebAssembly (about 7× faster), and an exact
// TypeScript port of the same code (same Park–Miller sequence, same arithmetic, same evaluation order), used until
// or unless the WebAssembly loads. So a composition and seed give the same seal everywhere.
import { WASM_BASE64 } from './seal.wasm';

export const MAXG = 40000;

/** Kernel input. Flat int arrays, laid out exactly as seal.c reads them. */
export interface SealInput {
  /** Per letter: [variant count, first variant index]. */
  L: number[];
  /** Per variant (7 ints): w, h, cost×1000, first cell, cell count, first join, join count. */
  V: number[];
  /** Per cell (3 ints): x, y, shareable (1/0). */
  C: number[];
  /** Per join (3 ints): x, y, direction (−1 left, 1 right). */
  J: number[];
  /** Per letter (3 ints): x, y, variant; the starting state. */
  P: number[];
  n: number;
  N: number;
  copies: number;
  /** 0 none, 1 mirror, 2 turn. */
  sym: number;
  iters: number;
  seed: number;
  shareMilli: number;
  ink0: number;
  /** Energy per solid 2×2 block of ink (letters that collided), ×1000; 0 or absent = no penalty. */
  blockMilli?: number;
  /** Energy per unit of reading-order violation between consecutive pieces (word seals), ×1000; 0 = none. */
  orderMilli?: number;
  /** Energy per cell of difference between the seal's width and height, ×1000; absent = 2500. */
  squareMilli?: number;
}
export interface SealOutput {
  P: number[];
  /** shared, clash, touch, joined, dangling, bw, bh, area, then per-letter hurt. */
  S: number[];
  engine: 'wasm' | 'js';
}

const MEM_INTS = 1 << 20;

/** Lay the input out in one int32 memory and return the offsets (as the lab did). */
function layout(m: Int32Array, inp: SealInput) {
  const offL = 0,
    offV = offL + inp.L.length,
    offC = offV + inp.V.length,
    offJ = offC + inp.C.length,
    offP = offJ + inp.J.length + 3,
    offS = offP + inp.n * 3;
  if (offS + 8 + inp.n >= MEM_INTS) return null;
  m.set(inp.L, offL);
  m.set(inp.V, offV);
  m.set(inp.C, offC);
  m.set(inp.J, offJ);
  m.set(inp.P, offP);
  return { offL, offV, offC, offJ, offP, offS };
}

// ---------------- TypeScript port of seal.c ----------------
function runJS(m: Int32Array, inp: SealInput, o: NonNullable<ReturnType<typeof layout>>): number {
  const { n, N, copies, sym } = inp,
    { offL: Lt, offV: Vt, offC: Ct, offJ: Jt, offP: Pt, offS: St } = o;
  if (N * N > MAXG) return -1;
  const cnt = new Uint8Array(MAXG),
    shAll = new Uint8Array(MAXG),
    ok8 = new Uint8Array(MAXG),
    who = new Int16Array(MAXG).fill(-1),
    touched = new Int32Array(MAXG),
    okl = new Int32Array(MAXG);
  let nt = 0,
    nok = 0,
    seed = inp.seed;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647.0;
  };
  const fl = (v: number) => {
    const i = Math.trunc(v);
    return v < 0 && v !== i ? i - 1 : i;
  };
  const expo = (x: number) => {
    if (x < -40) return 0;
    let k = 0;
    while (x < -0.5) {
      x /= 2;
      k++;
    }
    let r = 1 + x * (1 + x * (0.5 + x * (1.0 / 6 + x * (1.0 / 24 + x / 120.0))));
    while (k--) r *= r;
    return r;
  };
  const blockW = (inp.blockMilli ?? 0) / 1000.0,
    orderW = (inp.orderMilli ?? 0) / 1000.0,
    squareW = (inp.squareMilli ?? 2500) / 1000.0;
  const tf = (x: number, y: number, t: number): [number, number] =>
    !t ? [x, y] : sym === 1 ? [N - 1 - x, y] : [N - 1 - x, N - 1 - y];
  const mark8 = (k: number) => {
    const x = k % N,
      y = (k - x) / N;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const X = x + dx,
          Y = y + dy;
        if (X < 0 || Y < 0 || X >= N || Y >= N) continue;
        const kk = Y * N + X;
        if (!ok8[kk]) {
          ok8[kk] = 1;
          okl[nok++] = kk;
        }
      }
  };
  const VAR = (i: number) => Vt + (m[Lt + i * 2 + 1] + m[Pt + i * 3 + 2]) * 7;
  const energy = (share: number, ink0: number, detail: boolean): number => {
    nt = 0;
    nok = 0;
    let ink = 0,
      cost = 0;
    for (let t = 0; t < copies; t++)
      for (let i = 0; i < n; i++) {
        const v = VAR(i),
          px = m[Pt + i * 3],
          py = m[Pt + i * 3 + 1],
          id = i + n * t;
        if (!t) cost += m[v + 2] / 1000.0;
        for (let c = 0; c < m[v + 4]; c++) {
          const cc = Ct + (m[v + 3] + c) * 3,
            [X, Y] = tf(m[cc] + px, m[cc + 1] + py, t),
            k = Y * N + X;
          if (!cnt[k]) {
            touched[nt++] = k;
            who[k] = id;
            shAll[k] = 1;
          } else if (who[k] !== id) who[k] = -2;
          cnt[k]++;
          if (!m[cc + 2]) shAll[k] = 0;
          ink++;
        }
      }
    let shared = 0,
      clash = 0,
      touch = 0,
      joined = 0,
      dangling = 0;
    for (let q = 0; q < nt; q++) {
      const k = touched[q];
      if (cnt[k] >= 2) {
        if (shAll[k]) {
          shared++;
          mark8(k);
        } else clash += cnt[k] - 1;
      }
    }
    let blocks = 0; // solid 2×2 ink, counted at its top-left cell: letters that have collided
    for (let q = 0; q < nt; q++) {
      const k = touched[q],
        x = k % N;
      if (x < N - 1 && k + N + 1 < N * N && cnt[k + 1] && cnt[k + N] && cnt[k + N + 1]) blocks++;
    }
    if (detail) for (let i = 0; i < n; i++) m[St + 8 + i] = 0;
    for (let t = 0; t < copies; t++)
      for (let i = 0; i < n; i++) {
        const v = VAR(i),
          px = m[Pt + i * 3],
          py = m[Pt + i * 3 + 1],
          id = i + n * t;
        for (let j = 0; j < m[v + 6]; j++) {
          const jj = Jt + (m[v + 5] + j) * 3,
            [X, Y] = tf(m[jj] + px + m[jj + 2], m[jj + 1] + py, t),
            [X0, Y0] = tf(m[jj] + px, m[jj + 1] + py, t);
          const inside = X >= 0 && Y >= 0 && X < N && Y < N,
            k = inside ? Y * N + X : 0;
          if (inside && cnt[k] && who[k] !== id) {
            joined++;
            mark8(k);
            mark8(Y0 * N + X0);
          } else {
            dangling++;
            if (detail) m[St + 8 + i] += 3;
          }
        }
      }
    for (let t = 0; t < copies; t++)
      for (let i = 0; i < n; i++) {
        const v = VAR(i),
          px = m[Pt + i * 3],
          py = m[Pt + i * 3 + 1],
          id = i + n * t;
        for (let c = 0; c < m[v + 4]; c++) {
          const cc = Ct + (m[v + 3] + c) * 3,
            [X, Y] = tf(m[cc] + px, m[cc + 1] + py, t),
            k = Y * N + X;
          if (detail && cnt[k] >= 2 && !shAll[k]) m[St + 8 + i] += 2;
          if (ok8[k]) continue;
          for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++) {
              if (!dx && !dy) continue;
              const XX = X + dx,
                YY = Y + dy;
              if (XX < 0 || YY < 0 || XX >= N || YY >= N) continue;
              const kk = YY * N + XX;
              if (cnt[kk] && who[kk] >= 0 && who[kk] !== id) {
                touch++;
                if (detail) m[St + 8 + i]++;
              }
            }
        }
      }
    let x0 = 1 << 30,
      y0 = 1 << 30,
      x1 = -(1 << 30),
      y1 = -(1 << 30);
    for (let t = 0; t < copies; t++)
      for (let i = 0; i < n; i++) {
        const v = VAR(i),
          px = m[Pt + i * 3],
          py = m[Pt + i * 3 + 1];
        let [X, Y] = tf(px, py, t);
        if (X < x0) x0 = X;
        if (X + 1 > x1) x1 = X + 1;
        if (Y < y0) y0 = Y;
        if (Y + 1 > y1) y1 = Y + 1;
        [X, Y] = tf(px + m[v] - 1, py + m[v + 1] - 1, t);
        if (X < x0) x0 = X;
        if (X + 1 > x1) x1 = X + 1;
        if (Y < y0) y0 = Y;
        if (Y + 1 > y1) y1 = Y + 1;
      }
    // reading order (word seals): each next piece reads to the left on the same line, or starts a lower one; in
    // doubled cell units, integer as in seal.c
    let order = 0;
    if (orderW > 0)
      for (let i = 0; i + 1 < n; i++) {
        const a = VAR(i),
          b = VAR(i + 1),
          ax = 2 * m[Pt + i * 3] + m[a],
          ay = 2 * m[Pt + i * 3 + 1] + m[a + 1],
          bx = 2 * m[Pt + (i + 1) * 3] + m[b],
          by = 2 * m[Pt + (i + 1) * 3 + 1] + m[b + 1],
          dy = by - ay;
        if (dy < 0) order -= dy;
        if (2 * Math.abs(dy) < m[a + 1] + m[b + 1] && bx - ax + 2 > 0) order += bx - ax + 2;
      }
    const bw = x1 - x0,
      bh = y1 - y0,
      area = bw * bh,
      d = bw > bh ? bw - bh : bh - bw;
    const E =
      60.0 * clash +
      5.0 * touch -
      share * 9 * shared +
      18.0 * dangling -
      share * 6 * joined +
      (22.0 * (area - ink)) / ink0 +
      squareW * d +
      0.3 * cost * copies +
      blockW * blocks +
      orderW * order;
    if (detail) {
      m[St] = shared;
      m[St + 1] = clash;
      m[St + 2] = touch;
      m[St + 3] = joined;
      m[St + 4] = dangling;
      m[St + 5] = bw;
      m[St + 6] = bh;
      m[St + 7] = area;
    }
    for (let q = 0; q < nt; q++) {
      cnt[touched[q]] = 0;
      who[touched[q]] = -1;
    }
    for (let q = 0; q < nok; q++) ok8[okl[q]] = 0;
    return E;
  };
  const clampP = (i: number) => {
    const v = VAR(i);
    if (m[Pt + i * 3] > N - m[v]) m[Pt + i * 3] = N - m[v];
    if (m[Pt + i * 3] < 0) m[Pt + i * 3] = 0;
    if (m[Pt + i * 3 + 1] > N - m[v + 1]) m[Pt + i * 3 + 1] = N - m[v + 1];
    if (m[Pt + i * 3 + 1] < 0) m[Pt + i * 3 + 1] = 0;
  };
  const share = inp.shareMilli / 1000.0,
    iters = inp.iters;
  let E = energy(share, inp.ink0, false),
    T = 30;
  const decay = expo(-6.39693 / iters);
  for (let it = 0; it < iters; it++) {
    const i = fl(rnd() * n),
      ox = m[Pt + i * 3],
      oy = m[Pt + i * 3 + 1],
      ov = m[Pt + i * 3 + 2];
    let j = -1,
      jx = 0,
      jy = 0;
    const mv = rnd();
    if (mv < 0.58) {
      m[Pt + i * 3] += fl((rnd() - 0.5) * 6 + 0.5);
      m[Pt + i * 3 + 1] += fl((rnd() - 0.5) * 6 + 0.5);
      clampP(i);
    } else if (mv < 0.76 && m[Lt + i * 2] > 1) {
      m[Pt + i * 3 + 2] = fl(rnd() * m[Lt + i * 2]);
      clampP(i);
    } else if (mv < 0.9 && n > 1) {
      j = (i + 1 + fl(rnd() * (n - 1))) % n;
      jx = m[Pt + j * 3];
      jy = m[Pt + j * 3 + 1];
      m[Pt + i * 3] = jx;
      m[Pt + i * 3 + 1] = jy;
      m[Pt + j * 3] = ox;
      m[Pt + j * 3 + 1] = oy;
      clampP(i);
      clampP(j);
    } else {
      const v = VAR(i);
      m[Pt + i * 3] = fl(rnd() * (N - m[v]));
      m[Pt + i * 3 + 1] = fl(rnd() * (N - m[v + 1]));
    }
    const E2 = energy(share, inp.ink0, false);
    if (E2 <= E || rnd() < expo((E - E2) / T)) E = E2;
    else {
      m[Pt + i * 3] = ox;
      m[Pt + i * 3 + 1] = oy;
      m[Pt + i * 3 + 2] = ov;
      if (j >= 0) {
        m[Pt + j * 3] = jx;
        m[Pt + j * 3 + 1] = jy;
      }
    }
    T = T * decay;
    if (T < 0.05) T = 0.05;
  }
  energy(share, inp.ink0, true);
  return 0;
}

// ---------------- WebAssembly backend ----------------
interface SealWasm {
  memory: WebAssembly.Memory;
  buf: () => number;
  run: (...a: number[]) => number;
}
let wasm: SealWasm | null = null;
let loading: Promise<boolean> | null = null;
const wasmBytes = () => Uint8Array.from(atob(WASM_BASE64), c => c.charCodeAt(0));

/** Load the WebAssembly kernel (asynchronous compile: allowed on a browser's main thread). */
export function loadSealWasm(): Promise<boolean> {
  if (wasm) return Promise.resolve(true);
  loading ??= WebAssembly.instantiate(wasmBytes(), {})
    .then(r => ((wasm = r.instance.exports as unknown as SealWasm), true))
    .catch(() => false);
  return loading;
}
/** Synchronous load, for Node and workers (browsers refuse synchronous compiles over 4 KB on the main thread). */
export function loadSealWasmSync(): boolean {
  if (wasm) return true;
  try {
    wasm = new WebAssembly.Instance(new WebAssembly.Module(wasmBytes()), {}).exports as unknown as SealWasm;
    return true;
  } catch {
    return false;
  }
}
export const sealWasmLoaded = () => !!wasm;
/** For tests: drop the WebAssembly backend. */
export const unloadSealWasm = () => {
  wasm = null;
  loading = null;
  triedSync = true;
};

let triedSync = false;
export function runSeal(inp: SealInput, backend: 'auto' | 'js' | 'wasm' = 'auto'): SealOutput | null {
  // Node and workers can compile synchronously; a browser's main thread refuses and keeps the identical JS port
  if (backend === 'auto' && !wasm && !triedSync) {
    triedSync = true;
    loadSealWasmSync();
  }
  const useWasm = backend === 'wasm' || (backend === 'auto' && !!wasm);
  if (useWasm && !wasm) throw new Error('seal WebAssembly kernel not loaded');
  const m = useWasm ? new Int32Array(wasm!.memory.buffer, wasm!.buf(), MEM_INTS) : new Int32Array(MEM_INTS);
  const o = layout(m, inp);
  if (!o) return null;
  const rc = useWasm
    ? wasm!.run(
        inp.n,
        inp.N,
        inp.copies,
        inp.sym,
        inp.iters,
        inp.seed,
        inp.shareMilli,
        inp.ink0,
        o.offL,
        o.offV,
        o.offC,
        o.offJ,
        o.offP,
        o.offS,
        inp.blockMilli ?? 0,
        inp.orderMilli ?? 0,
        inp.squareMilli ?? 2500,
      )
    : runJS(m, inp, o);
  if (rc !== 0) return null;
  return {
    P: Array.from(m.subarray(o.offP, o.offP + inp.n * 3)),
    S: Array.from(m.subarray(o.offS, o.offS + 8 + inp.n)),
    engine: useWasm ? 'wasm' : 'js',
  };
}
