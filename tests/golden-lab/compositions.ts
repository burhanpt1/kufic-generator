// The lab reference cases (cases.mjs) expressed as compositions, so the engine's renders can be compared with them.
import type { BorderNode, Composition, FillerNode, Outline, Separator, Style } from '../../src/model/schema';
import { DEFAULT_STYLE, PALETTES } from '../../src/model/style';

const PALS = [
  PALETTES.carvedStone,
  PALETTES.bannaiBrick,
  PALETTES.cobalt,
  PALETTES.ink,
  PALETTES.goldOnLapis,
  PALETTES.chalk,
];
// the lab's FATIMID genome and fill defaults
const FATIMID: Record<string, unknown> = {
  layout: 'circle', sides: 8, points: 8, depth: 0.55, spread: 1, rings: 3, taper: 0.5, centre: 0.16, H: 11, gap: 2, terminal: 'palmette', reach: 'tails', bandStyle: 'braid',
  ground: 'vine', corners: 'geo', center: 'mono', tiling: '488', geoAngle: 67, geoScale: 5, palette: 0, colourMode: 'ring', letterStyle: 'solid', weight: 0.8, soft: 0.3,
  la: 'knot', ra: 'desc', marks: 'dots', stroke: 'blocks', curve: 0.6,
}; // prettier-ignore
const FILL: Record<string, unknown> = {
  style: 'lines', straight: 0.7, mseed: 7, shape: 'teardrop', sides: 8, depth: 0.55, borderRings: 1, H: 9, lineGap: 1, marks: 'dots', la: 'knot', terminal: 'palmette', reach: 'tails',
  palette: 0, weight: 0.85, soft: 0.2, colourMode: 'ring', ground: 'tint', corners: 'none', bandStyle: 'braid', tiling: '488', geoAngle: 67, geoScale: 5, letterStyle: 'solid', stroke: 'curved', curve: 0.5,
}; // prettier-ignore
const TILING: Record<string, 'square' | '488' | 'hex' | '31212'> = {
  sq: 'square',
  '488': '488',
  hex: 'hex',
  '31212': '31212',
};
const COLOURING: Record<string, Style['colouring']> = {
  solid: 'solid',
  ring: 'byRing',
  repeat: 'byRepeat',
  radial: 'radial',
};

const outlineOf = (layout: string, sides: number, points: number, depth: number): Outline =>
  layout === 'circle'
    ? { kind: 'circle' }
    : layout === 'poly' || layout === 'rings'
      ? { kind: 'polygon', sides: layout === 'rings' ? 4 : sides }
      : layout === 'star'
        ? { kind: 'star', points, depth }
        : { kind: 'preset', name: layout as 'teardrop' };

function styleOf(g: Record<string, unknown>): Style {
  const s = structuredClone(DEFAULT_STYLE) as Style;
  s.letter = {
    ...s.letter,
    ascenders: g.H as 9,
    lamAlif: g.la as 'knot',
    ra: (g.ra as 'desc') ?? 'desc',
    marks: (g.marks as 'dots') ?? 'dots',
  };
  s.stroke = {
    kind: g.stroke as 'blocks',
    corner: (g.curve as number) ?? 0.6,
    weight: g.weight as number,
    softness: g.soft as number,
    banded: g.letterStyle === 'banded',
  };
  s.terminals = { kind: g.terminal as 'none', reach: g.reach === 'asc' ? 'tall' : (g.reach as 'tails') };
  s.palette = { ...PALS[g.palette as number] };
  s.colouring = COLOURING[g.colourMode as string];
  return s;
}
const pattern = (g: Record<string, unknown>) => ({
  tiling: TILING[g.tiling as string],
  angle: g.geoAngle as number,
  scale: g.geoScale as number,
});
const sepWidth = (g: Record<string, unknown>) => {
  const big = g.terminal === 'leaf' || g.terminal === 'palmette',
    rich = g.bandStyle !== 'none' && g.bandStyle !== 'lines';
  return Math.max((g.gap as number) ?? 1, rich ? (big ? 4 : 3) : big ? 2 : g.bandStyle === 'lines' ? 2 : 1);
};

export function labCaseToComposition(c: { id: string; kind: string; [k: string]: unknown }): Composition {
  const base = (
    st: Style,
    texts: Composition['texts'],
    child: Composition['root']['child'],
    spandrels?: Composition['root']['spandrels'],
  ): Composition => ({
    version: 1,
    seed: 4243,
    canvas: { shape: 'square', margin: 3 },
    style: st,
    texts,
    root: { type: 'frame', ...(spandrels ? { spandrels } : {}), child },
  });
  if (c.kind === 'shape') {
    const g = { ...FATIMID, ...(c.genome as object) } as Record<string, unknown>,
      text = c.text as string,
      lines = text.split('\n').filter(Boolean);
    const sep: Separator = { kind: g.bandStyle as Separator['kind'], width: sepWidth(g) };
    const ground =
      g.ground === 'plain'
        ? undefined
        : g.ground === 'geo'
          ? { kind: 'pattern' as const, pattern: pattern(g) }
          : { kind: g.ground as 'tint' };
    const borders: BorderNode[] =
      lines.length > 1
        ? [{ type: 'textBorder', text: 't', taper: g.taper as number, separator: sep, ...(ground ? { ground } : {}) }]
        : Array.from({ length: g.rings as number }, (_, k) => ({
            type: 'textBorder' as const,
            text: 't',
            taper: k ? (g.taper as number) : 0,
            separator: sep,
            ...(ground ? { ground } : {}),
          }));
    const fill: FillerNode | undefined =
      g.center === 'abjad' ? { type: 'abjad', text: 't' } : g.center === 'geo' ? { type: 'pattern', pattern: pattern(g) } : g.center === 'squares' ? { type: 'rings' } : g.center === 'solid' ? { type: 'solid' }
        : { type: 'monogram', text: 't', method: 'seal', params: { H: 7, sym: 'mirror', box: 0.7, share: 2, tries: 4, seed: 4243, words: false } }; // prettier-ignore
    const spandrels =
      g.corners === 'none'
        ? undefined
        : g.corners === 'geo'
          ? { type: 'pattern' as const, pattern: pattern(g) }
          : g.corners === 'stars'
            ? { type: 'stars' as const }
            : { type: 'vine' as const };
    return base(
      styleOf(g),
      { t: { text, repeat: 'fill', wordGap: 2 } },
      {
        type: 'region',
        outline: outlineOf(g.layout as string, g.sides as number, g.points as number, g.depth as number),
        spread: g.spread as number,
        borders,
        fill,
      },
      spandrels,
    );
  }
  if (c.kind === 'fill' || c.kind === 'maze') {
    const f = { ...FILL, ...(c.state as object) } as Record<string, unknown>;
    const outline = outlineOf(f.shape as string, f.sides as number, f.sides as number, f.depth as number);
    const st = styleOf({ ...f, ra: 'desc' });
    if (c.kind === 'maze')
      return base(
        st,
        { t: { text: c.text as string, repeat: 'fill', wordGap: 2 } },
        {
          type: 'region',
          outline,
          size: 60,
          borders: [],
          fill: { type: 'maze', text: 't', corridors: f.straight as number, wall: true, seed: f.mseed as number },
        },
      );
    const sep: Separator = { kind: f.bandStyle as Separator['kind'], width: sepWidth({ ...f, gap: 0 }) };
    const borders: BorderNode[] = Array.from({ length: f.borderRings as number }, () => ({
      type: 'textBorder' as const,
      text: 'b',
      separator: sep,
      ground: { kind: 'tint' as const },
    }));
    return base(
      st,
      {
        b: { text: c.border as string, repeat: 'fill', wordGap: 2 },
        t: { text: c.text as string, repeat: 'once', wordGap: 2 },
      },
      { type: 'region', outline, borders, fill: { type: 'lines', text: 't', lineGap: f.lineGap as number } },
    );
  }
  // monogram
  const p = c.params as Record<string, unknown>,
    method = (p.mode === 'pinout' ? 'pinwheel' : p.mode === 'pinin' ? 'pinwheelIn' : p.mode) as 'seal';
  const st = styleOf({
    H: 9,
    la: 'knot',
    stroke: p.stroke ?? 'blocks',
    curve: p.curve ?? 0.4,
    weight: 0.85,
    soft: 0.2,
    terminal: 'none',
    reach: 'tails',
    palette: 0,
    colourMode: 'solid',
    letterStyle: 'solid',
  });
  const { mode: _m, stroke: _s, curve: _c, ...params } = p;
  void _m;
  void _s;
  void _c;
  return base(
    st,
    { t: { text: c.text as string, repeat: 'fill', wordGap: 2 } },
    {
      type: 'region',
      outline: { kind: 'polygon', sides: 4 },
      size: 40,
      borders: [],
      // the lab's seals interlock the text's distinct letters
      fill: { type: 'monogram', text: 't', method, params: { ...(params as Record<string, number>), words: false } },
    },
  );
}
