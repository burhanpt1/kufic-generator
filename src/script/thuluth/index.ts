// Thuluth: a pen-stroke script engine (see prototypes/thuluth-lab/HANDOVER.md).
export * from './types';
export { DEFAULT_THULUTH, ROUNDEL_PEN, TILE_PEN, inkPolys, isLetter, thuluth } from './engine';
export type { Built, Dot, DotGroup, LineOptions, Placed, PlacedLetter, Thuluth } from './engine';
export { GREAT, HEH_FIN, LETTERS, TOOTH_FIN_LONG } from './letters.data';
export { dotPolys, nibPolys, polyPath, sampleStroke } from './pen';
export { Alpha, toPixels } from './raster';
export * from './shape';
export { kashidaJoin, parsePolys, thuluthScript } from './adapter';
export type { ThuluthPrepared, ThuluthSegment } from './adapter';
export { MARK_SHAPES, MARK_SIZE, lineMarks, markStrokes } from './marks';
export * from './roundel';
