// The thuluth compositions kept as goldens (tests/golden-thuluth): borders on a circle and a polygon, a line fill, and
// a Kufic ring round thuluth.
import type { Composition, Style } from '../../src/model/schema';
import { PRESETS, TEXTS } from '../../src/model/presets';
import { DEFAULT_STYLE, PALETTES } from '../../src/model/style';

export const TH: Partial<Style> = { script: 'thuluth', pen: { preset: 'band' } };
const slot = (text: string) => ({ text, repeat: 'fill' as const, wordGap: 2 });
export const style = (o: Partial<Style> = {}): Style => ({ ...structuredClone(DEFAULT_STYLE), ...o }) as Style;

/** The cases, by name. */
export const THULUTH_CASES: Record<string, Composition> = {
  'circle-names': {
    version: 1,
    seed: 11,
    canvas: { shape: 'square', margin: 3 },
    style: style({ ...TH, palette: { ...PALETTES.cobalt }, colouring: 'byRing' }),
    texts: { names: slot(TEXTS.names) },
    root: {
      type: 'frame',
      child: {
        type: 'region',
        outline: { kind: 'circle' },
        borders: [{ type: 'textBorder', text: 'names', separator: { kind: 'braid', width: 2 } }],
      },
    },
  },
  'octagon-shahada': (() => {
    const c = structuredClone(PRESETS.find(p => p.id === 'octagon-panel')!.comp);
    c.style = { ...c.style, ...TH } as Style;
    return c;
  })(),
  'mihrab-lines': (() => {
    const c = structuredClone(PRESETS.find(p => p.id === 'mihrab-ayat-al-kursi')!.comp);
    c.style = { ...c.style, ...TH } as Style;
    return c;
  })(),
  'kufic-ring-thuluth-centre': {
    version: 1,
    seed: 7,
    canvas: { shape: 'square', margin: 3 },
    style: style({ palette: { ...PALETTES.goldOnLapis } }),
    texts: { ring: slot('محمد علي فاطمة الحسن الحسين'), centre: slot('مودة ورحمة') },
    root: {
      type: 'frame',
      child: {
        type: 'region',
        outline: { kind: 'circle' },
        borders: [{ type: 'textBorder', text: 'ring', separator: { kind: 'braid', width: 2 } }],
        fill: {
          type: 'region',
          node: {
            type: 'region',
            style: TH,
            outline: { kind: 'circle' },
            borders: [{ type: 'textBorder', text: 'centre', separator: { kind: 'pearls', width: 2 } }],
          },
        },
      },
    },
  },
};
