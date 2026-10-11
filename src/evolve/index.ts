// Evolution (COMPOSITION_ENGINE.md §7): genomes are composition trees.
export { Rng } from './rng';
export { TRAITS, traitsOf, PALETTE_LIST } from './genes';
export type { Trait, Traits } from './genes';
export { applyTrait, mutate, crossover, randomComposition, pickValue, relevantTraits } from './operators';
export type { OperatorOptions } from './operators';
export { metrics, analyseStrip, registerCritic } from './critic';
export type { Metrics, Critic } from './critic';
export { newTaste, learn, score, DEFAULT_WEIGHTS } from './taste';
export type { Taste } from './taste';
export { freshGeneration, breedFrom, evaluate } from './breed';
export type { Evaluated } from './breed';
export { EvalPool } from './pool';
export type { Outcome } from './pool';
