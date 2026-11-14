// The studio's background thread: one worker that composes the preview, makes the fabrication exports and meshes the
// 3D print (compute.ts), so the page stays free while they run. Without workers (tests, old browsers), or when the
// worker cannot start, the same work runs in this thread.
//
// Previews: only the newest matters. One that has not been sent yet is dropped for a newer one; one the worker is on
// is answered as superseded (null), never with its drawing. While the worker waits for a preview's roundels (drawn on
// workers of its own) it is free, so a newer preview is sent at once and the worker shares or cancels the wait.
import type { Composition } from '../model/schema';
import type { FabKind, Glyphs, Job, Preview, Result, Stl, StlRequest } from './compute';

type Timer = ReturnType<typeof setTimeout>;
type Flight = {
  id: number;
  job: Job;
  done: (r: Result) => void;
  fail: (e: Error) => void;
  /** A preview that a newer one superseded. */
  stale?: boolean;
  /** Waiting on other workers: the background thread is free meanwhile. */
  waiting?: boolean;
  timeout?: Timer;
};
type Answer = { id: number } & ({ waiting: boolean } | { ok: true; result: Result } | { ok: false; error: string });
export interface BackgroundOptions {
  /** A job computing for longer than this fails, and the worker is replaced (default two minutes). */
  jobTimeoutMs?: number;
  /** How long a superseded preview may keep the worker from a newer one before the worker is replaced (default 3 s). */
  staleGraceMs?: number;
}

export class Background {
  private worker: Worker | null = null;
  private make: (() => Worker) | null = null;
  private flights = new Map<number, Flight>();
  private latest = 0;
  private nextId = 1;
  private nextPreview: Flight | null = null;
  private queue: Flight[] = [];
  private grace: { id: number; timer: Timer } | null = null;
  private answered = false;
  private running = false;
  private jobTimeout: number;
  private staleGrace: number;

  /** factory makes the worker (default: the bundled one, where there are workers); null computes in this thread. */
  constructor(factory?: (() => Worker) | null, o: BackgroundOptions = {}) {
    this.jobTimeout = o.jobTimeoutMs ?? 120_000;
    this.staleGrace = o.staleGraceMs ?? 3000;
    if (factory === undefined && typeof Worker !== 'undefined')
      factory = () => new Worker(new URL('./compute.worker.ts', import.meta.url), { type: 'module' });
    if (factory) {
      this.make = factory;
      try {
        this.spawn();
      } catch {
        this.make = null; // workers are refused here: compute in this thread
      }
    }
  }
  get threaded() {
    return !!this.worker;
  }

  /** Resolve and render a composition with the user's letters. null when a newer preview superseded this one. */
  preview(comp: Composition, glyphs: Glyphs, label: string): Promise<Preview | null> {
    this.nextPreview?.done(null);
    for (const f of this.flights.values()) if (f.job.kind === 'preview') f.stale = true;
    return new Promise((done, fail) => {
      this.nextPreview = { id: 0, job: { kind: 'preview', comp, glyphs, label }, done: done as Flight['done'], fail };
      this.pump();
    });
  }
  /** A fabrication export of a composition: the plotter's or the laser's SVG, or the relief depth map. */
  fab(comp: Composition, glyphs: Glyphs, what: FabKind): Promise<string> {
    return this.ask({ kind: 'fab', comp, glyphs, what }) as Promise<string>;
  }
  /** Pixels to a printable solid, as binary STL. */
  stl(req: StlRequest): Promise<Stl> {
    return this.ask({ kind: 'stl', ...req }) as Promise<Stl>;
  }
  terminate() {
    this.make = null;
    this.stop(new Error('terminated'));
    this.nextPreview?.done(null);
    this.nextPreview = null;
    this.queue.splice(0).forEach(f => f.fail(new Error('terminated')));
  }

  private ask(job: Job): Promise<Result> {
    return new Promise((done, fail) => {
      this.queue.push({ id: 0, job, done, fail });
      this.pump();
    });
  }
  private spawn() {
    const w = this.make!();
    w.onmessage = (e: MessageEvent<Answer>) => this.hear(e.data);
    w.onerror = () => this.broke();
    this.worker = w;
  }
  /** The worker's thread is free: nothing is with it, or the job sent last is waiting on other workers. */
  private get free() {
    const f = this.flights.get(this.latest);
    return !f || !!f.waiting;
  }
  private pump() {
    if (!this.worker) return void this.inThread();
    if (this.nextPreview && this.free) {
      this.post(this.nextPreview);
      this.nextPreview = null;
    } else if (!this.nextPreview && !this.flights.size && this.queue.length) this.post(this.queue.shift()!);
    // a newer preview kept waiting by a superseded one that holds the thread: after a grace, a fresh worker
    const holder = this.flights.get(this.latest);
    if (this.nextPreview && holder?.stale && !holder.waiting && this.grace?.id !== holder.id) {
      this.endGrace();
      this.grace = {
        id: holder.id,
        timer: setTimeout(() => this.flights.has(holder.id) && this.replace('superseded'), this.staleGrace),
      };
    }
  }
  private post(f: Flight) {
    f.id = this.latest = this.nextId++;
    this.flights.set(f.id, f);
    this.arm(f);
    this.worker!.postMessage({ id: f.id, job: f.job });
  }
  private arm(f: Flight) {
    clearTimeout(f.timeout);
    f.timeout = setTimeout(() => this.replace('timed out'), this.jobTimeout);
  }
  private endGrace() {
    clearTimeout(this.grace?.timer);
    this.grace = null;
  }
  private hear(m: Answer) {
    this.answered = true;
    const f = this.flights.get(m.id);
    if (!f) return;
    if (this.grace?.id === f.id) this.endGrace();
    if ('waiting' in m) {
      // its own workers keep time while it waits
      f.waiting = m.waiting;
      if (m.waiting) clearTimeout(f.timeout);
      else this.arm(f);
    } else {
      clearTimeout(f.timeout);
      this.flights.delete(f.id);
      if (f.stale) f.done(null);
      else if (m.ok) f.done(m.result);
      else f.fail(new Error(m.error));
    }
    this.pump();
  }
  /** Stop the worker; what was with it ends: superseded previews as such, the rest with the error. */
  private stop(e: Error) {
    this.endGrace();
    if (this.worker) {
      this.worker.onmessage = this.worker.onerror = null;
      this.worker.terminate();
      this.worker = null;
    }
    const fs = [...this.flights.values()];
    this.flights.clear();
    for (const f of fs) {
      clearTimeout(f.timeout);
      if (f.stale) f.done(null);
      else f.fail(e);
    }
  }
  private replace(error: string) {
    this.stop(new Error(error));
    if (this.make) this.spawn();
    this.pump();
  }
  /** The worker reported an error. One that never answered could not start (no module workers, a blocked script):
   *  its jobs, and all later ones, are computed in this thread. */
  private broke() {
    if (this.answered) return this.replace('worker error');
    this.make = null;
    const fs = [...this.flights.values()];
    this.flights.clear();
    this.stop(new Error('worker error'));
    for (const f of fs) {
      clearTimeout(f.timeout);
      f.waiting = false;
      if (f.stale) f.done(null);
      else if (f.job.kind === 'preview') this.nextPreview ??= f;
      else this.queue.unshift(f);
    }
    this.pump();
  }
  private async inThread() {
    if (this.running) return;
    this.running = true;
    try {
      const { compute } = await import('./compute');
      for (;;) {
        const f = this.nextPreview ?? this.queue.shift();
        if (!f) break;
        if (f === this.nextPreview) this.nextPreview = null;
        this.flights.set((f.id = this.nextId++), f);
        await new Promise(r => setTimeout(r, 0)); // let the page show that it is busy
        try {
          const r = await compute(f.job);
          f.done(f.stale ? null : r);
        } catch (e) {
          if (f.stale) f.done(null);
          else f.fail(e instanceof Error ? e : new Error(String(e)));
        }
        this.flights.delete(f.id);
      }
    } finally {
      this.running = false;
    }
  }
}
