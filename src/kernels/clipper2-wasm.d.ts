// clipper2-wasm ships its types at dist/clipper2z.d.ts but its ES build at dist/es/: point the module at them.
declare module 'clipper2-wasm/dist/es/clipper2z.js' {
  import type { Clipper2ZFactoryFunction } from 'clipper2-wasm/dist/clipper2z';
  const factory: Clipper2ZFactoryFunction;
  export default factory;
}
