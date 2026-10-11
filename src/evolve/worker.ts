// Evaluation worker: resolves, renders and judges compositions off the main thread.
import { loadSealWasmSync } from '../kernels/seal';
import { preset } from '../model/presets';
import type { Composition } from '../model/schema';
import { evaluate } from './breed';

loadSealWasmSync(); // workers may compile synchronously
// warm the JIT before the first real job (pools are made ahead of use, so this runs while nobody is waiting)
try {
  evaluate(preset('hexagon-lapis'), 'warm');
} catch {
  /* warming is best effort */
}
const scope = self as unknown as { onmessage: (e: MessageEvent) => void; postMessage: (m: unknown) => void };
scope.onmessage = (e: MessageEvent<{ id: number; comp: Composition; prefix?: string }>) => {
  const { id, comp, prefix } = e.data;
  try {
    scope.postMessage({ id, ok: true, result: evaluate(comp, prefix) });
  } catch (err) {
    scope.postMessage({ id, ok: false, error: String((err as Error)?.message ?? err) });
  }
};
