// A test per roundel recipe option: every option the schema accepts reaches the drawing. Each case sets one option on
// a quick base recipe and the drawing (ink and metrics) must change; a new option without a case fails the first test.
import { describe, expect, it } from 'vitest';
import { drawRoundel } from '../src/compose/roundel';
import type { RoundelRecipe } from '../src/model/schema';
import { ROUNDEL_RECIPE_KEYS } from '../src/model/schema';

const BASE: RoundelRecipe = { tries: 1, iters: 500, seed: 3, judge: 1 },
  NAMES = 'محمد علي',
  BASMALA = 'بسم الله الرحمن الرحيم';
/** Option → the text to try it on and the recipe that sets it (on top of BASE and any `with`). */
const CASES: Record<string, { text?: string; set: RoundelRecipe; with?: RoundelRecipe }> = {
  elongate: { set: { elongate: true } },
  // stems through horizontals cheaply: told apart only where words are pressed together
  cross: { text: 'لا اله الا الله', set: { cross: true }, with: { fillTarget: 0.9, iters: 3000 } },
  merge: { text: 'ا ا ا ا ا ا', set: { merge: true }, with: { fillTarget: 0.9, iters: 3000 } },
  cradle: { text: 'علي حسن', set: { cradle: true }, with: { elongate: true, great: { ya: true }, iters: 1500 } },
  kern: { text: 'رسول', set: { kern: true } },
  nest: { text: 'رسول', set: { nest: true } },
  stack: { text: 'رسول الله', set: { stack: true }, with: { iters: 1500 } },
  stackAt: { text: 'شمير', set: { stackAt: ['شمير'] } },
  learnedStack: { text: 'محمد علي', set: { learnedStack: true } },
  girift: { text: BASMALA, set: { girift: 0.12 } },
  hairline: { text: BASMALA, set: { hairline: 0.3 } },
  towers: { text: 'محمد', set: { towers: true }, with: { learnedStack: true, towerPull: 3, iters: 1500 } },
  towerPull: { text: 'محمد', set: { towerPull: 3 }, with: { learnedStack: true, towers: true, iters: 1500 } },
  rise: { text: 'الله', set: { rise: { most: 3, oval: 1 } }, with: { oval: 1.6 } },
  tails: { text: 'ورحمة', set: { tails: {} } },
  noRise: { text: BASMALA, set: { noRise: true } },
  ceiling: { text: BASMALA, set: { ceiling: true } },
  // mostly subsumed by the reading-order rule: shows where two short words still overlap in a column
  topFirst: { text: 'علي حسن', set: { topFirst: true }, with: { seed: 5 } },
  // the fill only pays below the target, so a target far below the fill reached changes the search
  fillTarget: { set: { fillTarget: 0.05 } },
  oval: { set: { oval: 1.6 } },
  emph: { text: 'زينب وقصي', set: { emph: 'ب' }, with: { elongate: true, oval: 1.45, fillTarget: 0.5, iters: 1500 } },
  tries: { text: 'علي حسن', set: { tries: 6 } },
  iters: { text: BASMALA, set: { iters: 1500 } },
  seed: { text: BASMALA, set: { seed: 41 } },
  fixed: {
    set: {
      fixed: {
        lv: [0, 0],
        wp: [
          { x: 0, y: 0 },
          { x: -2, y: -9 },
        ],
      },
    },
  },
  stackPull: { set: { stackPull: 1.6 } },
  great: { text: 'علي', set: { great: { ya: true } } },
  tweaks: { set: { tweaks: [{ at: 'علي', scale: 0.7 }] } },
  bowl: { text: 'علي حسن', set: { bowl: {} }, with: { great: { ya: true } } },
  markReach: { text: 'مُحَمَّد عَلِيّ', set: { markReach: 0.6 } },
  ornaments: { set: { ornaments: true } },
  density: { set: { density: 1 }, with: { ornaments: true } },
  ornStyle: { set: { ornStyle: 'trefoil' }, with: { ornaments: true, density: 1 } },
  path: { text: BASMALA, set: { path: 'stag3' } },
  field: { text: BASMALA, set: { field: 'drop' } },
  ruled: { text: BASMALA, set: { ruled: true } },
  lanes: { text: BASMALA, set: { lanes: {} } },
  pathFill: { text: BASMALA, set: { pathFill: 1.1 }, with: { lanes: {} } },
  pathTol: { text: BASMALA, set: { pathTol: 6 }, with: { lanes: {} } },
  readRule: { text: BASMALA, set: { readRule: false }, with: { lanes: {} } },
  choose: { text: BASMALA, set: { choose: 3 } },
  vary: { text: BASMALA, set: { vary: false }, with: { choose: 3 } },
  judge: { set: { judge: 4 }, with: { tries: 4, seed: 5 } },
  mirror: { text: 'علي', set: { mirror: true }, with: { great: { ya: true } } },
  fathaRule: { text: 'اَللّٰهُ نُورُ السَّمَاوَاتِ', set: { fathaRule: false } },
  longFatha: { text: 'اَللّٰهُ نُورُ السَّمَاوَاتِ وَالْأَرْضِ', set: { longFatha: false }, with: { iters: 1500 } },
  allSigns: { text: 'حسين', set: { allSigns: false }, with: { ornaments: true } },
  pockets: { set: { pockets: false }, with: { ornaments: true, density: 1 } },
  clearance: { text: 'مُحَمَّد عَلِيّ', set: { clearance: 1.2 } },
  markDensity: { text: 'مُحَمَّد عَلِيّ', set: { markDensity: 0.1 } },
  // without الله, whose marks its ligature draws; on lanes, where a fatha finds a gap to span
  fathaGap: { text: 'سَلَامٌ قَوْلًا مِنْ رَبٍّ رَحِيمٍ', set: { fathaGap: true }, with: { iters: 1500, lanes: {} } },
};

const draw = (text: string, r: RoundelRecipe) => {
  const d = drawRoundel(text, r, { preset: 'roundel' }, false);
  return d && JSON.stringify([d.ink, d.Rf, d.marks, d.missing]);
};

describe('roundel recipe options', () => {
  it('each has a case', () => {
    expect(ROUNDEL_RECIPE_KEYS().filter(k => !CASES[k])).toEqual([]);
  });
  for (const [k, c] of Object.entries(CASES))
    it(`${k} reaches the drawing`, () => {
      const text = c.text ?? NAMES,
        base = { ...BASE, ...c.with };
      expect(draw(text, { ...base, ...c.set })).not.toBe(draw(text, base));
    }, 120_000);
});
