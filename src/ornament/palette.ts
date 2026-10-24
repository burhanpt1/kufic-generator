// Palettes for name cartouches from one primary and one accent colour, built with Adobe Leonardo (the open-source
// engine behind leonardocolor.io, Apache-2.0): every role is a shade of one of the two, found by its contrast against
// the field, so the names always read over the tiles and the tiles stay quiet behind them.
import { BackgroundColor, Color, Theme } from '@adobe/leonardo-contrast-colors';

export interface NamePalette {
  /** The field and the tiles on it (ground, two tile inks and a spot colour), faint against the field. */
  field: string;
  tiles: { ink: string; ink2: string; mark: string };
  /** Both names' letters, dots and vowels; the letters' eyes; the conjunction; the rim, its line and its sheen. */
  names: string;
  eyes: string;
  accent: string;
  rim: string;
  line: string;
  sheen: string;
}

/** Contrast against the field for each role (WCAG ratios: 1 is the field itself, 21 black on white). */
const PRIMARY = { tiles: 1.75, sheen: 5.5, rim: 7, names: 9, line: 11 };
const ACCENT = { tiles: 1.6, mark: 2.1, eyes: 2.2, accent: 4.5 };

/** A palette from a primary and an accent colour; lightness is the field's (0–100, light by default). */
export function namePalette(primary: string, accent: string, lightness = 97): NamePalette {
  const ratios = (o: Record<string, number>) => Object.values(o);
  const p = new Color({
      name: 'p',
      colorKeys: [primary as `#${string}`],
      ratios: ratios(PRIMARY),
      colorSpace: 'OKLCH',
    }),
    a = new Color({ name: 'a', colorKeys: [accent as `#${string}`], ratios: ratios(ACCENT), colorSpace: 'OKLCH' }),
    bg = new BackgroundColor({ name: 'bg', colorKeys: [primary as `#${string}`], ratios: [1], colorSpace: 'OKLCH' });
  const t = new Theme({ colors: [p, a], backgroundColor: bg, lightness, contrast: 1 }),
    [head, ...cs] = t.contrastColors as [{ background: string }, ...{ values: { value: string }[] }[]];
  const at = (k: number, o: Record<string, number>) => (key: string) => cs[k].values[Object.keys(o).indexOf(key)].value;
  const P = at(0, PRIMARY),
    A = at(1, ACCENT);
  return {
    field: head.background,
    tiles: { ink: P('tiles'), ink2: A('tiles'), mark: A('mark') },
    names: P('names'),
    eyes: A('eyes'),
    accent: A('accent'),
    rim: P('rim'),
    line: P('line'),
    sheen: P('sheen'),
  };
}
