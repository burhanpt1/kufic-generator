// Geometry core (COMPOSITION_ENGINE.md §5). Pure: no DOM.
export * from './types';
export * from './poly';
export { detectCorners, cumulative } from './corners';
export type { CornerOptions } from './corners';
export { offsetPolyline, insetRing, makeRing } from './offset';
export { runsOf, frameAt } from './runs';
export * from './outlines';
export { parsePath, flattenPath, importSvgPath, toPathData } from './svgpath';
export { deepestPoint } from './deepest';
export { shapeOf } from './shape';
export type { ShapeGeometry } from './shape';
