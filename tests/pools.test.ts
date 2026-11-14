// The worker pools' housekeeping, with stand-in workers: a superseded run ends, a job that hangs gives its worker
// back, and a worker is never handed two jobs.
import { describe, expect, it } from 'vitest';
import type { Evaluated } from '../src/evolve/breed';
import { EvalPool } from '../src/evolve/pool';
import type { Outcome } from '../src/evolve/pool';
import { PRESETS } from '../src/model/presets';
import { ROUNDEL_PEN } from '../src/script/thuluth';
import type { RoundelJob } from '../src/script/thuluth/roundel/parallel';
import { RoundelWorkers, runRoundelJob } from '../src/script/thuluth/roundel/parallel';

const comps = PRESETS.slice(0, 4).map(p => p.comp),
  sleep = (ms: number) => new Promise(r => setTimeout(r, ms)),
  within = <T>(p: Promise<T>, ms = 2000) =>
    Promise.race([p, sleep(ms).then(() => Promise.reject(new Error('still waiting')))]);

/** Stand-in workers. `answers(n)` says whether the n-th worker made answers its jobs (a little later) or hangs. */
function standIns<M>(answers: (n: number) => boolean, reply: (m: M) => unknown) {
  const made: { w: Worker; busy: boolean; dead: boolean; posted: number }[] = [];
  let overlaps = 0;
  const factory = () => {
    const n = made.length,
      s = { w: null as unknown as Worker, busy: false, dead: false, posted: 0 },
      w = {
        onmessage: null as ((e: MessageEvent) => void) | null,
        onerror: null as ((e: ErrorEvent) => void) | null,
        postMessage(m: M) {
          if (s.busy) overlaps++;
          s.busy = true;
          s.posted++;
          const job = structuredClone(m);
          if (answers(n))
            setTimeout(() => {
              s.busy = false;
              if (!s.dead) w.onmessage?.({ data: reply(job) } as MessageEvent);
            }, 2);
        },
        terminate() {
          s.dead = true;
        },
      };
    s.w = w as unknown as Worker;
    made.push(s);
    return s.w;
  };
  return { factory, made, overlaps: () => overlaps };
}
const evalReply = (m: { id: number }) => ({ id: m.id, ok: true, result: { svg: '', ms: 0 } as unknown as Evaluated });

describe('evaluation pool on workers', () => {
  it('resolves a run that a newer run supersedes', async () => {
    const s = standIns(() => false, evalReply),
      pool = new EvalPool(2, s.factory),
      first: number[] = [],
      a = pool.run(comps, i => first.push(i));
    void pool.run([comps[0]], () => {});
    await within(a);
    expect(first).toEqual([]);
    pool.cancel();
    pool.terminate();
  });
  it('resolves a cancelled run', async () => {
    const s = standIns(() => false, evalReply),
      pool = new EvalPool(1, s.factory),
      a = pool.run(comps, () => {});
    pool.cancel();
    await within(a);
    pool.terminate();
  });
  it('fails a job that hangs, and replaces its worker', async () => {
    // the first worker hangs; the ones that replace it answer
    const s = standIns(n => n > 0, evalReply),
      pool = new EvalPool(1, s.factory, { jobTimeoutMs: 30 }),
      got: [number, Outcome][] = [];
    await within(pool.run(comps.slice(0, 3), (i, o) => got.push([i, o])));
    expect(got.length).toBe(3);
    expect(got.filter(([, o]) => !o.ok).map(([, o]) => (o as { error: string }).error)).toEqual(['timed out']);
    expect(s.made[0].dead).toBe(true);
    expect(s.made.length).toBe(2);
    pool.terminate();
  });
  it('frees a worker held by a superseded job after a short grace', async () => {
    const s = standIns(n => n > 0, evalReply),
      pool = new EvalPool(1, s.factory, { staleGraceMs: 30 }),
      a = pool.run([comps[0]], () => {}),
      got: number[] = [];
    await within(pool.run([comps[1], comps[2]], i => got.push(i)));
    await within(a);
    expect(got.sort()).toEqual([0, 1]);
    expect(s.made[0].dead).toBe(true);
    pool.terminate();
  });
  it('leaves a quick superseded job its worker', async () => {
    const s = standIns(() => true, evalReply),
      pool = new EvalPool(1, s.factory, { staleGraceMs: 200 });
    void pool.run([comps[0]], () => {});
    await within(pool.run([comps[1]], () => {}));
    await sleep(250);
    expect(s.made.length).toBe(1);
    expect(s.made[0].dead).toBe(false);
    pool.terminate();
  });
  it('books a worker once, even one that reported an error while idle', async () => {
    const s = standIns(() => true, evalReply),
      pool = new EvalPool(1, s.factory);
    s.made[0].w.onerror!({} as ErrorEvent);
    s.made[0].w.onerror!({} as ErrorEvent);
    const got: number[] = [];
    await within(pool.run(comps, i => got.push(i)));
    expect(got.length).toBe(4);
    expect(s.overlaps()).toBe(0);
    pool.terminate();
  });
});

describe('roundel workers', () => {
  const text = 'بُرْهَان وَشَمِيرَة',
    opts = { tries: 3, iters: 200 },
    reply = (m: RoundelJob) => structuredClone(runRoundelJob(m));
  it('rejects running and waiting jobs when terminated', async () => {
    const s = standIns(() => false, reply),
      pool = new RoundelWorkers(2, s.factory),
      a = pool.compose(ROUNDEL_PEN, text, opts);
    pool.terminate();
    await expect(within(a)).rejects.toThrow('terminated');
  });
  it('rejects what was asked before a cancel, and frees the workers after a grace', async () => {
    const s = standIns(n => n >= 2, reply),
      pool = new RoundelWorkers(2, s.factory, { staleGraceMs: 30 }),
      a = pool.compose(ROUNDEL_PEN, text, opts);
    pool.cancel();
    await expect(within(a)).rejects.toThrow('cancelled');
    // the same roundel asked again is drawn by the workers that replace the two that hung
    const again = await within(pool.compose(ROUNDEL_PEN, text, opts), 60_000);
    expect(JSON.stringify(again)).toBe(JSON.stringify(await new RoundelWorkers(0).compose(ROUNDEL_PEN, text, opts)));
    expect(s.made.slice(0, 2).every(x => x.dead)).toBe(true);
    expect(s.overlaps()).toBe(0);
    pool.terminate();
  }, 120_000);
  it('fails a job that hangs', async () => {
    const s = standIns(() => false, reply),
      pool = new RoundelWorkers(2, s.factory, { jobTimeoutMs: 30 });
    await expect(within(pool.compose(ROUNDEL_PEN, text, opts))).rejects.toThrow('timed out');
    expect(s.made.length).toBeGreaterThan(2);
    pool.terminate();
  });
  it('books a worker once, even one that reported an error while idle', async () => {
    const s = standIns(() => true, reply),
      pool = new RoundelWorkers(2, s.factory),
      one = await new RoundelWorkers(0).compose(ROUNDEL_PEN, text, opts);
    s.made[0].w.onerror!({ message: 'x' } as ErrorEvent);
    expect(JSON.stringify(await pool.compose(ROUNDEL_PEN, text, opts))).toBe(JSON.stringify(one));
    expect(s.overlaps()).toBe(0);
    pool.terminate();
  }, 120_000);
});
