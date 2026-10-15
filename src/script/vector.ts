// VectorStrip paths: straight-line polygons only ("M x y L x y … Z"), in strip cells, y up from the band's outer edge.
export type Polygon = [number, number][];

/** The polygons of a VectorStrip path. */
export function parsePolys(d: string): Polygon[] {
  const out: Polygon[] = [];
  for (const part of d.split('Z')) {
    const body = part.trim();
    if (!body) continue;
    out.push(
      body
        .slice(1)
        .split('L')
        .map(pt => {
          const [x, y] = pt.trim().split(/\s+/).map(Number);
          return [x, y] as [number, number];
        }),
    );
  }
  return out;
}
