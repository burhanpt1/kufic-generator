// The native kernels: the seal search and the partition solver in C, and Clipper2's C++, all compiled to
// WebAssembly. Each has a TypeScript fallback; `loadKernels()` once at start makes the WebAssembly ones take over
// (the partition kernel loads itself on first use).
import { loadClipper2 } from './clipper2';
import { loadSealWasm } from './seal';

export async function loadKernels(): Promise<void> {
  await Promise.all([loadSealWasm(), loadClipper2()]);
}
