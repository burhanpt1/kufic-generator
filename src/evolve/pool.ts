// A pool of evaluation workers that streams results as they finish (COMPOSITION_ENGINE.md §7). Without workers
// (tests, old browsers) it evaluates in-thread, yielding between candidates so the page stays responsive.
import type { Composition } from '../model/schema';
import { costOf, evaluate } from './breed';
import type { Evaluated } from './breed';

export type Outcome = { ok: true; result: Evaluated } | { ok: false; error: string };
type Job = { id: number; comp: Composition; prefix?: string; done: (o: Outcome) => void };
type Timer = ReturnType<typeof setTimeout>;
/** What a worker is doing: its job, the timer that fails a job running too long, and, once the job's run has been
 *  superseded, the timer that frees the worker. */
type Busy = { job: Job; timeout: Timer; grace?: Timer };
export interface PoolOptions {
  /** A job running longer than this fails, and its worker is replaced (default 90 s). */
  jobTimeoutMs?: number;
  /** How long a job of a superseded run may keep its worker before the worker is replaced (default 1.5 s). */
  staleGraceMs?: number;
}

export class EvalPool {
  private workers: Worker[] = [];
  private idle: Worker[] = [];
  private queue: Job[] = [];
  private busy = new Map<Worker, Busy>();
  private nextId = 1;
  private generation = 0;
  private make: (() => Worker) | null = null;
  /** Resolves the current run's promise (a newer run, cancel and terminate call it for the run they end). */
  private settle: (() => void) | null = null;
  private jobTimeout: number;
  private staleGrace: number;

  /** size 0 = evaluate in-thread. factory makes a worker (default: the bundled evaluation worker). */
  constructor(size?: number, factory?: () => Worker, o: PoolOptions = {}) {
    this.jobTimeout = o.jobTimeoutMs ?? 90_000;
    this.staleGrace = o.staleGraceMs ?? 1500;
    const n =
      size ??
      (typeof navigator !== 'undefined' ? Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 2) - 1)) : 0);
    if (n > 0 && (factory || typeof Worker !== 'undefined')) {
      this.make = factory ?? (() => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' }));
      for (let i = 0; i < n; i++) this.spawn();
    }
  }
  get threaded() {
    return this.workers.length > 0;
  }

  /** Evaluate compositions, calling onResult(index, outcome) as each finishes. Resolves when all are done or the
   *  run is cancelled (a newer run() cancels older ones, whose promises resolve then, short of some results). */
  run(comps: Composition[], onResult: (i: number, o: Outcome) => void, prefix = 'c'): Promise<void> {
    this.cancel();
    const gen = this.generation;
    let left = comps.length;
    return new Promise(res => {
      if (!left) return res();
      this.settle = res;
      comps.forEach((comp, i) => {
        const job: Job = {
          id: this.nextId++,
          comp,
          prefix: `${prefix}${gen}-${i}`,
          done: o => {
            if (gen !== this.generation) return;
            onResult(i, o);
            if (--left === 0) {
              this.settle = null;
              res();
            }
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
      else this.inThread(gen);
    });
  }
  /** End the current run: its queue is dropped and its promise resolves. Jobs already on a worker get a short grace
   *  to finish (their results are ignored); a worker still on the same job after that is replaced. */
  cancel() {
    this.generation++;
    this.queue = [];
    this.settle?.();
    this.settle = null;
    for (const [w, b] of this.busy)
      b.grace ??= setTimeout(() => this.busy.get(w) === b && this.replace(w, 'cancelled'), this.staleGrace);
  }
  terminate() {
    this.cancel();
    for (const b of this.busy.values()) {
      clearTimeout(b.timeout);
      clearTimeout(b.grace);
    }
    this.busy.clear();
    this.workers.forEach(w => w.terminate());
    this.workers = [];
    this.idle = [];
    this.make = null;
  }

  private spawn() {
    const w = this.make!();
    w.onmessage = (e: MessageEvent<{ id: number } & Outcome>) => this.finish(w, e.data);
    w.onerror = () => this.fail(w);
    this.workers.push(w);
    this.idle.push(w);
  }
  /** Stop a worker and start a fresh one in its place; the job it held fails. */
  private replace(w: Worker, error: string) {
    const b = this.release(w);
    w.onmessage = w.onerror = null;
    w.terminate();
    this.workers = this.workers.filter(x => x !== w);
    this.idle = this.idle.filter(x => x !== w);
    if (this.make) this.spawn();
    b?.job.done({ ok: false, error });
    this.pump();
  }
  /** Take a worker's job off it, with its timers. */
  private release(w: Worker) {
    const b = this.busy.get(w);
    if (b) {
      clearTimeout(b.timeout);
      clearTimeout(b.grace);
      this.busy.delete(w);
    }
    return b;
  }
  private pump() {
    while (this.idle.length && this.queue.length) {
      const w = this.idle.pop()!,
        job = this.queue.shift()!;
      this.busy.set(w, { job, timeout: setTimeout(() => this.replace(w, 'timed out'), this.jobTimeout) });
      w.postMessage({ id: job.id, comp: job.comp, prefix: job.prefix });
    }
  }
  private finish(w: Worker, msg: { id: number } & Outcome) {
    if (this.busy.get(w)?.job.id !== msg.id) return; // not the job this worker holds: nothing to settle
    const { job } = this.release(w)!;
    this.idle.push(w);
    job.done(msg.ok ? { ok: true, result: msg.result } : { ok: false, error: msg.error });
    this.pump();
  }
  /** A worker reported an error: the job it holds, if any, fails. An idle worker stays idle, once. */
  private fail(w: Worker) {
    const b = this.busy.get(w);
    if (b) this.finish(w, { id: b.job.id, ok: false, error: 'worker error' });
  }
  private inThread(gen: number) {
    const step = () => {
      if (gen !== this.generation) return;
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
