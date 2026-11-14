// The ranges of a monogram's parameters. Several are loop bounds or grid sizes (the arm of a tughra sizes its grid,
// its flags and a spiral's rings are loop counts, the ascender height sizes every letter), so values from outside (a
// link, a saved file, a mutated genome) are held to these ranges twice: the schema rejects what lies outside them,
// and the builder clamps whatever reaches it anyway. Every shipped preset, the lab's reference cases and what
// evolution writes lie well inside.
import { seedInt } from '../model/seed';
import type { MonoParams } from './methods';

export type MonoLimit =
  | { kind: 'int' | 'num'; min: number; max: number }
  | { kind: 'bool' }
  | { kind: 'enum'; values: readonly string[] }
  /** Any number: normalised to a non-negative integer (seedInt). */
  | { kind: 'seed' };

const int = (min: number, max: number): MonoLimit => ({ kind: 'int', min, max }),
  num = (min: number, max: number): MonoLimit => ({ kind: 'num', min, max }),
  bool: MonoLimit = { kind: 'bool' },
  oneOf = (...values: string[]): MonoLimit => ({ kind: 'enum', values });

export const MONO_LIMITS: Record<keyof MonoParams, MonoLimit> = {
  H: int(5, 21),
  stretch: int(0, 40),
  overlap: int(0, 12),
  nest: bool,
  lines: int(0, 12),
  lineGap: int(0, 8),
  alternate: bool,
  spiralRings: int(1, 8),
  corners: bool,
  core: oneOf('none', 'squares', 'seal'),
  spineH: int(5, 31),
  flags: int(0, 6),
  loops: int(0, 6),
  loopW: num(0, 2),
  armLen: int(0, 60),
  arms: int(1, 3),
  stretchy: bool,
  joins: bool,
  sym: oneOf('none', 'mirror', 'turn'),
  box: num(0, 3),
  share: num(0, 10),
  fourfold: bool,
  dots: bool,
  frame: oneOf('none', 'square', 'double'),
  curved: bool,
  seed: { kind: 'seed' },
  tries: int(1, 8),
  reshape: bool,
  blocks: num(0, 1000),
  words: bool,
};

/** One value brought into its range (rounded where an integer is wanted), or undefined if it is of the wrong type. */
export function clampMonoValue(limit: MonoLimit, v: unknown): number | string | boolean | undefined {
  switch (limit.kind) {
    case 'bool':
      return typeof v === 'boolean' ? v : undefined;
    case 'enum':
      return typeof v === 'string' && limit.values.includes(v) ? v : undefined;
    case 'seed':
      return typeof v === 'number' ? seedInt(v) : undefined;
    default: {
      if (typeof v !== 'number' || Number.isNaN(v)) return undefined;
      const c = Math.max(limit.min, Math.min(limit.max, v));
      return limit.kind === 'int' ? Math.round(c) : c;
    }
  }
}

/** Parameters with every known key in range and of its type; unknown keys and values of the wrong type are dropped
 *  (the defaults then apply). Values already in range come back unchanged, in the same order. */
export function clampMonoParams(params: Record<string, unknown>): Partial<MonoParams> {
  const out: Record<string, number | string | boolean> = {};
  for (const [k, v] of Object.entries(params)) {
    if (!Object.hasOwn(MONO_LIMITS, k)) continue;
    const c = clampMonoValue(MONO_LIMITS[k as keyof MonoParams], v);
    if (c !== undefined) out[k] = c;
  }
  return out as Partial<MonoParams>;
}
