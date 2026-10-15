// The mosque programme: compositions that nest regions, stack borders of scripture and combine every filler, for a
// qibla wall of a mosque meant to stop people at the door. Each piece is an ordinary composition (it opens in the
// studio); poster.ts assembles them into one elevation.
import type { Composition, RegionNode, Style, TextSlot } from '../model/schema';
import { DEFAULT_STYLE, PALETTES } from '../model/style';
import { T } from './texts';

const slot = (text: string, extra: Partial<TextSlot> = {}): TextSlot => ({
  text,
  repeat: 'fill',
  wordGap: 2,
  ...extra,
});
const once = (text: string) => slot(text, { repeat: 'once' });
export const style = (o: { [K in keyof Style]?: Partial<Style[K]> | Style[K] } = {}): Style => {
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
  shape: Composition['canvas']['shape'] = 'square',
): Composition => ({
  version: 1,
  seed,
  canvas: { shape, margin: 3 },
  style: st,
  texts,
  root: { type: 'frame', ...(spandrels ? { spandrels } : {}), child },
});

const GOLD = PALETTES.goldOnLapis,
  CHALK = PALETTES.chalk,
  COBALT = PALETTES.cobalt;

/** The dome: the Ninety-Nine Names, then the Light Verse running on into Ayat al-Kursi, in rings, then al-Rahman 55:26–27 and
 *  al-Ikhlas, around an eight-point star of the tasbih, around an octagon of the shahada, around a pinwheel of the name of God. */
export const dome = (): Composition =>
  comp(
    99,
    style({
      palette: { ...GOLD },
      letter: { ascenders: 11 },
      terminals: { kind: 'palmette', reach: 'tails', flourish: 'sprouts' },
      colouring: 'byRing',
      stroke: { kind: 'curved', corner: 0.6, weight: 0.85, contrast: 0.45, taper: 0.5 },
    }),
    {
      names: once(T.names),
      verses: once(T.nur + ' ' + T.kursi),
      tasbih: slot(T.tasbih),
      rahman: slot(T.rahman),
      ikhlas: slot(T.ikhlas),
      shahada: slot(T.shahada),
      allah: slot(T.allah),
    },
    {
      type: 'region',
      outline: { kind: 'circle' },
      borders: [
        { type: 'textBorder', text: 'names', separator: { kind: 'braid', width: 4 }, ground: { kind: 'vine' } },
        { type: 'textBorder', text: 'verses', taper: 0.3, separator: { kind: 'pearls', width: 3 } },
        {
          type: 'textBorder',
          text: 'rahman',
          taper: 0.3,
          separator: { kind: 'chevron', width: 3 },
          ground: { kind: 'tint' },
        },
        { type: 'textBorder', text: 'ikhlas', taper: 0.3, separator: { kind: 'braid', width: 3 } },
      ],
      fill: {
        type: 'region',
        node: {
          type: 'region',
          outline: { kind: 'star', points: 8, depth: 0.72 },
          borders: [
            {
              type: 'textBorder',
              text: 'tasbih',
              separator: { kind: 'chevron', width: 3 },
              ground: { kind: 'pattern', pattern: { tiling: '31212', angle: 60, scale: 4 } },
            },
          ],
          features: { tips: 'finial' },
          style: { palette: { ...CHALK } },
          fill: {
            type: 'region',
            node: {
              type: 'region',
              outline: { kind: 'polygon', sides: 8 },
              spread: 1.6,
              borders: [{ type: 'textBorder', text: 'shahada', separator: { kind: 'pearls', width: 2 } }],
              features: { corners: 'star' },
              style: { palette: { ...GOLD } },
              fill: { type: 'monogram', text: 'allah', method: 'pinwheel', params: { H: 9, stretch: 2, nest: true } },
            },
          },
        },
      },
    },
    { type: 'pattern', pattern: { tiling: '31212', angle: 60, scale: 5 } },
  );

/** The mihrab: the qibla verse (2:144) and the foundation verse of mosques (9:18) around an inner arch of
 *  al-Fatiha, carved stone outside and gold on lapis within. */
export const mihrab = (): Composition =>
  comp(
    144,
    style({
      palette: { ...PALETTES.carvedStone },
      letter: { ascenders: 11 },
      terminals: { kind: 'palmette', reach: 'tails' },
      colouring: 'byRing',
      stroke: { kind: 'curved', corner: 0.6, weight: 0.85, contrast: 0.4, taper: 0.5 },
    }),
    {
      qibla: slot(T.qiblaTurn),
      tawba: slot(T.tawba),
      basmala: slot(T.basmala),
      fatiha: once(T.fatiha),
    },
    {
      type: 'region',
      outline: { kind: 'preset', name: 'mihrab' },
      borders: [
        { type: 'textBorder', text: 'qibla', separator: { kind: 'braid', width: 4 }, ground: { kind: 'vine' } },
        { type: 'textBorder', text: 'tawba', taper: 0.3, separator: { kind: 'pearls', width: 3 } },
      ],
      features: { tips: 'finial' },
      fill: {
        type: 'region',
        node: {
          type: 'region',
          outline: { kind: 'preset', name: 'mihrab' },
          borders: [
            {
              type: 'textBorder',
              text: 'basmala',
              scale: 0.6,
              separator: { kind: 'chevron', width: 3 },
              ground: { kind: 'pattern', pattern: { tiling: '488', angle: 67, scale: 4 } },
            },
          ],
          style: { palette: { ...COBALT } },
          fill: { type: 'lines', text: 'fatiha', lineGap: 1, vary: 0.5 },
        },
      },
    },
    { type: 'vine' },
    'portrait',
  );

/** The portal (pishtaq): a square frame of the foundation verse (9:18) around an arch of al-Jinn 72:18, the
 *  mosques belong to God, over a flowing field of al-Asr. */
export const portal = (): Composition =>
  comp(
    18,
    style({
      palette: { ...PALETTES.bannaiBrick },
      letter: { ascenders: 9 },
      terminals: { kind: 'notch', reach: 'all' },
      colouring: 'byRing',
      stroke: { kind: 'blocks', softness: 0, banded: true },
    }),
    { tawba: slot(T.tawba), jinn: slot(T.jinn), asr: once(T.asr), akbar: slot(T.akbar) },
    {
      type: 'region',
      outline: { kind: 'polygon', sides: 4 },
      borders: [
        { type: 'textBorder', text: 'tawba', separator: { kind: 'chevron', width: 3 }, ground: { kind: 'tint' } },
        { type: 'textBorder', text: 'akbar', taper: 0.3, separator: { kind: 'lines', width: 2 } },
      ],
      features: { corners: 'star' },
      fill: {
        type: 'region',
        node: {
          type: 'region',
          outline: { kind: 'preset', name: 'mihrab' },
          borders: [{ type: 'textBorder', text: 'jinn', scale: 0.6, separator: { kind: 'braid', width: 3 } }],
          style: { palette: { ...COBALT } },
          fill: { type: 'flow', text: 'asr', lineGap: 1, strength: 0.6 },
        },
      },
    },
  );

/** A minaret shaft: all ninety-nine names stacked line by line, framed by the shahada. */
export const minaret = (): Composition =>
  comp(
    786,
    style({
      palette: { ...PALETTES.cobalt },
      letter: { ascenders: 9, set: 'fatimid', alternates: true },
      terminals: { kind: 'leaf', reach: 'tall' },
      colouring: 'byRepeat',
      stroke: { kind: 'curved', corner: 0.6, weight: 0.85 },
    }),
    { shahada: slot(T.shahada), names: once(T.names) },
    {
      type: 'region',
      outline: {
        kind: 'poly',
        points: [
          [-0.13, 1],
          [0.13, 1],
          [0.13, -0.88],
          [0, -1],
          [-0.13, -0.88],
        ],
      },
      borders: [{ type: 'textBorder', text: 'shahada', separator: { kind: 'pearls', width: 3 } }],
      fill: { type: 'lines', text: 'names', lineGap: 1 },
    },
    undefined,
    'portrait',
  );

/** The floor: no might nor power except through God, as an interlaced maze. */
export const floor = (): Composition =>
  comp(
    7,
    style({ palette: { ...PALETTES.carvedStone }, stroke: { softness: 0.1 }, colouring: 'byRepeat' }),
    { hawqala: slot(T.hawqala) },
    {
      type: 'region',
      outline: { kind: 'polygon', sides: 4 },
      size: 72,
      borders: [{ type: 'ornamentBorder', ornament: 'braid', width: 3 }],
      fill: { type: 'maze', text: 'hawqala', corridors: 0.7, wall: true, interlace: true },
    },
  );

/** Roundel: the basmala and its abjad value, 786. */
export const abjadRoundel = (): Composition =>
  comp(
    786,
    style({
      palette: { ...GOLD },
      terminals: { kind: 'palmette', reach: 'tails' },
      colouring: 'byRing',
      stroke: { kind: 'curved', corner: 0.6 },
    }),
    { basmala: slot(T.basmala), akbar: slot(T.akbar) },
    {
      type: 'region',
      outline: { kind: 'circle' },
      borders: [
        { type: 'textBorder', text: 'basmala', separator: { kind: 'braid', width: 3 }, ground: { kind: 'vine' } },
        { type: 'textBorder', text: 'akbar', taper: 0.5, separator: { kind: 'pearls', width: 2 } },
      ],
      fill: { type: 'abjad', text: 'basmala' },
    },
    { type: 'vine' },
  );

/** Roundel: the tasbih woven as a lattice inside a hexagon of the Light Verse's opening. */
export const latticeRoundel = (): Composition =>
  comp(
    33,
    style({ palette: { ...CHALK }, colouring: 'byRepeat', stroke: { softness: 0.1 } }),
    { tasbih: slot(T.tasbih), nur: slot('الله نور السماوات والأرض') },
    {
      type: 'region',
      outline: { kind: 'polygon', sides: 6 },
      borders: [
        { type: 'textBorder', text: 'nur', separator: { kind: 'chevron', width: 3 }, ground: { kind: 'tint' } },
      ],
      fill: { type: 'lattice', text: 'tasbih' },
    },
    { type: 'pattern', pattern: { tiling: 'hex', angle: 60, scale: 4 } },
  );

/** Roundel: the name of God running along the strands of an eight-fold star pattern, inside an octagon of
 *  God is greatest. */
export const strapRoundel = (): Composition =>
  comp(
    8,
    style({ palette: { ...COBALT }, colouring: 'byRepeat', stroke: { kind: 'curved', corner: 0.6 } }),
    { allah: slot(T.allah), akbar: slot(T.akbar) },
    {
      type: 'region',
      outline: { kind: 'polygon', sides: 8 },
      borders: [{ type: 'textBorder', text: 'akbar', separator: { kind: 'pearls', width: 3 } }],
      features: { corners: 'diamond' },
      fill: { type: 'strapwork', text: 'allah', tiling: '488' },
    },
    { type: 'stars' },
  );

/** The qibla wall: a field of eight-fold stars framed by the Ninety-Nine Names and the foundation verse. The other
 *  pieces are set into it as panels (poster.ts). */
export const wall = (): Composition =>
  comp(
    1,
    style({
      palette: { ...GOLD },
      letter: { ascenders: 11 },
      terminals: { kind: 'palmette', reach: 'tails' },
      colouring: 'byRing',
      stroke: { kind: 'curved', corner: 0.6, weight: 0.85, contrast: 0.4, taper: 0.5 },
    }),
    { names: once(T.names), tawba: slot(T.tawba) },
    {
      type: 'region',
      outline: {
        kind: 'poly',
        points: [
          [-0.6, -0.8],
          [0.6, -0.8],
          [0.6, 0.8],
          [-0.6, 0.8],
        ],
      },
      borders: [
        { type: 'textBorder', text: 'names', separator: { kind: 'braid', width: 4 }, ground: { kind: 'vine' } },
        { type: 'textBorder', text: 'tawba', taper: 0.2, separator: { kind: 'chevron', width: 3 } },
      ],
      features: { corners: 'star' },
      fill: { type: 'pattern', pattern: { tiling: '488', angle: 67, scale: 9 } },
    },
    undefined,
    'portrait',
  );

/** A seal of the shahada: whole words in justified lines, squared into a stamp. */
export const sealPanel = (): Composition =>
  comp(
    101,
    style({ palette: { ...PALETTES.ink }, stroke: { weight: 0.9, softness: 0 } }),
    { shahada: slot(T.shahada) },
    {
      type: 'region',
      outline: { kind: 'polygon', sides: 4 },
      size: 40,
      borders: [{ type: 'ornamentBorder', ornament: 'lines', width: 2 }],
      fill: { type: 'monogram', text: 'shahada', method: 'seal', params: { H: 7, frame: 'double' } },
    },
  );

/** A second floor tile: God is greatest as a walled maze. */
export const floor2 = (): Composition =>
  comp(
    77,
    style({ palette: { ...PALETTES.bannaiBrick }, stroke: { softness: 0 }, colouring: 'byRepeat' }),
    { akbar: slot(T.akbar) },
    {
      type: 'region',
      outline: { kind: 'polygon', sides: 4 },
      size: 60,
      borders: [{ type: 'ornamentBorder', ornament: 'chevron', width: 3 }],
      fill: { type: 'maze', text: 'akbar', corridors: 0.7, wall: true },
    },
  );
