// Building a roundel on several cores (buildRoundelAsync): its groups' variants, one job each; the composer's tries,
// one job each, with the variants handed to each worker once rather than built again in every one; and the finishing
// of its best arrangements, one job each. The tries are merged in order of their number and sorted as the composer
// sorts them, so the roundel is the one buildRoundel draws in a single thread. Without workers the jobs run here.
import type { Thuluth } from '../engine';
import { thuluth } from '../engine';
import type { RGroup, StackOptions, GroupShape } from './shapes';
import { groupVariants, primeVariants, variantsKey } from './shapes';
import type { ThuluthStyle } from '../types';
import type { Roundel, RoundelOptions } from './compose';
import { composeRoundel, roundelGroups } from './compose';
import type { BuiltRoundel, RoundelSpec } from './index';
import { buildRoundelAsync, finishOne } from './index';

type Prime = { key: string; vs: GroupShape[] }[];
export type RoundelJob = { style: ThuluthStyle; prime?: Prime } & (
  | { kind: 'variants'; g: RGroup; vopts: StackOptions; K: number }
  | { kind: 'compose'; text: string; opts?: RoundelOptions; tries?: number[] }
  | { kind: 'finish'; spec: RoundelSpec; r: Roundel }
);
export type RoundelJobResult =
  { ok: true; rs?: Roundel[]; built?: BuiltRoundel; vs?: GroupShape[] } | { ok: false; error: string };

/** A job's work, wherever it runs (a worker, or here without one). Pens are made once per style. */
const pens = new Map<string, Thuluth>();
export function runRoundelJob(job: RoundelJob): RoundelJobResult {
  try {
    const key = JSON.stringify(job.style);
    let th = pens.get(key);
    if (!th) pens.set(key, (th = thuluth(job.style)));
    job.prime?.forEach(p => primeVariants(p.key, p.vs));
    return job.kind === 'variants'
      ? { ok: true, vs: groupVariants(th, job.g, job.vopts, job.K) }
      : job.kind === 'compose'
        ? { ok: true, rs: composeRoundel(th, job.text, job.opts, job.tries) }
        : { ok: true, built: finishOne(th, job.spec, job.r) };
  } catch (e) {
    return { ok: false, error: String((e as Error)?.message ?? e) };
  }
}

type Pending = { job: RoundelJob; needs?: string[]; done: (r: RoundelJobResult) => void };

export class RoundelWorkers {
  private workers: Worker[] = [];
  private idle: Worker[] = [];
  private queue: Pending[] = [];
  private busy = new Map<Worker, Pending>();
  // variants built so far (by variantsKey), and which of them each worker holds
  private variants = new Map<string, GroupShape[]>();
  private holds = new Map<Worker, Set<string>>();

  /** size: how many workers (default: one per core but one, at least two); factory makes one (default: the bundled
   *  roundel worker). Size 0, or no Worker here, runs the jobs in this thread. */
  constructor(size?: number, factory?: () => Worker) {
    const n =
      size ??
      (typeof navigator !== 'undefined' ? Math.max(2, Math.min(8, (navigator.hardwareConcurrency || 2) - 1)) : 0);
    if (n > 0 && (factory || typeof Worker !== 'undefined')) {
      const make = factory ?? (() => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' }));
      for (let i = 0; i < n; i++) {
        const w = make();
        w.onmessage = (e: MessageEvent<RoundelJobResult>) => this.settle(w, e.data);
        w.onerror = e => this.settle(w, { ok: false, error: String(e.message || 'worker failed') });
        this.workers.push(w);
        this.idle.push(w);
        this.holds.set(w, new Set());
      }
    }
  }
  get size() {
    return this.workers.length;
  }
  terminate() {
    this.workers.forEach(w => w.terminate());
    this.workers = this.idle = [];
    this.queue.forEach(p => p.done({ ok: false, error: 'terminated' }));
    this.queue = [];
  }

  private run(job: RoundelJob, needs?: string[]): Promise<RoundelJobResult> {
    if (!this.workers.length) return Promise.resolve(runRoundelJob(job));
    return new Promise(done => {
      this.queue.push({ job, needs, done });
      this.pump();
    });
  }
  private pump() {
    while (this.idle.length && this.queue.length) {
      const w = this.idle.pop()!,
        p = this.queue.shift()!,
        held = this.holds.get(w)!,
        // the variants this job needs that this worker does not hold yet go with it
        missing = (p.needs ?? []).filter(k => !held.has(k) && this.variants.has(k));
      missing.forEach(k => held.add(k));
      this.busy.set(w, p);
      w.postMessage(missing.length ? { ...p.job, prime: missing.map(key => ({ key, vs: this.variants.get(key)! })) } : p.job); // prettier-ignore
    }
  }
  private settle(w: Worker, r: RoundelJobResult) {
    const p = this.busy.get(w);
    this.busy.delete(w);
    this.idle.push(w);
    // a worker that built a group's variants holds them
    if (p?.job.kind === 'variants' && r.ok) {
      const key = variantsKey(p.job.style, p.job.g, p.job.vopts, p.job.K);
      this.holds.get(w)!.add(key);
      if (this.variants.size > 2000) this.variants.clear();
      this.variants.set(key, r.vs!);
    }
    p?.done(r);
    this.pump();
  }
  private async must(job: RoundelJob, needs?: string[]) {
    const r = await this.run(job, needs);
    if (!r.ok) throw new Error(r.error);
    return r;
  }

  /** The composer's tries, one job each, merged as composeRoundel would return them (best first, ties in order). The
   *  groups' variants are built first, one job each, and each worker is given those it lacks. */
  async compose(style: ThuluthStyle, text: string, opts?: RoundelOptions): Promise<Roundel[]> {
    const tries = opts?.fixed ? 1 : (opts?.tries ?? 18);
    if (tries <= 1 || this.workers.length <= 1) return (await this.must({ kind: 'compose', style, text, opts })).rs!;
    const prep = roundelGroups(text, opts);
    if (!prep) return [];
    const K = opts?.K ?? 1.6,
      byKey = new Map(prep.groups.map(g => [variantsKey(style, g, prep.vopts, K), g]));
    await Promise.all(
      [...byKey]
        .filter(([key]) => !this.variants.has(key))
        .map(([, g]) => this.must({ kind: 'variants', style, g, vopts: prep.vopts, K })),
    );
    const needs = [...byKey.keys()],
      parts = await Promise.all(
        Array.from({ length: tries }, (_, t) => this.must({ kind: 'compose', style, text, opts, tries: [t] }, needs)),
      );
    // in order of their number, then sorted (a stable sort) as the composer sorts them
    return parts.flatMap(p => p.rs!).sort((a, b) => a.E - b.E);
  }
  /** Finish each arrangement, one job each. */
  async finish(style: ThuluthStyle, spec: RoundelSpec, rs: Roundel[]): Promise<BuiltRoundel[]> {
    return Promise.all(rs.map(async r => (await this.must({ kind: 'finish', style, spec, r })).built!));
  }

  /** buildRoundel, on these workers. */
  build(th: Thuluth, spec: RoundelSpec): Promise<BuiltRoundel | null> {
    return buildRoundelAsync(th, spec, {
      compose: (text, opts) => this.compose(th.style, text, opts),
      finish: (s, rs) => this.finish(th.style, s, rs),
    });
  }
}
