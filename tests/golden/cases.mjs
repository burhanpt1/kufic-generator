// The fixed set of golden cases. Each case is a set of UI settings applied to the prototype on top of its defaults
// (see applyUI in harness.mjs); anything not listed keeps the page default.

export const TEXTS = {
  bv: 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ', // basmala, vocalised (page default)
  bp: 'بسم الله الرحمن الرحيم', // basmala, plain
  names: 'بسم الله الرحمن الرحيم\nمحمد علي فاطمة\nالحسن الحسين', // one ring per line
  la: 'لا اله الا الله',
  ali: 'يا علي مدد',
};

const LAYOUTS = { square: 'rings', circle: 'circle', line: 'line', letters: 'letters' };

// Option combos, applied to the square and circle layouts. Defaults (abjad centre with default size aside, empty
// corners, line bands) are covered by the *--default cases.
const COMBOS = {
  fatimid: { preset: 'fatimid' },
  banded: { letterStyle: 'banded' },
  'colour-ring': { colourMode: 'ring' },
  'colour-repeat': { colourMode: 'repeat' },
  'colour-radial': { colourMode: 'radial' },
  ...Object.fromEntries(
    ['abjad', 'letters', 'geo', 'squares', 'solid', 'none'].map(v => [`centre-${v}`, { center: v, centreSize: 0.3 }]),
  ),
  ...Object.fromEntries(['stars', 'geo', 'vine'].map(v => [`corners-${v}`, { corners: v }])),
  ...Object.fromEntries(['none', 'pearls', 'chevron', 'braid'].map(v => [`band-${v}`, { bandStyle: v }])),
  ...Object.fromEntries(['sq', '488', 'hex', '31212'].map(v => [`tiling-${v}`, { ground: 'geo', tiling: v }])),
  'ground-tint': { ground: 'tint' },
  'ground-vine': { ground: 'vine' },
  ...Object.fromEntries(['notch', 'bevel', 'leaf', 'palmette'].map(v => [`terminal-${v}`, { terminal: v }])),
  'reach-asc': { terminal: 'leaf', reach: 'asc' },
  'reach-all': { terminal: 'notch', reach: 'all' },
  'marks-off': { marks: 'off' },
  'marks-all': { marks: 'all' },
  'marks-early': { marks: 'all', vowels: 'early', contrast: false },
  'letters-alt': { ra: 'hook', ayn: 'cup', la: 'plain' },
  'ra-short': { ra: 'short' },
  'rings-4-taper': { rings: 4, taper: 0.8, centreSize: 0.1 },
  'rings-1': { rings: 1, centreSize: 0 },
  'no-repeat-no-rhythm': { repeat: false, rhythm: false },
  'gap-4-asc-13': { gap: 4, asc: 13 },
  'rot-90': { rot: 90, center: 'letters' },
  'grid-soft': { grid: true, soft: 0.8, weight: 0.5, palette: 4 },
  'geo-angle': { corners: 'geo', geoAngle: 40, geoScale: 9, tiling: 'hex' },
};
const COMBO_TEXTS = ['bv', 'names'];

// Option combos for the line and letters layouts.
const LINE_COMBOS = {
  banded: { letterStyle: 'banded' },
  'marks-all': { marks: 'all' },
  'marks-early': { marks: 'all', vowels: 'early' },
  'terminal-palmette': { terminal: 'palmette', reach: 'all' },
  'grid-tint': { grid: true, ground: 'tint' },
};
const LETTERS_COMBOS = {
  alt: { ra: 'hook', ayn: 'cup', la: 'plain' },
  'asc-15': { asc: 15, ra: 'short' },
  grid: { grid: true, palette: 2 },
};

function build() {
  const cases = [];
  const add = (id, ui) => cases.push({ id, ui });
  for (const [lk, layout] of Object.entries(LAYOUTS))
    for (const [tk, text] of Object.entries(TEXTS)) add(`${lk}--${tk}--default`, { layout, text });
  for (const lk of ['square', 'circle'])
    for (const tk of COMBO_TEXTS)
      for (const [ck, ui] of Object.entries(COMBOS)) {
        // the Fatimid preset sets its own layout; apply the layout after it so square gets the preset too
        add(`${lk}--${tk}--${ck}`, { ...ui, layout: LAYOUTS[lk], text: TEXTS[tk] });
      }
  for (const tk of ['bv', 'la'])
    for (const [ck, ui] of Object.entries(LINE_COMBOS))
      add(`line--${tk}--${ck}`, { ...ui, layout: 'line', text: TEXTS[tk] });
  for (const [ck, ui] of Object.entries(LETTERS_COMBOS)) add(`letters--${ck}`, { ...ui, layout: 'letters' });
  add('empty--blank', { text: '' });
  add('empty--latin', { text: 'hello' });
  add('square--mixed-unsupported', { text: 'بسم الله 123 abc' });
  return cases;
}

export const CASES = build();
