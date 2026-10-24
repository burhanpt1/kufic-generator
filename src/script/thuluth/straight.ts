// The balance of straight and round (the Persian principle; the lab's straight-to-round check, PLAN-2 §8): the share of
// letter stroke length that is straight. Each letter's centreline (its own samples, by stroke ownership) is resampled
// at a fortieth of its size, smoothed, and counted straight where its direction turns less than 9° over two steps.
// Calliar's masters measure 0.695 by length (1,240 letters).
import type { Stroke } from './types';

export const MASTER_STRAIGHT = 0.695;

/** Straight and total length of the letters in some strokes (marks left out). */
export function straightLength(strokes: readonly Stroke[]): { straight: number; total: number } {
  let straight = 0,
    total = 0;
  for (const st of strokes) {
    if (st.mark || !st.own) continue;
    // split the stroke into each letter's run of samples (joins, owned by none, are left out)
    const runs: { x: number; y: number }[][] = [];
    st.s.forEach((q, k) => {
      const o = st.own![k];
      if (o < 0) return;
      if (k > 0 && st.own![k - 1] === o && runs.length) runs[runs.length - 1].push(q);
      else runs.push([q]);
    });
    for (const run of runs) {
      if (run.length < 3) continue;
      const xs = run.map(q => q.x),
        ys = run.map(q => q.y),
        size = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
      if (size < 1e-6) continue;
      // resample by arc length at a fortieth of the letter's size
      const step = size / 40,
        pts: [number, number][] = [[run[0].x, run[0].y]];
      let carry = 0;
      for (let i = 1; i < run.length; i++) {
        const ax = run[i - 1].x,
          ay = run[i - 1].y,
          L = Math.hypot(run[i].x - ax, run[i].y - ay);
        let t = step - carry;
        while (t <= L) {
          pts.push([ax + ((run[i].x - ax) * t) / L, ay + ((run[i].y - ay) * t) / L]);
          t += step;
        }
        carry = L - (t - step);
      }
      if (pts.length < 5) continue;
      // smoothed by a three-point average, then the direction at each step
      const sm = pts.map((p, i) => {
          const a = pts[Math.max(0, i - 1)],
            b = pts[Math.min(pts.length - 1, i + 1)];
          return [(a[0] + p[0] + b[0]) / 3, (a[1] + p[1] + b[1]) / 3];
        }),
        dir = sm.slice(1).map((p, i) => Math.atan2(p[1] - sm[i][1], p[0] - sm[i][0]));
      for (let i = 0; i < dir.length; i++) {
        const j = Math.min(dir.length - 1, i + 2);
        let turn = Math.abs(dir[j] - dir[i]);
        if (turn > Math.PI) turn = 2 * Math.PI - turn;
        total += step;
        if (turn < (9 * Math.PI) / 180) straight += step;
      }
    }
  }
  return { straight, total };
}
