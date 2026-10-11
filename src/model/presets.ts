// Saved trees shipped with the app (COMPOSITION_ENGINE.md §8).
import type { Composition, RegionNode, Style, TextSlot } from './schema';
import { DEFAULT_STYLE, PALETTES } from './style';

export const TEXTS = {
  basmala: 'بسم الله الرحمن الرحيم',
  names: 'محمد علي فاطمة\nالحسن الحسين',
  shahada: 'لا اله الا الله محمد رسول الله',
  ayatKursi:
    'الله لا اله الا هو الحي القيوم لا تأخذه سنة ولا نوم له ما في السماوات وما في الأرض من ذا الذي يشفع عنده الا بإذنه يعلم ما بين أيديهم وما خلفهم ولا يحيطون بشيء من علمه الا بما شاء وسع كرسيه السماوات والأرض ولا يئوده حفظهما وهو العلي العظيم',
  yaAli: 'يا علي مدد',
  muhammad: 'محمد',
};

const slot = (text: string, extra: Partial<TextSlot> = {}): TextSlot => ({
  text,
  repeat: 'fill',
  wordGap: 2,
  ...extra,
});
const style = (o: { [K in keyof Style]?: Partial<Style[K]> | Style[K] } = {}): Style => {
  const s = structuredClone(DEFAULT_STYLE) as Style;
  for (const [k, v] of Object.entries(o))
    (s as unknown as Record<string, unknown>)[k] =
      v && typeof v === 'object' ? { ...(s as unknown as Record<string, object>)[k], ...v } : v;
  return s;
};
const comp = (
  seed: number,
  st: Style,
  texts: Record<string, TextSlot>,
  child: RegionNode,
  spandrels?: Composition['root']['spandrels'],
): Composition => ({
  version: 1,
  seed,
  canvas: { shape: 'square', margin: 3 },
  style: st,
  texts,
  root: { type: 'frame', ...(spandrels ? { spandrels } : {}), child },
});
const star8 = { tiling: '488' as const, angle: 67, scale: 5 };

export const PRESETS: { id: string; name: string; comp: Composition }[] = [
  {
    id: 'fatimid-medallion',
    name: 'Fatimid medallion',
    comp: comp(
      4243,
      style({
        letter: { ascenders: 11 },
        terminals: { kind: 'palmette', reach: 'tails' },
        colouring: 'byRing',
        stroke: { weight: 0.8, softness: 0.3 },
      }),
      { basmala: slot(TEXTS.basmala), names: slot(TEXTS.names), mono: slot(TEXTS.basmala) },
      {
        type: 'region',
        outline: { kind: 'circle' },
        borders: [
          { type: 'textBorder', text: 'basmala', separator: { kind: 'braid', width: 4 }, ground: { kind: 'vine' } },
          { type: 'textBorder', text: 'names', taper: 0.5, separator: { kind: 'braid', width: 3 } },
        ],
        fill: {
          type: 'monogram',
          text: 'mono',
          method: 'seal',
          params: { H: 7, sym: 'mirror', box: 0.7, share: 2, tries: 4 },
        },
      },
      { type: 'pattern', pattern: star8 },
    ),
  },
  {
    id: 'mihrab-ayat-al-kursi',
    name: 'Mihrab of Ayat al-Kursi',
    comp: comp(
      7,
      style({
        terminals: { kind: 'palmette', reach: 'tails' },
        colouring: 'byRing',
        stroke: { kind: 'curved', corner: 0.5 },
      }),
      { basmala: slot(TEXTS.basmala), ayat: slot(TEXTS.ayatKursi, { repeat: 'once' }) },
      {
        type: 'region',
        outline: { kind: 'preset', name: 'mihrab' },
        borders: [
          { type: 'textBorder', text: 'basmala', separator: { kind: 'braid', width: 3 }, ground: { kind: 'tint' } },
        ],
        fill: { type: 'lines', text: 'ayat', lineGap: 1 },
      },
    ),
  },
  {
    id: 'octagon-panel',
    name: 'Octagon panel',
    comp: comp(
      11,
      style({ terminals: { kind: 'leaf', reach: 'tall' }, colouring: 'byRepeat', palette: { ...PALETTES.cobalt } }),
      { shahada: slot(TEXTS.shahada), names: slot(TEXTS.names) },
      {
        type: 'region',
        outline: { kind: 'polygon', sides: 8 },
        borders: [
          {
            type: 'textBorder',
            text: 'shahada',
            separator: { kind: 'pearls', width: 3 },
            ground: { kind: 'pattern', pattern: { tiling: 'hex', angle: 60, scale: 4 } },
          },
          { type: 'textBorder', text: 'names', taper: 0.5, separator: { kind: 'lines', width: 2 } },
        ],
        features: { tips: 'finial', corners: 'diamond' },
        fill: { type: 'pattern', pattern: star8 },
      },
      { type: 'stars' },
    ),
  },
  {
    id: 'basmala-seal',
    name: 'Basmala seal',
    comp: comp(
      101,
      style({ palette: { ...PALETTES.ink }, stroke: { weight: 0.9, softness: 0 } }),
      { basmala: slot(TEXTS.basmala) },
      {
        type: 'region',
        outline: { kind: 'polygon', sides: 4 },
        size: 40,
        borders: [{ type: 'ornamentBorder', ornament: 'lines', width: 2 }],
        fill: {
          type: 'monogram',
          text: 'basmala',
          method: 'seal',
          params: { H: 7, sym: 'none', seed: 4243, dots: true, frame: 'double' },
        },
      },
    ),
  },
  {
    id: 'shahada-block',
    name: 'Shahada block',
    comp: comp(
      23,
      style({ palette: { ...PALETTES.bannaiBrick }, stroke: { softness: 0 } }),
      { shahada: slot(TEXTS.shahada) },
      {
        type: 'region',
        outline: { kind: 'polygon', sides: 4 },
        size: 44,
        borders: [{ type: 'ornamentBorder', ornament: 'chevron', width: 3 }],
        fill: { type: 'monogram', text: 'shahada', method: 'block', params: { alternate: true, H: 9, stretch: 2 } },
      },
    ),
  },
  {
    id: 'kufic-maze-tile',
    name: 'Kufic maze tile',
    comp: comp(
      7,
      style({ palette: { ...PALETTES.carvedStone }, stroke: { softness: 0.1 } }),
      { basmala: slot(TEXTS.basmala) },
      {
        type: 'region',
        outline: { kind: 'polygon', sides: 4 },
        size: 60,
        borders: [],
        fill: { type: 'maze', text: 'basmala', corridors: 0.7, wall: true },
      },
    ),
  },
  {
    id: 'teardrop-gold',
    name: 'Teardrop in gold',
    comp: comp(
      31,
      style({
        palette: { ...PALETTES.goldOnLapis },
        terminals: { kind: 'palmette', reach: 'tails' },
        colouring: 'byRing',
        stroke: { kind: 'curved', corner: 0.6 },
      }),
      { basmala: slot(TEXTS.basmala), yaAli: slot(TEXTS.yaAli) },
      {
        type: 'region',
        outline: { kind: 'preset', name: 'teardrop' },
        borders: [
          { type: 'textBorder', text: 'basmala', separator: { kind: 'braid', width: 3 }, ground: { kind: 'vine' } },
          { type: 'textBorder', text: 'yaAli', taper: 0.5, separator: { kind: 'pearls', width: 2 } },
        ],
        features: { tips: 'finial' },
        fill: { type: 'abjad', text: 'basmala' },
      },
      { type: 'vine' },
    ),
  },
  {
    id: 'hexagon-lapis',
    name: 'Hexagon on lapis',
    comp: comp(
      59,
      style({
        palette: { ...PALETTES.goldOnLapis },
        terminals: { kind: 'notch', reach: 'all' },
        colouring: 'radial',
        stroke: { banded: true },
      }),
      { basmala: slot(TEXTS.basmala), mono: slot('علي') },
      {
        type: 'region',
        outline: { kind: 'polygon', sides: 6 },
        borders: [
          { type: 'textBorder', text: 'basmala', separator: { kind: 'chevron', width: 3 }, ground: { kind: 'tint' } },
        ],
        fill: { type: 'monogram', text: 'mono', method: 'pinwheel', params: { H: 9, stretch: 2, nest: true } },
      },
      { type: 'pattern', pattern: { tiling: 'hex', angle: 60, scale: 4 } },
    ),
  },
];
export const preset = (id: string) => PRESETS.find(p => p.id === id)!.comp;
