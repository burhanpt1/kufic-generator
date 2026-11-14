// The roundel filler copies the composer's options out of a recipe by hand, so options added to the composer were
// silently out of a recipe's reach. The pass-through is now checked when compiling (src/compose/roundel.ts: every
// RoundelOptions key is either copied from the recipe or named in ROUNDEL_OPTIONS_NOT_IN_RECIPE). The recipe schema
// has a field for every option a recipe may choose; this pins that none is left without one, that the fields are
// bounded (a recipe comes from a link as readily as from the studio), and that a recipe without them is unchanged.
import { describe, expect, it } from 'vitest';
import { ROUNDEL_OPTIONS_NOT_IN_RECIPE } from '../src/compose/roundel';
import { NAMES_RECIPE } from '../src/model/names';
import { preset } from '../src/model/presets';
import { parseComposition, ROUNDEL_RECIPE_KEYS } from '../src/model/schema';
import type { Composition, RoundelRecipe } from '../src/model/schema';
import type { RoundelOptions } from '../src/script/thuluth/roundel';

const { internal, noSchemaField } = ROUNDEL_OPTIONS_NOT_IN_RECIPE;
// checked by `npm run typecheck`: none of them is a field of the recipe (once the schema has one, it is passed through
// and taken off the list)
type InSchema = Extract<keyof RoundelRecipe, (typeof noSchemaField)[number]>;
const noneInSchema: [InSchema] extends [never] ? true : InSchema = true;

/** The names cartouche with a recipe of its own. */
const withRecipe = (recipe: unknown): Composition => {
  const c = structuredClone(preset('names-cartouche')) as Composition;
  (c.root.child.fill as { recipe: unknown }).recipe = recipe;
  return c;
};
const accepts = (recipe: unknown) => {
  try {
    parseComposition(withRecipe(recipe));
    return true;
  } catch {
    return false;
  }
};

describe('the composer options a recipe cannot set', () => {
  it('are named, each once', () => {
    const all: readonly (keyof RoundelOptions)[] = [...internal, ...noSchemaField];
    expect(new Set(all).size).toBe(all.length);
    expect(noneInSchema).toBe(true);
  });
  it('are only the composer’s own: none waits for a field in the recipe schema', () => {
    expect([...noSchemaField]).toEqual([]);
    expect([...internal].sort()).toEqual(['K', 'deep', 'kashMap', 'longFinal', 'tail', 'tails']);
  });
});

describe('the composer’s finer options in a recipe', () => {
  // each with a value inside its bounds, and values outside them
  const FIELDS: Record<string, { ok: unknown[]; bad: unknown[] }> = {
    companion: { ok: ['', 'نور', 'ن'.repeat(60)], bad: ['ن'.repeat(61), 3] },
    companionScale: { ok: [0.2, 0.42, 1], bad: [0, 0.19, 1.01, '0.5'] },
    kernTouch: { ok: [0, 3, 20], bad: [-1, 20.5, Infinity] },
    stackPull: { ok: [0, 1.6, 5], bad: [-0.1, 5.1, NaN] },
    stackMin: { ok: [0.05, 0.2, 0.45, 1], bad: [0, 0.04, 1.1] },
    stackBowls: { ok: [true, false], bad: [1, 'yes'] },
    levels: {
      ok: [[0], [0, 2, 4, 7], [0, 1, 2, 3, 4, 13]],
      bad: [[], [-1], [14], [0, 1, 2, 3, 4, 5, 6], 4, [Infinity]],
    },
    margin: { ok: [1, 2, 4], bad: [0, 1.5, 5, 1e9] },
    pathW: { ok: [0, 0.6, 10], bad: [-1, 11] },
    readW: { ok: [0, 1.5, 10], bad: [-1, 11] },
    orderFirm: { ok: [0, 3, 20], bad: [-1, 21] },
    orderSlack: { ok: [0, 1, 10], bad: [-1, 11, 1e9] },
    wordGap: { ok: [0, 1.6, 2.4, 6], bad: [-0.1, 6.1, NaN, '2'] },
  };
  it('are accepted within bounds and refused outside them', () => {
    for (const [k, { ok, bad }] of Object.entries(FIELDS)) {
      for (const v of ok) expect(accepts({ ...NAMES_RECIPE, [k]: v }), `${k}: ${JSON.stringify(v)}`).toBe(true);
      for (const v of bad) expect(accepts({ ...NAMES_RECIPE, [k]: v }), `${k}: ${String(v)}`).toBe(false);
    }
  });
  it('are not written into a recipe that leaves them out', () => {
    // a parsed composition is serialised into links and compared with what is saved: no key may appear, and (parsing
    // writes a recipe's keys in the schema's order) the new fields come after every older one, so none moves
    for (const id of ['names-cartouche', 'ahl-al-bayt']) {
      const c = preset(id),
        recipe = (parseComposition(structuredClone(c)).root.child.fill as { recipe: RoundelRecipe }).recipe,
        given = (c.root.child.fill as { recipe: RoundelRecipe }).recipe;
      expect(recipe).toEqual(given);
      expect(Object.keys(recipe).sort()).toEqual(Object.keys(given).sort());
    }
    expect(ROUNDEL_RECIPE_KEYS().slice(-Object.keys(FIELDS).length)).toEqual(Object.keys(FIELDS));
    const sparse = { kern: true, margin: 2, tries: 2, levels: [0, 2] };
    const fill = parseComposition(withRecipe(sparse)).root.child.fill as { recipe: RoundelRecipe };
    expect(fill.recipe).toEqual(sparse);
    expect(Object.keys(fill.recipe).sort()).toEqual(Object.keys(sparse).sort());
  });
});
