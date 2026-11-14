// The studio's background worker (background.ts): does one job at a time, except that while a preview waits for its
// roundels (drawn on workers of its own) a newer job may come in.
import type { Job, Result } from './compute';
import { compute } from './compute';

const scope = self as unknown as {
  onmessage: (e: MessageEvent<{ id: number; job: Job }>) => void;
  postMessage: (m: unknown, transfer?: Transferable[]) => void;
};
scope.onmessage = async e => {
  const { id, job } = e.data;
  try {
    const result: Result = await compute(job, waiting => scope.postMessage({ id, waiting }));
    // a solid goes back without a copy
    const stl = result && typeof result === 'object' && 'stl' in result ? [result.stl.buffer as ArrayBuffer] : [];
    scope.postMessage({ id, ok: true, result }, stl);
  } catch (err) {
    scope.postMessage({ id, ok: false, error: String((err as Error)?.message ?? err) });
  }
};
