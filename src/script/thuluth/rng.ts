// Seeded randomness for the thuluth composers: the Park–Miller generator used everywhere (COMPOSITION_ENGINE.md
// §1.3; `Rng` in src/evolve/rng.ts is the same stream), with any seed made a state the generator can run from.
const M = 2147483647;

/** A state the generator can run from, for any seed. A seed that already runs (positive, and not a multiple of the
 *  modulus) is kept as it is, so its stream is the one it always gave; zero, a negative seed, a multiple of the modulus
 *  or a number that is none (which gave a stream stuck at zero, negative values, or NaN) is mapped to 1 … M − 1 by its
 *  magnitude, as `Rng` does. */
export function seedState(seed: number): number {
  if (Number.isFinite(seed) && seed > 0 && seed % M !== 0) return seed;
  return (Number.isFinite(seed) ? Math.floor(Math.abs(seed)) % M : 0) || 1;
}

/** Uniform numbers in (0, 1) from a seed. */
export function parkMiller(seed: number): () => number {
  let s = seedState(seed);
  return () => (s = (s * 16807) % M) / M;
}
