// The composition engine: resolve a composition tree into placed, renderer-agnostic parts. Pure: no DOM.
import './fills';
import './flow';
export { resolve } from './resolve';
export type { ResolveOptions } from './resolve';
export * from './placed';
export { placeMap } from './textBorder';
