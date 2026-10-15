// Letter shapes: groups × forms as rows of '#'/'.' (top row first), style variants, and the char -> group map.
import type { Form, GlyphDef, Rows } from '../types';

type FormTable = Partial<Record<Form, GlyphDef>>;

const A7 = ['#', '#', '#', '#', '#', '#', '#'];
const TOOTH = ['#', '#', '#'];
const FEH_IM = ['###', '#.#', '###', '#..', '###'];
export const D: Record<string, Record<Form, Rows>> = (() => {
  const d: Record<string, Partial<Record<Form, Rows>>> = {
    ALEF: { iso: A7, fin: A7 },
    LAM: { ini: A7, med: A7, fin: ['..#', '..#', '..#', '..#', '#.#', '#.#', '###'] },
    LAMALEF: { iso: ['#.#', '#.#', '#.#', '#.#', '#.#', '#.#', '###'] },
    BEH: { ini: TOOTH, med: TOOTH, fin: ['#...#', '#...#', '#####'] },
    NOON: { ini: TOOTH, med: TOOTH, fin: ['#.#', '#.#', '###'] },
    YEH: { ini: TOOTH, med: TOOTH, fin: ['#..##', '#...#', '#####'] },
    HAH: { ini: ['###', '..#', '..#', '..#', '###'], fin: ['..###', '....#', '#...#', '#...#', '#####'] },
    DAL: { iso: ['###', '..#', '###'] },
    REH: { iso: ['..#', '..#', '###'] },
    WAW: { iso: ['###', '#.#', '###', '..#', '###'] },
    MEEM: { ini: ['###', '#.#', '###'], fin: ['..###', '#.#.#', '#####'] },
    HEH: { ini: ['###', '#.#', '###', '#.#', '###'], fin: ['..#', '..#', '###', '#.#', '###'] },
    SEEN: { ini: ['#.#.#', '#.#.#', '#####'], fin: ['#..#.#.#', '#..#.#.#', '########'] },
    SAD: { ini: ['#.#####', '#.#...#', '#######'], fin: ['#..#####', '#..#...#', '########'] },
    TAH: { iso: ['#....', '#....', '#....', '#....', '#####', '#...#', '#####'] },
    AIN: { ini: ['#.#', '###', '.#.', '.#.', '###'], fin: ['..#.#', '..###', '#..#.', '#..#.', '#####'] },
    FEH: { ini: FEH_IM, fin: ['...###', '...#.#', '#..###', '#..#..', '######'] },
    QAF: { ini: FEH_IM, fin: ['#.###', '#.#.#', '#.###', '#.#..', '#####'] },
    KAF: {
      ini: ['###', '#..', '#..', '#..', '#..', '#..', '###'],
      fin: ['..###', '..#..', '..#..', '..#..', '#.#..', '#.#..', '#####'],
    },
    // گ: kaf with a second arm under the first (it was drawn as ك)
    GAF: {
      ini: ['###', '#..', '###', '#..', '#..', '#..', '###'],
      fin: ['..###', '..#..', '..###', '..#..', '#.#..', '#.#..', '#####'],
    },
    HAMZA: { iso: ['##', '#.', '##'] },
    TATWEEL: { iso: ['##'] },
  };
  for (const k in d) {
    const g = d[k];
    g.iso = g.iso || g.fin;
    g.fin = g.fin || g.iso;
    g.ini = g.ini || g.iso;
    g.med = g.med || g.ini;
  }
  return d as Record<string, Record<Form, Rows>>;
})();

// Letter style variants. A def is rows (top -> bottom) or { rows, base } where base = rows below the baseline.
export const VARIANTS: {
  ra: Record<string, FormTable>;
  ayn: Record<string, FormTable>;
  meem: Record<'flat' | 'drop', GlyphDef>;
  sad: Record<'tall' | 'short', GlyphDef>;
} = {
  ra: {
    desc: { iso: { rows: ['..#', '..#', '..#', '###'], base: 2 } },
    short: { iso: ['..#', '..#', '###'] },
    hook: { iso: ['#..', '#..', '###'] },
  },
  ayn: {
    open: {
      ini: ['###', '#..', '###'],
      med: ['#.#', '#.#', '###'],
      fin: ['..###', '..#..', '#.###', '#...#', '#####'],
    },
    cup: {
      ini: ['#.#', '###', '.#.', '.#.', '###'],
      med: ['#.#', '###', '.#.', '.#.', '###'],
      fin: ['..#.#', '..###', '#..#.', '#..#.', '#####'],
    },
  },
  // final م: with a post on its left it read as ص (owner's review: سلام); 'drop' runs its tail below the line
  meem: {
    flat: ['..###', '#.#.#', '#####'],
    drop: { rows: ['..###', '..#.#', '#####', '#....', '#....'], base: 2 },
  },
  // initial and medial ص ض: a 'short' tooth after the loop doesn't read as a letter of its own (owner's review: ضياء)
  sad: {
    tall: ['#.#####', '#.#...#', '#######'],
    short: ['..#####', '#.#...#', '#######'],
  },
};
/** Long alternates of final letters, chosen by the justifier when a line has room (letter.alternates). Original
 *  designs for this engine's grid (Fatimid-inspired: upturned and descending tails, a long kaf arm); nothing here is
 *  copied from a font. */
export const ALTS: Record<string, Partial<Record<Form, GlyphDef>>> = (() => {
  // tails rise only part way and curl back toward the letter, so they never read as a final alif
  const noon = ['##...', '#....', '#...#', '#...#', '#####'],
    yeh = ['##.....', '#......', '#....##', '#.....#', '#######'],
    kaf = ['..#####', '..#....', '..#....', '..#....', '#.#....', '#.#....', '#######'],
    meem: GlyphDef = { rows: ['...###', '#..#.#', '######', '#.....', '#.....'], base: 2 };
  return {
    NOON: { fin: noon, iso: noon },
    YEH: { fin: yeh, iso: yeh },
    KAF: { fin: kaf, iso: kaf },
    MEEM: { fin: meem, iso: meem },
  };
})();
/** The Fatimid letter set (letter.set = 'fatimid'): original designs for this engine's grid after the general
 *  conventions of Fatimid Kufic (ر and و dropping below the line and turning back in a long tail, a medial ه of two
 *  loops above and below it, a د with an upturned beak). Strokes stay orthogonal:
 *  diagonal links draw as crossings in block style. Nothing is copied from a font. */
export const FATIMID: Record<string, Partial<Record<Form, GlyphDef>>> = {
  DAL: { iso: ['#..', '###', '..#', '..#', '###'] },
  REH: { iso: { rows: ['...#', '...#', '...#', '...#', '####'], base: 2 } },
  WAW: { iso: { rows: ['.###', '.#.#', '.###', '...#', '####'], base: 2 } },
  // initial ه keeps its square form: two loops at the start of a word read as the numeral 8
  HEH: { med: { rows: ['###', '#.#', '###', '#.#', '###'], base: 2 } },
};
/** Long alternates of the Fatimid set, on top of ALTS: final ف ق ص س with tails rising and curling back. */
export const FATIMID_ALTS: Record<string, Partial<Record<Form, GlyphDef>>> = (() => {
  const feh = ['......###', '##....#.#', '#.....###', '#.....#..', '#########'],
    qaf = ['##...###', '#....#.#', '#....###', '#....#..', '########'],
    sad = ['##........', '#.........', '#....#####', '#....#...#', '##########'],
    seen = ['##........', '#.........', '#....#.#.#', '#....#.#.#', '##########'];
  return {
    FEH: { fin: feh, iso: feh },
    QAF: { fin: qaf, iso: qaf },
    SAD: { fin: sad, iso: sad },
    SEEN: { fin: seen, iso: seen },
  };
})();
/** Mark anchors of Fatimid forms whose ink sits off their middle column. */
export const FATIMID_ANCHOR: Record<string, Partial<Record<Form, number>>> = {
  REH: { iso: 3, fin: 3 },
  WAW: { iso: 2, fin: 2 },
};
export const LAMALEF_KNOT = { iso: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#####'] };

// where dots/marks centre, when not the glyph's middle column
export const ANCHOR: Record<string, Partial<Record<Form, number>>> = {
  SEEN: { fin: 5, iso: 5, ini: 2, med: 2 },
  SAD: { ini: 4, med: 4, fin: 5, iso: 5 },
  AIN: { fin: 3, iso: 3 },
  FEH: { fin: 4, iso: 4 },
  QAF: { fin: 3, iso: 3 },
  HAH: { fin: 3, iso: 3 },
  TAH: { iso: 2, fin: 2, ini: 2, med: 2 },
};
export const ANCHOR_BELOW: Record<string, Partial<Record<Form, number>>> = { HAH: { fin: 2, iso: 2 } };

export const MAP: Record<string, string> = {};
const add = (key: string, chars: string) => {
  for (const c of chars) MAP[c] = key;
};
add('ALEF', 'اأإآٱ');
add('BEH', 'بتثپٹٺٻٽٿ');
add('NOON', 'نں');
add('YEH', 'يىئیےې');
add('HAH', 'جحخچڃڄڇ');
add('DAL', 'دذڈڊڍڌڏ');
add('REH', 'رزڑژ');
add('SEEN', 'سش');
add('SAD', 'صض');
add('TAH', 'طظ');
add('AIN', 'عغ');
add('FEH', 'فڤڦ');
add('QAF', 'ق');
add('KAF', 'كکڪ');
add('GAF', 'گ');
add('LAM', 'ل');
add('MEEM', 'م');
add('HEH', 'هہھةۃ');
add('WAW', 'وؤۆۇۈۋ');
add('HAMZA', 'ء');
add('TATWEEL', 'ـ');
/** Right-joining only: these letters never connect to the next one. */
export const RJ = new Set('اأإآٱدذڈڊڍڌڏرزڑژوؤۆۇۈۋةۃے');
/** Non-joining. */
export const NJ = new Set('ء');

export const GROUPS = [
  'ALEF', 'BEH', 'HAH', 'DAL', 'REH', 'SEEN', 'SAD', 'TAH', 'AIN', 'FEH',
  'QAF', 'KAF', 'LAM', 'MEEM', 'NOON', 'HEH', 'WAW', 'YEH', 'LAMALEF', 'HAMZA',
]; // prettier-ignore
