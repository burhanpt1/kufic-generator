// "Houses of rest": an A1 sheet on a flat's plan. The flat's own plan is the composition, the way the lamp is in
// "Light upon light": every room is a region inscribed with the words that belong to it, the walls are the solid
// ground between them, and the whole stands in a frame of An-Nur 24:36, the verse that follows the Light Verse
// (houses God allowed to be raised, where His name is remembered). An-Nur runs through the flat: the hall carries the
// greeting on entering a house (24:61), the kitchen the same verse's houses of family and friends. Ayat al-Kursi runs
// round the outer walls, Al-Kahf 18:39 along the inner ones. At the heart of the living room is المائدة, the table
// (the area's name, Maida, probably from Arabic māʾida), with Al-Ma'ida 5:114 round it and rayed across the room. The
// bathroom is tiled and carries no text.
//
// The sheet is drawn in the plan's own units (the agent's drawing, in pixels, y down): every room is set at PX plan
// units per cell, so one pen (solvePen) writes every room's border at one letter height.
import { placeMap, resolve } from '../compose';
import { solvePen } from '../compose/pen';
import type { Placed } from '../compose/placed';
import { inside } from '../geometry/poly';
import type { Pt } from '../geometry/types';
import type { BorderNode, Composition, FillerNode, Palette, Style, TextBorder, TextSlot } from '../model/schema';
import { DEFAULT_STYLE } from '../model/style';
import { T } from '../mosque/texts';
import { renderPlaced } from '../render/composition';
import {
  aSeries,
  bbox,
  drawnPts,
  outlineOf,
  outlinesOf,
  pathD,
  SheetLayout,
  sheetOpen,
  svgBody,
} from '../render/sheet';
import type { Box, Setting } from '../render/sheet';
import { U } from '../render/svg';
import { kufi } from '../script/kufi';
import { AN_NUR, rasm } from './an-nur';
import { rosette, Writer, writtenRays } from './radial';
import { altAz, eclipticPoint, lst, STARS, wanderers, WANDERERS } from './sky';

const f = (n: number) => +n.toFixed(1);

const nurPhrase = (verse: number, from: string, to: string) => {
  const t = rasm(AN_NUR[verse - 1]),
    a = t.indexOf(from),
    b = t.indexOf(to, a) + to.length;
  if (a < 0 || b < a) throw new Error(`phrase not in 24:${verse}`);
  return t.slice(a, b);
};

/** The texts, Uthmani rasm. An-Nur is cut from the verified surah text; the rest were typed by hand and must be
 *  checked against a printed mushaf before print. */
export const FLAT = {
  /** An-Nur 24:36, whole. */
  frame: rasm(AN_NUR[35]),
  /** An-Nur 24:61: when you enter houses, greet one another with a greeting from God, blessed and good. */
  hall: nurPhrase(61, 'فإذا دخلتم', 'طيبة'),
  /** An-Nur 24:61: to eat from your houses, your fathers', mothers', brothers', sisters', uncles' and aunts', a
   *  house whose keys you hold, or a friend's; no blame whether you eat together or apart. */
  kitchen: nurPhrase(61, 'أن تأكلوا من بيوتكم', 'أشتاتا'),
  /** An-Nahl 16:80: God has made your homes a place of rest for you. */
  reception: 'وٱلله جعل لكم من بيوتكم سكنا',
  /** An-Naba 78:9–11: We made your sleep a rest, the night a covering, the day for livelihood. */
  bedroom: 'وجعلنا نومكم سباتا وجعلنا ٱليل لباسا وجعلنا ٱلنهار معاشا',
  /** Ta-Ha 20:114: and say, my Lord, increase me in knowledge. */
  study: 'وقل رب زدني علما',
  /** An-Naml 27:40: this is from the favour of my Lord. */
  thanks: 'هذا من فضل ربي',
  basmala: 'بسم الله الرحمن الرحيم',
  /** Al-Baqarah 2:255, Ayat al-Kursi, recited over a home: written in its outer walls. */
  walls: T.kursi,
  /** Al-Kahf 18:39, what one should say on entering one's own garden: as God wills, there is no strength except in
   *  God. Written along the interior walls. */
  inner: 'ما شاء ٱلله لا قوة إلا بٱلله',
  /** The table: Maida, the area's name, through the Calabrian town, probably from Arabic māʾida. */
  table: 'المائدة',
  /** Al-Ma'ida 5:114, whole: Jesus son of Mary said, O God our Lord, send down to us a table from heaven, a feast for
   *  the first of us and the last, and a sign from You; and provide for us, for You are the best of providers. */
  feast:
    'قال عيسى ٱبن مريم ٱللهم ربنا أنزل علينا مائدة من ٱلسماء تكون لنا عيدا لأولنا وءاخرنا وءاية منك وٱرزقنا وأنت خير ٱلرزقين',
  /** "Maida Vale": the valley of the table. */
  vale: 'وادي المائدة',
  /** The seals in the bedroom and the study. */
  night: 'وجعلنا ٱليل لباسا',
  knowledge: 'رب زدني علما',
  /** The words the rooms' star fields are written in. */
  rest: 'سباتا',
  dwelling: 'سكنا',
  ilm: 'علم',
  together: 'جميعا',
  /** The frame's field: houses (24:36). */
  field: 'بيوت',
};

/** Oxblood (the agent's plan), gilt, ivory. */
export const FLAT_PAL = { wall: '#5B0E14', gold: '#B08431', ivory: '#F3EBDA', room: '#FBF7EE', mark: '#7A1F24' };
const ROOM: Palette = { ink: FLAT_PAL.wall, ink2: '#9C7428', paper: FLAT_PAL.room, mark: FLAT_PAL.mark };
const ON_WALL: Palette = { ink: '#F3E3B0', ink2: FLAT_PAL.gold, paper: FLAT_PAL.wall, mark: '#F3E3B0' };

const slot = (text: string, repeat: 'fill' | 'once' = 'fill'): TextSlot => ({ text, repeat, wordGap: 2 });
export const flatStyle = (p: Palette = ROOM): Style => {
  const s = structuredClone(DEFAULT_STYLE) as Style;
  s.palette = { ...p };
  s.letter = { ...s.letter, ascenders: 11 };
  s.terminals = { kind: 'palmette', reach: 'tails', flourish: 'sprouts' };
  s.colouring = 'byRing';
  s.stroke = { ...s.stroke, kind: 'curved', corner: 0.6, weight: 0.85, contrast: 0.45, taper: 0.5 };
  return s;
};

// ---------- the plan (Third Floor, from the agent's drawing; units are the drawing's pixels, y down) ----------
const rect = (x0: number, y0: number, x1: number, y1: number): Pt[] => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
];
/** The flat's outer wall line, with the landing cut into its east side. */
export const PLAN_OUTLINE: Pt[] = [
  [40, 255],
  [958, 255],
  [958, 790],
  [675, 790],
  [675, 1160],
  [958, 1160],
  [958, 1792],
  [40, 1792],
];
/** The landing outside the front door (the notch in the plan). */
const LANDING: Box = { x: 675, y: 790, w: 283, h: 370 };
/** Rooms on a common grid: the west faces at x 84, the east faces of the bathroom, cupboard and kitchen at x 440,
 *  every interior wall 22 thick, every corner square. */
export const ROOMS = {
  bedroom: rect(84, 298, 548, 746),
  study: rect(572, 298, 915, 746),
  hall: rect(455, 768, 632, 1183),
  bath: [
    [84, 768],
    [440, 768],
    [440, 928],
    [305, 928],
    [305, 990],
    [84, 990],
  ] as Pt[],
  cupboard: rect(327, 950, 440, 1075),
  kitchen: [
    [84, 1012],
    [305, 1012],
    [305, 1097],
    [440, 1097],
    [440, 1306],
    [84, 1306],
  ] as Pt[],
  reception: [
    [84, 1328],
    [455, 1328],
    [455, 1205],
    [915, 1205],
    [915, 1750],
    [84, 1750],
  ] as Pt[],
};
type RoomId = keyof typeof ROOMS;

/** The doors: a box through the wall (painted the room's colour) and, for each room whose border it crosses, where
 *  that border opens (a point on the room's outline, in plan units) and how wide (plan units). */
interface Door {
  wall: Box;
  opens: { room: RoomId | 'walls'; at: Pt }[];
  width: number;
}
const DOORS: Door[] = [
  {
    wall: { x: 478, y: 742, w: 62, h: 30 },
    width: 62,
    opens: [
      { room: 'bedroom', at: [509, 746] },
      { room: 'hall', at: [509, 768] },
    ],
  },
  {
    wall: { x: 580, y: 742, w: 46, h: 30 },
    width: 46,
    opens: [
      { room: 'study', at: [603, 746] },
      { room: 'hall', at: [603, 768] },
    ],
  },
  // the bathroom and cupboard doors are cut through the wall only: the hall's west side stays written, so a corridor
  // of six doors still carries its greeting
  { wall: { x: 436, y: 790, w: 19, h: 86 }, width: 86, opens: [] },
  { wall: { x: 436, y: 958, w: 19, h: 100 }, width: 100, opens: [] },
  {
    wall: { x: 482, y: 1179, w: 116, h: 30 },
    width: 116,
    opens: [
      { room: 'hall', at: [540, 1183] },
      { room: 'reception', at: [540, 1205] },
    ],
  },
  { wall: { x: 436, y: 1220, w: 23, h: 76 }, width: 76, opens: [{ room: 'reception', at: [455, 1258] }] },
  // the front door, through the written outer wall
  {
    wall: { x: 628, y: 1022, w: 50, h: 100 },
    width: 100,
    opens: [
      { room: 'hall', at: [632, 1072] },
      { room: 'walls', at: [675, 1072] },
    ],
  },
];
/** Interior walls written along their length: from → to in plan units, and the wall's thickness. Upright walls run
 *  bottom to top, so they read top to bottom. */
const INNER_WALLS: { from: Pt; to: Pt; depth: number }[] = [
  { from: [560, 744], to: [560, 300], depth: 22 }, // between the bedrooms
  { from: [86, 757], to: [474, 757], depth: 20 }, // bedroom to bathroom
  { from: [86, 1001], to: [303, 1001], depth: 20 }, // bathroom to kitchen
  { from: [86, 1317], to: [434, 1317], depth: 20 }, // kitchen to reception
];

/** Plan units per cell: one pen through every room. */
export const PX = 2.6;
/** The Kursi band's letter scale is searched in this range (about the walls' thickness) for the most even writing;
 *  the frame's verse is fixed. */
export const WALL_SCALES = { lo: 0.74, hi: 0.8 };
export const FRAME_SIZE = 344;
export const FRAME_SCALE = 0.85;
/** How much of the space left inside the reception's border the table fills, and its rays. */
export const TABLE_FILL = 0.94;
export const RAYS = 56;
export const RAY_SCALE = 0.42;

const sizeOf = (P: Pt[]) => {
  const b = bbox(P);
  return Math.hypot(b.w, b.h) / 2 / PX;
};
const centreOf = (P: Pt[]): Pt => {
  const b = bbox(P);
  return [b.x + b.w / 2, b.y + b.h / 2];
};
/** A room's text border: on the shared pen, starting at the top, a diamond between repeats, open at its doors. */
const roomBorder = (id: RoomId, text: string, extra: Partial<TextBorder> = {}): TextBorder => {
  const openings = DOORS.flatMap(dr =>
    dr.opens.filter(o => o.room === id).map(o => ({ at: o.at as [number, number], width: dr.width / PX })),
  );
  return {
    type: 'textBorder',
    text,
    start: 'top',
    repeatMark: 'diamond',
    ...(openings.length ? { openings } : {}),
    ...extra,
  };
};

function room(
  P: Pt[],
  texts: Record<string, string>,
  borders: BorderNode[],
  fill: FillerNode | undefined,
  seed: number,
): Composition {
  return {
    version: 1,
    seed,
    canvas: { shape: 'square', margin: 0 },
    style: flatStyle(),
    texts: Object.fromEntries(Object.entries(texts).map(([k, t]) => [k, slot(t, k === 'once' ? 'once' : 'fill')])),
    root: {
      type: 'frame',
      child: {
        type: 'region',
        outline: { kind: 'poly', points: P },
        size: sizeOf(P),
        borders,
        ...(fill ? { fill } : {}),
        features: { tips: 'none' },
      },
    },
  };
}

/** A medallion over a star field: one fill, the field's words left out under it. */
const medallion = (ground: FillerNode, outline: 'star' | 'circle', share: number): FillerNode =>
  ({
    type: 'region',
    share,
    ground,
    node: {
      type: 'region',
      outline: outline === 'star' ? { kind: 'star', points: 8, depth: 0.85 } : { kind: 'circle' },
      borders: [
        { type: 'ornamentBorder', ornament: 'braid', width: 2 },
        { type: 'ornamentBorder', ornament: 'pearls', width: 2 },
      ],
      features: { tips: 'none' },
      // one colour, the border's oxblood (a nested region takes the next colour of "by ring" otherwise)
      style: { colouring: 'solid' },
      fill: { type: 'monogram', text: 'm', method: 'seal', params: {} },
    },
  }) as FillerNode;

/** The rooms, borders on auto (solvePen sets them). */
export function rooms(rays = false): Record<RoomId, Composition> {
  return {
    hall: room(
      ROOMS.hall,
      { once: FLAT.hall },
      [
        { type: 'ornamentBorder', ornament: 'braid', width: 3 },
        { type: 'ornamentBorder', ornament: 'pearls', width: 2 },
      ],
      // the greeting read down the hall in lines, as the kitchen's grace is: with six doors, a border here carried
      // only fragments of it
      { type: 'lines', text: 'once', lineGap: 2 },
      61,
    ),
    kitchen: room(
      ROOMS.kitchen,
      { once: FLAT.kitchen },
      [
        { type: 'ornamentBorder', ornament: 'braid', width: 3 },
        { type: 'ornamentBorder', ornament: 'pearls', width: 2 },
      ],
      // the passage written across the room in lines, like a grace on the kitchen wall
      { type: 'lines', text: 'once', lineGap: 2 },
      24,
    ),
    bedroom: room(
      ROOMS.bedroom,
      { t: FLAT.bedroom, c: FLAT.rest, m: FLAT.night },
      [
        { ...roomBorder('bedroom', 't'), separator: { kind: 'braid', width: 3 }, ground: { kind: 'vine' } },
        { type: 'ornamentBorder', ornament: 'pearls', width: 2 },
      ],
      medallion({ type: 'pattern', pattern: { tiling: '488', angle: 67, scale: 13 }, text: 'c' }, 'star', 0.62),
      78,
    ),
    study: room(
      ROOMS.study,
      { t: FLAT.study, c: FLAT.ilm, m: FLAT.knowledge },
      [{ ...roomBorder('study', 't'), separator: { kind: 'chevron', width: 3 } }],
      medallion({ type: 'pattern', pattern: { tiling: 'square', angle: 60, scale: 11 }, text: 'c' }, 'circle', 0.7),
      20,
    ),
    reception: room(
      ROOMS.reception,
      { t: FLAT.reception, c: FLAT.dwelling },
      [
        {
          ...roomBorder('reception', 't', { insideCorners: 'meet' }),
          separator: { kind: 'braid', width: 4 },
          ground: { kind: 'vine' },
        },
        { type: 'ornamentBorder', ornament: 'pearls', width: 3 },
      ],
      // a star field in سكنا round the table, as the bedrooms have round their seals; or none, under the written rays
      rays ? undefined : { type: 'pattern', pattern: { tiling: '488', angle: 67, scale: 15 }, text: 'c' },
      16,
    ),
    bath: room(
      ROOMS.bath,
      {},
      [{ type: 'ornamentBorder', ornament: 'lines', width: 2 }],
      { type: 'iznik', iznik: { fold: 8, scale: 7 } },
      5,
    ),
    cupboard: room(
      ROOMS.cupboard,
      {},
      [{ type: 'ornamentBorder', ornament: 'lines', width: 1 }],
      { type: 'pattern', pattern: { tiling: 'square', angle: 45, scale: 8 } },
      4,
    ),
  };
}

/** The outer walls: Ayat al-Kursi round the whole flat, ivory on the wall colour, open at the front door. */
export function walls(): Composition {
  const front = DOORS.flatMap(dr =>
    dr.opens.filter(o => o.room === 'walls').map(o => ({ at: o.at as [number, number], width: dr.width / PX })),
  );
  return {
    version: 1,
    seed: 255,
    canvas: { shape: 'portrait', margin: 0 },
    style: flatStyle(ON_WALL),
    texts: { k: slot(FLAT.walls) },
    root: {
      type: 'frame',
      child: {
        type: 'region',
        outline: { kind: 'poly', points: PLAN_OUTLINE },
        size: sizeOf(PLAN_OUTLINE),
        borders: [
          {
            type: 'textBorder',
            text: 'k',
            start: 'top',
            insideCorners: 'meet',
            openings: front,
            separator: { kind: 'none', width: 0 },
          },
        ],
        features: { tips: 'none' },
      },
    },
  };
}

/** The table at the heart of the reception: المائدة as a square Kufic seal in an octagon, ringed by 5:114 read once
 *  from the top, on a ground of small stars. */
export function tableRoundel(): Composition {
  return {
    version: 1,
    seed: 114,
    canvas: { shape: 'square', margin: 0 },
    style: { ...flatStyle(), colouring: 'solid' },
    texts: { feast: slot(FLAT.feast, 'once') },
    root: {
      type: 'frame',
      child: {
        type: 'region',
        outline: { kind: 'circle' },
        // a little larger than the verse needs, for the rosette inside: more, and the verse is drawn out to fill the ring
        spread: 1.15,
        borders: [
          { type: 'ornamentBorder', ornament: 'braid', width: 3 },
          {
            type: 'textBorder',
            text: 'feast',
            seam: 4,
            start: 'top',
            separator: { kind: 'pearls', width: 2 },
            ground: { kind: 'pattern', pattern: { tiling: '488', angle: 67, scale: 4 } },
          },
        ],
        fill: {
          type: 'region',
          node: {
            type: 'region',
            outline: { kind: 'polygon', sides: 8, rotation: 22.5 },
            borders: [{ type: 'ornamentBorder', ornament: 'braid', width: 2 }],
            features: { tips: 'none' },
            // left empty: the rosette of المائدة is written into it after resolving (tableRosette)
          },
        },
      },
    },
  };
}

/** The table's heart: المائدة sixteen times on spokes reading outward, oxblood and gold in turn, round a gold star:
 *  the rays across the room arrive somewhere. Added to the resolved roundel, inside its octagon. */
export function tableRosette(tb: Placed): void {
  const oct = outlinesOf(tb)[1],
    P = oct.inner ?? oct.outer,
    xs = P.map(q => q[0]),
    ys = P.map(q => q[1]),
    c: Pt = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2],
    // the octagon's apothem, less a margin
    R = Math.min(...P.map(q => Math.hypot(q[0] - c[0], q[1] - c[1]))) * Math.cos(Math.PI / 8) * 0.95,
    st = tb.styles[0],
    sOx = tb.styles.push({ ...st, colouring: 'solid' }) - 1,
    sGold = tb.styles.push({ ...st, palette: { ...st.palette, ink: FLAT_PAL.gold }, colouring: 'solid' }) - 1,
    ro = rosette(new Writer(kufi, st), FLAT.table, c, R, ROSETTE_SPOKES, sOx, 93);
  ro.items.forEach((it, i) => {
    if (i % 2 && it.type === 'strip') it.style = sGold;
  });
  tb.items.push(...ro.items, { type: 'star', style: sGold, centre: c, r: ro.r0 * 0.8 });
}
export const ROSETTE_SPOKES = 12;

/** The landing's plate: وادي المائدة, Maida Vale, as a square Kufic seal. */
export function valePlate(): Composition {
  return {
    version: 1,
    seed: 5,
    canvas: { shape: 'portrait', margin: 0 },
    // dotted, so وادي's final ya can't be read as a ba
    style: { ...flatStyle(), colouring: 'solid', letter: { ...flatStyle().letter, marks: 'dots' } },
    texts: { v: slot(FLAT.vale) },
    root: {
      type: 'frame',
      child: {
        type: 'region',
        outline: {
          kind: 'poly',
          points: [
            [-0.86, -1],
            [0.86, -1],
            [0.86, 1],
            [-0.86, 1],
          ],
        },
        size: 40,
        borders: [
          { type: 'ornamentBorder', ornament: 'braid', width: 2 },
          { type: 'ornamentBorder', ornament: 'pearls', width: 2 },
        ],
        features: { corners: 'diamond' },
        fill: { type: 'monogram', text: 'v', method: 'seal', params: {} },
      },
    },
  };
}

/** The A1 frame: An-Nur 24:36 round the sky. */
export function flatFrame(): Composition {
  const h = 1 / Math.sqrt(1 + 0.5),
    w = h / Math.SQRT2;
  return {
    version: 1,
    seed: 36,
    canvas: { shape: 'portrait', margin: 2 },
    style: flatStyle({ ink: FLAT_PAL.wall, ink2: '#CDB585', paper: FLAT_PAL.ivory, mark: FLAT_PAL.mark }),
    texts: { verse: slot(FLAT.frame) },
    root: {
      type: 'frame',
      child: {
        type: 'region',
        outline: {
          kind: 'poly',
          points: [
            [-w, -h],
            [w, -h],
            [w, h],
            [-w, h],
          ],
        },
        size: FRAME_SIZE,
        borders: [
          {
            type: 'textBorder',
            text: 'verse',
            scale: FRAME_SCALE,
            start: 'top',
            repeatMark: 'diamond',
            separator: { kind: 'braid', width: 4 },
            ground: { kind: 'tint' },
          },
          { type: 'ornamentBorder', ornament: 'braid', width: 6 },
          { type: 'ornamentBorder', ornament: 'pearls', width: 3 },
        ],
        features: { corners: 'star' },
        // no fill: the field is the sky (drawn on the sheet, see skyOver)
      },
    },
  };
}

/** A cartouche: one line of text in an elongated hexagon. */
export function flatCartouche(text: string, seed: number): Composition {
  return {
    version: 1,
    seed,
    canvas: { shape: 'landscape', margin: 1 },
    style: flatStyle(),
    texts: { t: slot(text, 'once') },
    root: {
      type: 'frame',
      child: {
        type: 'region',
        outline: {
          kind: 'poly',
          points: [
            [-1, 0],
            [-0.82, -0.32],
            [0.82, -0.32],
            [1, 0],
            [0.82, 0.32],
            [-0.82, 0.32],
          ],
        },
        size: 34,
        borders: [{ type: 'ornamentBorder', ornament: 'braid', width: 2 }],
        fill: { type: 'lines', text: 't', lineGap: 1 },
      },
    },
  };
}

// ---------- the sky ----------
/** The night the sky is drawn for (completion day, 27 November 2026, 9 pm GMT), and where: Maida Vale (the area,
 *  to a hundredth of a degree). */
export const MOVE_IN = new Date('2026-11-27T21:00:00Z');
export const OBSERVER = { lat: 51.53, lon: -0.19 };
/** Plan units of sky either side of the plan. */
export const SKY_MARGIN = 260;
/** The night sky: deep navy, deepest at the edges; the plate's lines and the stars in gold, the figures in rose. */
const NIGHT = { mid: '#1D2D5C', deep: '#0A1330', line: '#C9A45A', rose: '#D98C7A', pale: '#F3E3B0', gilt: '#E9C46A' };

/** The frame's field as an old star chart: the sky at MOVE_IN over OBSERVER as an astrolabe plate draws it (zenith
 *  under the plan, horizon at the field's edge), on deep navy, with wind roses and a graduated neatline. Lines run
 *  only where nothing has been set (covers); star names come back as inscriptions for sheet.write. */
/** A wind rose: sixteen points (the four winds longest, gold and night in halves, then the half winds and the
 *  quarters), two rings graduated in degrees, and a fleuron on north. */
function windRose(c: Pt, R: number): string {
  const P = (a: number, r: number): string => {
      const t = (a * Math.PI) / 180;
      return `${f(c[0] + r * Math.sin(t))} ${f(c[1] - r * Math.cos(t))}`;
    },
    out: string[] = [
      `<circle cx="${f(c[0])}" cy="${f(c[1])}" r="${f(R * 0.86)}" fill="${NIGHT.deep}" fill-opacity=".55" stroke="${NIGHT.line}" stroke-width="1.6"/>`,
      `<circle cx="${f(c[0])}" cy="${f(c[1])}" r="${f(R * 0.78)}" fill="none" stroke="${NIGHT.line}" stroke-width="0.8"/>`,
    ];
  for (let a = 0; a < 360; a += 5)
    out.push(
      `<path d="M${P(a, R * 0.78)}L${P(a, a % 45 ? R * 0.82 : R * 0.86)}" stroke="${NIGHT.line}" stroke-width="0.8"/>`,
    );
  // quarters, half winds, winds: drawn smallest first so the winds lie on top
  for (const [step, off, len, w] of [
    [45, 22.5, 0.5, 9],
    [90, 45, 0.72, 11],
    [90, 0, 1, 13],
  ] as [number, number, number, number][])
    for (let a = off; a < 360; a += step) {
      const tip = P(a, R * len),
        l = P(a - w, R * 0.16),
        r = P(a + w, R * 0.16),
        o = P(a, 0);
      out.push(
        `<path d="M${o}L${l}L${tip}Z" fill="${len === 1 ? NIGHT.gilt : NIGHT.pale}" stroke="${NIGHT.deep}" stroke-width="0.6"/>`,
        `<path d="M${o}L${r}L${tip}Z" fill="${len === 1 ? '#8E6A24' : '#9AA3BF'}" stroke="${NIGHT.deep}" stroke-width="0.6"/>`,
      );
    }
  // the fleuron on north: a lozenge and three petals
  const n = R * 1.08,
    tip = (dx: number, dy: number) => `${f(c[0] + dx)} ${f(c[1] - n - dy)}`;
  out.push(
    `<path d="M${tip(0, -R * 0.1)}L${tip(R * 0.07, R * 0.06)}L${tip(0, R * 0.22)}L${tip(-R * 0.07, R * 0.06)}Z" fill="${NIGHT.gilt}"/>`,
    `<circle cx="${f(c[0] - R * 0.1)}" cy="${f(c[1] - n - R * 0.08)}" r="${f(R * 0.045)}" fill="${NIGHT.gilt}"/>`,
    `<circle cx="${f(c[0] + R * 0.1)}" cy="${f(c[1] - n - R * 0.08)}" r="${f(R * 0.045)}" fill="${NIGHT.gilt}"/>`,
    `<circle cx="${f(c[0])}" cy="${f(c[1])}" r="${f(R * 0.06)}" fill="${NIGHT.deep}" stroke="${NIGHT.gilt}" stroke-width="1.2"/>`,
  );
  return out.join('');
}

function skyOver(field: Box, c: Pt, covers: Pt[][]) {
  // The plate folded into the frame: the plan stands where the zenith would be, so each direction's altitudes are laid
  // out along its ray from the plan's edge (90°) to the field's (the horizon), north up and east to the left. Every
  // star above the horizon lands in the margin, in its true direction and order.
  const inner = bbox(covers.flat()),
    pad = 14,
    rIn: Box = { x: inner.x - pad, y: inner.y - pad, w: inner.w + 2 * pad, h: inner.h + 2 * pad },
    rOut: Box = { x: field.x + 22, y: field.y + 22, w: field.w - 44, h: field.h - 44 },
    exit = (d: Pt, b: Box) => {
      const tx = d[0] > 0 ? (b.x + b.w - c[0]) / d[0] : d[0] < 0 ? (b.x - c[0]) / d[0] : Infinity,
        ty = d[1] > 0 ? (b.y + b.h - c[1]) / d[1] : d[1] < 0 ? (b.y - c[1]) / d[1] : Infinity;
      return Math.min(tx, ty);
    },
    L = lst(MOVE_IN, OBSERVER.lon),
    pr = (alt: number, az: number): Pt => {
      const d: Pt = [-Math.sin((az * Math.PI) / 180), -Math.cos((az * Math.PI) / 180)],
        a = exit(d, rIn),
        b = exit(d, rOut),
        t = Math.sin(((90 - alt) * Math.PI) / 180), // the projection's own easing: altitudes crowd toward the horizon less
        r = a + (b - a) * t;
      return [c[0] + d[0] * r, c[1] + d[1] * r];
    },
    R = 0,
    path = (P: Pt[]) => 'M' + P.map(([x, y]) => `${f(x)} ${f(y)}`).join('L'),
    uncovered = ([x, y]: Pt) => !covers.some(P => inside(P, x, y)),
    inField = ([x, y]: Pt, m = 0) =>
      x > field.x + m && x < field.x + field.w - m && y > field.y + m && y < field.y + field.h - m,
    out: string[] = [];
  // the night, deepening toward the edges
  out.push(
    `<radialGradient id="sk-parch" cx="${f(c[0])}" cy="${f(c[1])}" r="${f(Math.hypot(field.w, field.h) / 2 + R)}" gradientUnits="userSpaceOnUse">` +
      `<stop offset=".4" stop-color="${NIGHT.mid}"/><stop offset=".8" stop-color="#132049"/><stop offset="1" stop-color="${NIGHT.deep}"/></radialGradient>` +
      `<rect x="${f(field.x)}" y="${f(field.y)}" width="${f(field.w)}" height="${f(field.h)}" fill="url(#sk-parch)"/>`,
  );
  // the plate's lines, clipped to the field
  const lines: string[] = [];
  // a quiet plate: the almucantars of 30° and 60°, and the eight winds' azimuths (every line more is one more frame
  // round the plan)
  for (const alt of [30, 60]) {
    const P = Array.from({ length: 721 }, (_, i) => pr(alt, i / 2));
    lines.push(`<path d="${path(P)}Z" stroke-width="0.9" stroke-dasharray="3 5"/>`);
  }
  for (let az = 0; az < 360; az += 45)
    lines.push(`<path d="${path([pr(80, az), pr(0, az)])}" stroke-width="${az % 90 ? 0.7 : 1.2}"/>`);
  // the horizon, doubled, graduated every five degrees
  lines.push(`<path d="${path(Array.from({ length: 721 }, (_, i) => pr(0, i / 2)))}Z" stroke-width="2.4"/>`);
  for (let az = 0; az < 360; az += 5)
    lines.push(`<path d="${path([pr(0, az), pr(az % 15 ? 0.8 : 2, az)])}" stroke-width="1"/>`);
  // the ecliptic, one dashed line: the Moon and the planets keep to it
  const ecl = (dB: number) =>
    Array.from({ length: 361 }, (_, i) => {
      const e = eclipticPoint(i),
        h = altAz(e.ra, e.dec + dB, OBSERVER.lat, L);
      return h.alt > 0 ? pr(h.alt, h.az) : null;
    });
  for (const dB of [0]) {
    const runs: Pt[][] = [[]];
    for (const q of ecl(dB)) {
      if (q) runs[runs.length - 1].push(q);
      else if (runs[runs.length - 1].length) runs.push([]);
    }
    for (const r of runs)
      if (r.length > 1)
        lines.push(
          `<path d="${path(r)}" stroke="${NIGHT.rose}" stroke-opacity=".9" stroke-width="1.2" stroke-dasharray="7 5"/>`,
        );
  }
  out.push(
    `<clipPath id="sk-clip"><path clip-rule="evenodd" d="M${f(field.x)} ${f(field.y)}h${f(field.w)}v${f(field.h)}h${f(-field.w)}Z ${covers.map(P => path(P) + 'Z').join(' ')}"/></clipPath>` +
      `<g clip-path="url(#sk-clip)" fill="none" stroke="${NIGHT.line}" stroke-opacity=".5">${lines.join('')}</g>`,
  );
  // the figures' bones, faint and dotted (as the old charts drew the constellations' stars joined): the Plough,
  // Cassiopeia, Orion, the square of Pegasus
  const at = (ra: number, dec: number) => {
      const h = altAz(ra, dec, OBSERVER.lat, L);
      return h.alt > 0 ? pr(h.alt, h.az) : null;
    },
    byRa = (ra: number) => STARS.find(st => Math.abs(st.ra - ra) < 0.002)!,
    figures = [
      [11.062, 11.031, 11.897, 12.257, 12.9, 13.399, 13.792],
      [0.153, 0.675, 0.945, 1.43, 1.907],
      [5.919, 5.419, 5.533, 5.604, 5.679, 5.796, 5.242, 5.533],
      [23.079, 23.063, 0.14, 0.221, 23.079],
    ],
    bones: string[] = [];
  for (const fig of figures) {
    const P = fig.map(ra => {
      const st = byRa(ra);
      return at(st.ra, st.dec);
    });
    for (let i = 0; i + 1 < P.length; i++)
      if (P[i] && P[i + 1]) bones.push(`M${f(P[i]![0])} ${f(P[i]![1])}L${f(P[i + 1]![0])} ${f(P[i + 1]![1])}`);
  }
  out.push(
    `<g clip-path="url(#sk-clip)"><path d="${bones.join('')}" fill="none" stroke="${NIGHT.rose}" stroke-opacity=".8" stroke-width="1.4" stroke-dasharray="2 5" stroke-linecap="round"/></g>`,
  );
  // two wind roses in opposite corners of the sky, each with its 32 rhumb lines run across the field (a portolan's
  // net), north marked with a fleuron
  {
    const Rr = SKY_MARGIN * 0.4,
      m = 22 + Rr + 14,
      centres: Pt[] = [
        [field.x + m, field.y + m],
        [field.x + field.w - m, field.y + field.h - m],
      ],
      rhumbs: string[] = [],
      roses: string[] = [],
      far = Math.hypot(field.w, field.h);
    for (const rc of centres) {
      for (let i = 0; i < 32; i++) {
        const a = (i * Math.PI) / 16;
        rhumbs.push(`M${f(rc[0])} ${f(rc[1])}L${f(rc[0] + far * Math.sin(a))} ${f(rc[1] - far * Math.cos(a))}`);
      }
      roses.push(windRose(rc, Rr));
    }
    out.push(
      `<g clip-path="url(#sk-clip)">` +
        (RHUMBS
          ? `<path d="${rhumbs.join('')}" fill="none" stroke="${NIGHT.line}" stroke-opacity=".28" stroke-width="0.9"/>`
          : '') +
        `${roses.join('')}</g>`,
    );
  }
  // the stars: eight-pointed, sized by magnitude, gilt with a pale rim and a faint glow
  const labelPen = new Writer(kufi, flatStyle()),
    labels: { text: string; from: Pt; to: Pt; scale: number; repeat: 'once'; align: 'base' }[] = [],
    star = ([x, y]: Pt, r: number) => {
      const P = Array.from({ length: 16 }, (_, i) => {
        const a = (i * Math.PI) / 8 - Math.PI / 2,
          rr = i % 2 ? r * 0.42 : r;
        return [x + rr * Math.cos(a), y + rr * Math.sin(a)] as Pt;
      });
      return (
        `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r * 1.6)}" fill="${NIGHT.gilt}" fill-opacity=".12"/>` +
        `<path d="${path(P)}Z" fill="${NIGHT.gilt}" stroke="${NIGHT.pale}" stroke-width="${f(Math.max(0.5, r * 0.08))}"/>`
      );
    };
  // a name under its star, or over it where there is no room beneath
  const label = (text: string, p: Pt, r: number) => {
    const strip = labelPen.strip(text),
      len = strip ? strip.W * LABEL_SCALE * PX + 4 : 0;
    // the letters stand on the line and rise from it: beneath, clear of the star by their own height
    for (const y of [p[1] + r + 34, p[1] - r - 8]) {
      const a: Pt = [p[0] - len / 2, y],
        b: Pt = [p[0] + len / 2, y];
      if (inField(a, 4) && inField(b, 4) && inField([p[0], y - 30], 4) && uncovered(a) && uncovered(b)) {
        labels.push({ text, from: a, to: b, scale: LABEL_SCALE, repeat: 'once', align: 'base' });
        return;
      }
    }
  };
  for (const st of STARS) {
    const h = altAz(st.ra, st.dec, OBSERVER.lat, L);
    if (h.alt <= 0) continue;
    const p = pr(h.alt, h.az);
    if (!inField(p, 8) || !uncovered(p)) continue;
    const r = Math.max(4, 14 - st.mag * 3.2);
    if (st.cluster)
      for (const [dx, dy] of [
        [0, 0],
        [5, -3],
        [-4, -5],
        [6, 4],
        [-5, 3],
        [1, 7],
      ] as Pt[])
        out.push(star([p[0] + dx, p[1] + dy], 3));
    else out.push(star(p, r));
    if (st.ar) label(st.ar, p, r);
  }
  // the Moon, with its phase, and the planets that are up: discs, not stars, as they are to the eye
  for (const w of wanderers(MOVE_IN)) {
    const h = altAz(w.ra, w.dec, OBSERVER.lat, L);
    if (h.alt <= 0) continue;
    const p = pr(h.alt, h.az);
    if (!inField(p, 8) || !uncovered(p)) continue;
    if (w.body === 'moon') {
      const r = 22,
        k = w.lit ?? 1,
        rx = f(r * Math.abs(2 * k - 1)),
        // the dark limb: on the right for a waning Moon (seen from the north), on the left for a waxing one
        side = w.waxing ? 0 : 1,
        // gibbous: the terminator bulges into the dark side; a crescent: into the lit one
        bulge = k > 0.5 ? side : 1 - side;
      out.push(
        `<circle cx="${f(p[0])}" cy="${f(p[1])}" r="${r * 1.7}" fill="${NIGHT.pale}" fill-opacity=".1"/>` +
          `<circle cx="${f(p[0])}" cy="${f(p[1])}" r="${r}" fill="${NIGHT.pale}"/>` +
          `<path d="M${f(p[0])} ${f(p[1] - r)}A${r} ${r} 0 0 ${side} ${f(p[0])} ${f(p[1] + r)}A${rx} ${r} 0 0 ${1 - bulge} ${f(p[0])} ${f(p[1] - r)}Z" fill="${NIGHT.deep}" fill-opacity=".82"/>` +
          `<circle cx="${f(p[0])}" cy="${f(p[1])}" r="${r}" fill="none" stroke="${NIGHT.gilt}" stroke-width="1.2"/>`,
      );
      label(WANDERERS.moon.ar, p, r);
    } else {
      const r = w.body === 'venus' || w.body === 'jupiter' ? 9 : 7;
      out.push(
        `<circle cx="${f(p[0])}" cy="${f(p[1])}" r="${f(r * 2)}" fill="${NIGHT.gilt}" fill-opacity=".12"/>` +
          `<circle cx="${f(p[0])}" cy="${f(p[1])}" r="${r}" fill="${NIGHT.pale}" stroke="${NIGHT.gilt}" stroke-width="1.4"/>` +
          (w.body === 'saturn'
            ? `<ellipse cx="${f(p[0])}" cy="${f(p[1])}" rx="${f(r * 2.1)}" ry="${f(r * 0.6)}" transform="rotate(-20 ${f(p[0])} ${f(p[1])})" fill="none" stroke="${NIGHT.gilt}" stroke-width="1.4"/>`
            : ''),
      );
      label(WANDERERS[w.body].ar, p, r * 1.6);
    }
  }
  // the stars sit over two wind roses in opposite corners, as on a portolan chart (drawn under the stars, after)
  // a graduated neatline round the field, as on the old charts: alternate bars of gold and night
  const nb: string[] = [],
    t = 9,
    step = 36;
  for (const [x0, y0, x1, y1, horiz] of [
    [field.x, field.y, field.x + field.w, field.y, true],
    [field.x, field.y + field.h - t, field.x + field.w, field.y + field.h - t, true],
    [field.x, field.y, field.x, field.y + field.h, false],
    [field.x + field.w - t, field.y, field.x + field.w - t, field.y + field.h, false],
  ] as [number, number, number, number, boolean][]) {
    const len = horiz ? x1 - x0 : y1 - y0;
    for (let i = 0; i * step < len; i++)
      if (i % 2 === 0)
        nb.push(
          horiz
            ? `<rect x="${f(x0 + i * step)}" y="${f(y0)}" width="${f(Math.min(step, len - i * step))}" height="${t}"/>`
            : `<rect x="${f(x0)}" y="${f(y0 + i * step)}" width="${t}" height="${f(Math.min(step, len - i * step))}"/>`,
        );
  }
  out.push(
    `<g fill="${NIGHT.line}">${nb.join('')}</g>` +
      `<rect x="${f(field.x)}" y="${f(field.y)}" width="${f(field.w)}" height="${f(field.h)}" fill="none" stroke="${NIGHT.line}" stroke-width="1.5"/>` +
      `<rect x="${f(field.x + t)}" y="${f(field.y + t)}" width="${f(field.w - 2 * t)}" height="${f(field.h - 2 * t)}" fill="none" stroke="${NIGHT.line}" stroke-width="1"/>`,
  );
  return {
    svg: out.join(''),
    labels,
    labelStyle: {
      ...flatStyle({ ink: NIGHT.pale, ink2: NIGHT.gilt, paper: NIGHT.deep, mark: NIGHT.pale }),
      colouring: 'solid' as const,
    },
  };
}
export const LABEL_SCALE = 0.8;
/** The wind roses' 64 rhumb lines across the sky (a portolan's net). Off: with the plate's own lines they crowd the
 *  stars out. */
export const RHUMBS = false;

export interface FlatSheet {
  svg: string;
  warnings: string[];
  /** The shared pen, and what stops a larger one. */
  pen: { scale: number; limit: string | null };
  w: number;
  h: number;
}

/** Where the openings of a placed composition's borders landed on the sheet. */
const openingsOn = (pl: Placed, s: Setting): Pt[][] =>
  pl.meta.borders.flatMap(b => b.rings.flatMap(r => r.openings ?? [])).map(q => drawnPts(pl, q).map(s.map));

export interface FlatOptions {
  /** 5:114 written on rays from the table across the reception, instead of the room's star field. */
  rays?: boolean;
}

export function flatSheet(opts: FlatOptions = {}): FlatSheet {
  const rays_ = !!opts.rays;
  const warnings: string[] = [];
  const sh = new SheetLayout();
  const place = (c: Composition, id: string, ground?: string) => {
    const pl = resolve(c);
    warnings.push(...pl.meta.warnings.map(w => `${id}: ${w}`));
    const P = (c.root.child.outline as { points: Pt[] }).points;
    return { pl, s: sh.place(pl, { id, unit: PX, centre: centreOf(P), ...(ground ? { ground } : {}) }) };
  };

  // the outer walls, written; then the rooms on one pen over them
  sh.parts.push(`<path d="${pathD(PLAN_OUTLINE)}" fill="${FLAT_PAL.wall}"/>`);
  const wallPen = solvePen([walls()], { ...WALL_SCALES, step: 0.01 });
  if (!wallPen) throw new Error('the outer walls hold no pen');
  const wl = place(wallPen.compositions[0], 'wl');
  const given = rooms(rays_),
    ids = Object.keys(given) as RoomId[],
    fit = solvePen(ids.map(id => given[id]));
  if (!fit) throw new Error('no pen fits every room');
  const placed = {} as Record<RoomId, { pl: Placed; s: Setting }>;
  const partOf = {} as Record<RoomId, number>;
  ids.forEach((id, i) => {
    partOf[id] = sh.parts.length;
    placed[id] = place(fit.compositions[i], id, FLAT_PAL.room);
  });

  // doors: through the walls, and across the bands where the borders open for them
  for (const dr of DOORS)
    sh.parts.push(
      `<rect x="${dr.wall.x}" y="${dr.wall.y}" width="${dr.wall.w}" height="${dr.wall.h}" fill="${FLAT_PAL.room}"/>`,
    );
  for (const q of [...openingsOn(wl.pl, wl.s), ...ids.flatMap(id => openingsOn(placed[id].pl, placed[id].s))])
    sh.parts.push(`<path d="${pathD(q)}" fill="${FLAT_PAL.room}"/>`);
  {
    const fd = DOORS[DOORS.length - 1].wall;
    sh.parts.push(
      `<path d="M${fd.x + fd.w - 4} ${fd.y}v${fd.h}" stroke="${FLAT_PAL.gold}" stroke-width="6" stroke-linecap="round"/>`,
    );
  }

  // interior walls: Al-Kahf 18:39 along each, sized to the wall's thickness
  warnings.push(
    ...sh.write(
      INNER_WALLS.map((w, i) => ({ text: FLAT.inner, from: w.from, to: w.to, depth: w.depth, ring: 40 + i })),
      { ...flatStyle(ON_WALL), colouring: 'solid' },
      { id: 'iw', unit: PX },
    ),
  );

  // the table: on the reception's centre line, at the height where the largest circle fits inside its border
  {
    const { pl: rec, s: rs } = placed.reception,
      rin = drawnPts(rec, outlineOf(rec).inner!).map(rs.map),
      xs = rin.map(q => q[0]),
      ys = rin.map(q => q[1]),
      midX = (Math.min(...xs) + Math.max(...xs)) / 2,
      edgeDist = ([px, py]: Pt) =>
        Math.min(
          ...rin.map((a, i) => {
            const b = rin[(i + 1) % rin.length],
              dx = b[0] - a[0],
              dy = b[1] - a[1],
              t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / (dx * dx + dy * dy || 1)));
            return Math.hypot(px - a[0] - t * dx, py - a[1] - t * dy);
          }),
        ),
      best = Array.from({ length: 200 }, (_, i) => {
        const y = Math.min(...ys) + ((Math.max(...ys) - Math.min(...ys)) * (i + 0.5)) / 200;
        return { y, r: inside(rin, midX, y) ? edgeDist([midX, y]) : 0 };
      }).reduce((a, b) => (b.r > a.r ? b : a)),
      tc: Pt = [midX, best.y],
      dia = 2 * best.r * TABLE_FILL;

    if (rays_) {
      // its rays: 5:114 word by word on spokes out to the room's border, gold fading outward. Worked in the
      // reception's own cells: sheet → drawn → cells.
      const toCells = ([x, y]: Pt): Pt => {
          const crop = bbox(drawnPts(rec, outlineOf(rec).outer));
          return [
            (crop.x + (x - rs.box.x) / rs.k) / U - rec.canvas.origin[0],
            (crop.y + (y - rs.box.y) / rs.k) / U - rec.canvas.origin[1],
          ];
        },
        c = toCells(tc),
        rr = dia / 2 / rs.k / U,
        disc = Array.from({ length: 96 }, (_, i) => {
          const a = (i / 96) * 2 * Math.PI;
          return [c[0] + rr * Math.cos(a), c[1] + rr * Math.sin(a)] as Pt;
        }),
        st = rec.styles[0],
        gold: Style = {
          ...st,
          palette: { ...st.palette, ink: FLAT_PAL.gold },
          colouring: 'solid',
          stroke: { ...st.stroke, contrast: 0, taper: 0 },
          terminals: { ...st.terminals, kind: 'none', flourish: 'none' },
        },
        sid = rec.styles.push(gold) - 1,
        rays = writtenRays(
          new Writer(kufi, st),
          FLAT.feast.split(' '),
          c,
          disc,
          outlineOf(rec).inner!,
          RAYS,
          RAY_SCALE,
          [sid],
          92,
          1e4,
        ),
        crop = bbox(drawnPts(rec, outlineOf(rec).outer)),
        raySvg = sh.set(svgBody(renderPlaced({ ...rec, items: rays } as Placed, { idPrefix: 'ry' })), crop, rs.k, [
          rs.box.x + rs.box.w / 2,
          rs.box.y + rs.box.h / 2,
        ]).svg,
        rt = rs.box,
        R = Math.hypot(rt.w, rt.h) / 2;
      sh.parts.push(
        `<mask id="fl-rayfade" maskUnits="userSpaceOnUse" x="${f(rt.x)}" y="${f(rt.y)}" width="${f(rt.w)}" height="${f(rt.h)}">` +
          `<radialGradient id="fl-rayfadeg" cx="${f(tc[0])}" cy="${f(tc[1])}" r="${f(R)}" gradientUnits="userSpaceOnUse">` +
          `<stop offset="0" stop-color="#fff"/><stop offset=".35" stop-color="#fff" stop-opacity=".8"/>` +
          `<stop offset="1" stop-color="#fff" stop-opacity=".2"/></radialGradient>` +
          `<rect x="${f(rt.x)}" y="${f(rt.y)}" width="${f(rt.w)}" height="${f(rt.h)}" fill="url(#fl-rayfadeg)"/></mask>` +
          `<g mask="url(#fl-rayfade)">${raySvg}</g>`,
      );
    } else {
      // the room's star field stops round the table: a word that would run under it is left out whole
      const toSheet = (p: Pt) => rs.map(drawnPts(rec, [p])[0]),
        clear = dia / 2 + 6,
        shown: Placed = {
          ...rec,
          items: rec.items.filter(it => {
            if (it.type !== 'strip' || it.place.type !== 'line') return true;
            const at = placeMap(it.place);
            return ![0, 0.5, 1].some(k => {
              const [x, y] = toSheet(at(it.strip.W * k, it.strip.Hb / 2));
              return Math.hypot(x - tc[0], y - tc[1]) < clear;
            });
          }),
        };
      // drawn again in the room's place in the order of parts
      sh.place(shown, { id: 'reception', unit: PX, centre: centreOf(ROOMS.reception), ground: FLAT_PAL.room });
      sh.parts[partOf.reception] = sh.parts.pop()!;
      sh.covers.pop();
    }
    const tb = resolve(tableRoundel());
    warnings.push(...tb.meta.warnings.map(w => `table: ${w}`));
    tableRosette(tb);
    sh.place(tb, { id: 'tb', ground: FLAT_PAL.room, slot: { x: tc[0] - dia / 2, y: tc[1] - dia / 2, w: dia, h: dia } });
  }

  // the landing: وادي المائدة on a plate beside the front door
  {
    const vp = resolve(valePlate()),
      m = 34;
    warnings.push(...vp.meta.warnings.map(w => `vale: ${w}`));
    sh.place(vp, {
      id: 'vp',
      ground: FLAT_PAL.room,
      slot: { x: LANDING.x + m, y: LANDING.y + m, w: LANDING.w - 2 * m, h: LANDING.h - 2 * m },
    });
  }

  // the plan covers the frame's field
  sh.covers.push(PLAN_OUTLINE);

  // cartouches above and below the plan
  const plan = bbox(PLAN_OUTLINE),
    g = 30,
    cH = 110;
  (
    [
      [FLAT.basmala, plan.y - g - cH, 1],
      [FLAT.thanks, plan.y + plan.h + g, 2],
    ] as const
  ).forEach(([text, y, seed]) => {
    const pl = resolve(flatCartouche(text, seed));
    warnings.push(...pl.meta.warnings.map(w => `cartouche: ${w}`));
    sh.place(pl, {
      id: `fc${seed}`,
      ground: FLAT_PAL.room,
      slot: { x: plan.x + plan.w * 0.24, y, w: plan.w * 0.52, h: cH },
    });
  });

  // the frame, set so its field holds the plan and the cartouches, drawn first, its field's words left out under them
  const fr = resolve(flatFrame());
  warnings.push(...fr.meta.warnings.map(w => `frame: ${w}`));
  const frOuter = drawnPts(fr, outlineOf(fr).outer),
    crop = bbox(frOuter),
    field = bbox(drawnPts(fr, outlineOf(fr).inner!)),
    // room round the plan for the sky
    content: Box = {
      x: plan.x - SKY_MARGIN,
      y: plan.y - 2 * g - cH - SKY_MARGIN / 2,
      w: plan.w + 2 * SKY_MARGIN,
      h: plan.h + 4 * g + 2 * cH + SKY_MARGIN,
    },
    k = Math.max(content.w / field.w, content.h / field.h),
    centre: Pt = [
      content.x + content.w / 2 + (crop.x + crop.w / 2 - (field.x + field.w / 2)) * k,
      content.y + content.h / 2 + (crop.y + crop.h / 2 - (field.y + field.h / 2)) * k,
    ],
    x0 = centre[0] - (crop.w * k) / 2,
    y0 = centre[1] - (crop.h * k) / 2,
    toSheet = (p: Pt): Pt => {
      const [x, y] = drawnPts(fr, [p])[0];
      return [x0 + (x - crop.x) * k, y0 + (y - crop.y) * k];
    },
    frSvg = sh.set(svgBody(renderPlaced(sh.uncovered(fr, toSheet), { idPrefix: 'fr' })), crop, k, centre);

  const fieldS: Box = {
    x: x0 + (field.x - crop.x) * k,
    y: y0 + (field.y - crop.y) * k,
    w: field.w * k,
    h: field.h * k,
  };
  const sky = skyOver(fieldS, centreOf(PLAN_OUTLINE), sh.covers);
  warnings.push(...sh.write(sky.labels, sky.labelStyle, { id: 'sk', unit: PX }));

  const view = aSeries(frSvg.box);
  const svg =
    sheetOpen(view, 'A1', FLAT_PAL.ivory, 'Houses of rest: a flat plan in square Kufic') +
    frSvg.svg +
    sky.svg +
    sh.parts.join('') +
    '</svg>';
  return {
    svg,
    warnings,
    pen: { scale: fit.scale, limit: fit.limit ? `${ids[fit.limit.comp]} at ${fit.limit.scale}` : null },
    w: view.w,
    h: view.h,
  };
}
