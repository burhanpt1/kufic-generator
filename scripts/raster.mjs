// SVG -> PNG for visual references and comparisons (resvg: deterministic, no browser needed).
import { Resvg } from '@resvg/resvg-js';

export const RASTER_WIDTH = 480;
export function toPNG(svg, width = RASTER_WIDTH) {
  return new Resvg(svg, { fitTo: { mode: 'width', value: width }, background: 'white' }).render().asPng();
}
