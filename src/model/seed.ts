// Seeds for the Park–Miller generator used everywhere (COMPOSITION_ENGINE.md §1.3): state = state × 16807 mod
// 2147483647. A state of 0 (or any multiple of the modulus) gives a constant stream and a negative one gives negative
// "random" numbers, so every seed from outside (a link, a saved file, a mutated genome) is normalised here first.
// Seeds that were already usable (integers from 1 to 2147483646) pass through unchanged, so their output is too.

export const SEED_MODULUS = 2147483647;

/** Any number as a non-negative integer: the sign and fraction dropped, 0 for NaN and the infinities. */
export const seedInt = (seed: number): number => (Number.isFinite(seed) ? Math.floor(Math.abs(seed)) : 0);

/** A valid generator state (1 … 2147483646) for any seed. */
export const seedState = (seed: number): number => seedInt(seed) % SEED_MODULUS || 1;

/** A seeded stream of numbers in (0, 1). */
export function parkMiller(seed: number): () => number {
  let s = seedState(seed);
  return () => (s = (s * 16807) % SEED_MODULUS) / SEED_MODULUS;
}
