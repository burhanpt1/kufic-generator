// The roundel filler copies the composer's options out of a recipe by hand, so options added to the composer were
// silently out of a recipe's reach. The pass-through is now checked when compiling (src/compose/roundel.ts: every
// RoundelOptions key is either copied from the recipe or named in ROUNDEL_OPTIONS_NOT_IN_RECIPE); this pins the list
// of those the recipe schema has no field for, so it changes only when the schema gains the field.
import { describe, expect, it } from 'vitest';
import { ROUNDEL_OPTIONS_NOT_IN_RECIPE } from '../src/compose/roundel';
import type { RoundelRecipe } from '../src/model/schema';
import type { RoundelOptions } from '../src/script/thuluth/roundel';

const { internal, noSchemaField } = ROUNDEL_OPTIONS_NOT_IN_RECIPE;
// checked by `npm run typecheck`: none of them is a field of the recipe (once the schema has one, it is passed through
// and taken off the list)
type InSchema = Extract<keyof RoundelRecipe, (typeof noSchemaField)[number]>;
const noneInSchema: [InSchema] extends [never] ? true : InSchema = true;

describe('the composer options a recipe cannot set', () => {
  it('are named, each once', () => {
    const all: readonly (keyof RoundelOptions)[] = [...internal, ...noSchemaField];
    expect(new Set(all).size).toBe(all.length);
    expect(noneInSchema).toBe(true);
  });
  it('are these, for want of a field in the recipe schema', () => {
    expect([...noSchemaField].sort()).toEqual(['companion', 'companionScale', 'kernTouch', 'levels', 'margin', 'orderFirm', 'orderSlack', 'pathW', 'readW', 'stackBowls', 'stackMin', 'stackPull']); // prettier-ignore
  });
});
