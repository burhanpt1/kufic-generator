// Outline import from SVG files.
import { importSvgPath } from '../../geometry/svgpath';

/** The outline path data from an SVG file: the path (or polygon) with the largest closed area. */
export function svgOutline(text: string): string | null {
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  const ds: string[] = [];
  doc.querySelectorAll('path').forEach(p => p.getAttribute('d') && ds.push(p.getAttribute('d')!));
  doc.querySelectorAll('polygon').forEach(p => {
    const pts = (p.getAttribute('points') ?? '').trim();
    if (pts) ds.push('M' + pts + 'Z');
  });
  let best: string | null = null,
    bestA = 0;
  for (const d of ds)
    try {
      const P = importSvgPath(d);
      let a = 0;
      for (let i = 0; i < P.length; i++) {
        const [x0, y0] = P[i],
          [x1, y1] = P[(i + 1) % P.length];
        a += x0 * y1 - x1 * y0;
      }
      if (Math.abs(a) > bestA) {
        bestA = Math.abs(a);
        best = d;
      }
    } catch {
      /* not a closed path */
    }
  return best;
}
