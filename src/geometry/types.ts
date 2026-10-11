// Geometry conventions (COMPOSITION_ENGINE.md §11): screen coordinates, y down. Closed outlines run
// counter-clockwise on screen, so their shoelace area is negative; the inward normal of a stretch with unit tangent
// t is (t.y, -t.x).

export type Pt = [number, number];

export interface Corner {
  /** Index of the corner point in its ring. */
  index: number;
  p: Pt;
  /** Interior angle in radians (< π convex, > π concave). */
  interior: number;
  convex: boolean;
  /** Unit vector pointing into the region, halfway between the two edge normals. */
  bisector: Pt;
  /** How far a band of width h must keep back from the corner along each edge, in units of h: |cot(φ/2)|, capped. */
  clearance: number;
}

/** A closed outline: dense polyline (not repeating the first point) and its sharp corners. */
export interface Ring {
  pts: Pt[];
  corners: Corner[];
  /** Absolute area. */
  area: number;
  perimeter: number;
}

/** A smooth stretch of a ring between two corners (or the whole ring when it has none), with arc length. */
export interface Run {
  pts: Pt[];
  /** Cumulative arc length at each point. */
  cum: number[];
  len: number;
  start: Corner | null;
  end: Corner | null;
}

/** Position, unit tangent (direction of travel) and inward unit normal at some arc length along a run. */
export interface Frame {
  p: Pt;
  t: Pt;
  n: Pt;
}
