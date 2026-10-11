// A pool of evaluation workers that streams results as they finish (COMPOSITION_ENGINE.md §7). Without workers
// (tests, old browsers) it evaluates in-thread, yielding between candidates so the page stays responsive.
import type { Composition } from '../model/schema';
import { costOf, evaluate } from './breed';
import type { Evaluated } from './breed';

export type Outcome = { ok: true; result: Evaluated } | { ok: false; error: string };
type Job = { id: number; comp: Composition; prefix?: string; done: (o: Outcome) => void };

export class EvalPool {
  private workers: Worker[] = [];
  private idle: Worker[] = [];
  private queue: Job[] = [];
  private pending = new Map<number, Job>();
  private nextId = 1;
  private generation = 0;

  /** size 0 = evaluate in-thread. factory makes a worker (default: the bundled evaluation worker). */
  constructor(size?: number, factory?: () => Worker) {
    const n =
      size ??
      (typeof navigator !== 'undefined' ? Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 2) - 1)) : 0);
    if (n > 0 && typeof Worker !== 'undefined') {
      const make = factory ?? (() => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' }));
      for (let i = 0; i < n; i++) {
        const w = make();
        w.onmessage = (e: MessageEvent<{ id: number } & Outcome>) => this.finish(w, e.data);
        w.onerror = () => this.fail(w);
        this.workers.push(w);
        this.idle.push(w);
      }
    }
  }
  get threaded() {
    return this.workers.length > 0;
  }

  /** Evaluate compositions, calling onResult(index, outcome) as each finishes. Resolves when all are done or the
   *  run is cancelled (a newer run() cancels older ones). */
  run(comps: Composition[], onResult: (i: number, o: Outcome) => void, prefix = 'c'): Promise<void> {
    const gen = ++this.generation;
    this.queue = [];
    let left = comps.length;
    return new Promise(res => {
      if (!left) return res();
      comps.forEach((comp, i) => {
        const job: Job = {
          id: this.nextId++,
          comp,
          prefix: `${prefix}${gen}-${i}`,
          done: o => {
            if (gen !== this.generation) return;
            onResult(i, o);
            if (--left === 0) res();
          },
        };
        this.queue.push(job);
      });
      // longest first: a generation ends when its slowest candidate does, so start those early
      if (this.threaded) {
        const cost = new Map(this.queue.map(j => [j, costOf(j.comp)]));
        this.queue.sort((a, b) => cost.get(b)! - cost.get(a)! || a.id - b.id);
      }
      if (this.threaded) this.pump();
      else this.inThread(gen, () => res());
    });
  }
  cancel() {
    this.generation++;
    this.queue = [];
  }
  terminate() {
    this.cancel();
    this.workers.forEach(w => w.terminate());
    this.workers = this.idle = [];
  }

  private pump() {
    while (this.idle.length && this.queue.length) {
      const w = this.idle.pop()!,
        job = this.queue.shift()!;
      this.pending.set(job.id, job);
      (w as Worker & { job?: number }).job = job.id;
      w.postMessage({ id: job.id, comp: job.comp, prefix: job.prefix });
    }
  }
  private finish(w: Worker, msg: { id: number } & Outcome) {
    const job = this.pending.get(msg.id);
    this.pending.delete(msg.id);
    this.idle.push(w);
    job?.done(msg.ok ? { ok: true, result: msg.result } : { ok: false, error: msg.error });
    this.pump();
  }
  private fail(w: Worker) {
    const id = (w as Worker & { job?: number }).job;
    if (id != null) this.finish(w, { id, ok: false, error: 'worker error' });
  }
  private inThread(gen: number, stop: () => void) {
    const step = () => {
      if (gen !== this.generation) return stop();
      const job = this.queue.shift();
      if (!job) return;
      let o: Outcome;
      try {
        o = { ok: true, result: evaluate(job.comp, job.prefix) };
      } catch (err) {
        o = { ok: false, error: String((err as Error)?.message ?? err) };
      }
      job.done(o);
      setTimeout(step, 0);
    };
    step();
  }
}
