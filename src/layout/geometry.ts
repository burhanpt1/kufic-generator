// Geometry: outer size L (square side or circle radius, screen cells) -> rings with their scale and capacity.

export interface SquareRingGeom {
  o: number;
  Lk: number;
  Ll: number;
  s: number;
  U: number;
}
export interface CircleRingGeom {
  Ro: number;
  s: number;
  Rl: number;
  N: number;
  U: number;
}

export function geomSquare(L: number, n: number, Hb: number, gap: number, taper: number, cf: number, cb: number) {
  const out: SquareRingGeom[] = [];
  let o = 0;
  for (let k = 0; k < n; k++) {
    const Lk = L - 2 * o;
    if (Lk <= 0) return null;
    const s0 = Math.max(0.4, Math.pow(Lk / L, taper)),
      Ll = Math.round(Lk / s0),
      s = Lk / Ll,
      U = Ll - Hb - 1 - cb;
    if (U < 1) return null;
    out.push({ o, Lk, Ll, s, U });
    o += (Hb + gap) * s;
  }
  const free = L - 2 * o; // free square inside
  if (free < cf * L) return null;
  return { rings: out, centre: { o, C: free } };
}
export function geomCircle(R: number, n: number, Hb: number, gap: number, taper: number, cf: number) {
  const out: CircleRingGeom[] = [];
  let Ro = R;
  const minInner = Math.max(3, Math.round(Hb * 0.9));
  for (let k = 0; k < n; k++) {
    const s = Math.max(0.4, Math.pow(Ro / R, taper)),
      Rl = Ro / s;
    if (Rl - Hb < minInner) return null;
    const N = Math.round(2 * Math.PI * (Rl - Hb / 2));
    out.push({ Ro, s, Rl, N, U: N - 1 });
    Ro -= (Hb + gap) * s;
  }
  if (Ro < cf * R) return null;
  return { rings: out, free: Ro };
}
