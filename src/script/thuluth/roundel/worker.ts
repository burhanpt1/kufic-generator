// A roundel worker (parallel.ts): runs one of a roundel's heavy steps (a group's variants, a composer's try, the
// finishing of an arrangement) with the same native kernels as the page, so its numbers are the page's.
import { loadKernels } from '../../../kernels';
import { ROUNDEL_PEN } from '../index';
import type { RoundelJob } from './parallel';
import { runRoundelJob } from './parallel';

const ready = loadKernels().then(() => {
  // warm the JIT on a small roundel before the first real job (pools are made ahead of use, so nobody waits)
  try {
    const r = runRoundelJob({ kind: 'compose', style: ROUNDEL_PEN, text: 'علي حسن', opts: { tries: 1, iters: 400 } });
    if (r.ok && r.rs?.[0]) runRoundelJob({ kind: 'finish', style: ROUNDEL_PEN, spec: { text: 'علي حسن' }, r: r.rs[0] });
  } catch {
    /* warming is best effort */
  }
});
const scope = self as unknown as {
  onmessage: (e: MessageEvent<RoundelJob>) => void;
  postMessage: (m: unknown) => void;
};
scope.onmessage = async e => {
  await ready;
  scope.postMessage(runRoundelJob(e.data));
};
