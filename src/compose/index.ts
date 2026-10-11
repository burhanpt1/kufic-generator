// The composition engine: resolve a composition tree into placed, renderer-agnostic parts. Pure: no DOM.
export { resolve } from './resolve';
export type { ResolveOptions } from './resolve';
export * from './placed';
export { placeMap } from './textBorder';
