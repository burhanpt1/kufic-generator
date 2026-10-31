// The native kernels: the seal search, the partition solver, the rasteriser, the roundel composer's inner loops and
// the ratings fit in C, and Clipper2's C++, all compiled to WebAssembly. Each has a TypeScript fallback (the same
// results bit for bit; Clipper2's port to within rounding); `loadKernels()` once at start makes the seal and Clipper2
// ones take over (the others load themselves on first use).
import { loadClipper2 } from './clipper2';
import { loadSealWasm } from './seal';

export async function loadKernels(): Promise<void> {
  await Promise.all([loadSealWasm(), loadClipper2()]);
}
