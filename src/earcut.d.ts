declare module 'earcut' {
  /** Triangulates a polygon (flat [x0, y0, x1, y1, ...]) with holes starting at the given vertex indices. */
  export default function earcut(
    data: ArrayLike<number>,
    holeIndices?: ArrayLike<number> | null,
    dim?: number,
  ): number[];
}
