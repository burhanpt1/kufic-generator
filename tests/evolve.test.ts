import { describe, expect, it } from 'vitest';
import { resolve } from '../src/compose';
import {
  EvalPool,
  Rng,
  TRAITS,
  breedFrom,
  crossover,
  evaluate,
  freshGeneration,
  learn,
  metrics,
  mutate,
  newTaste,
  randomComposition,
  score,
  traitsOf,
} from '../src/evolve';
import { PRESETS, TEXTS } from '../src/model/presets';
import { isValidComposition, parseComposition } from '../src/model/schema';
import type { Composition } from '../src/model/schema';

const texts: Composition['texts'] = { main: { text: TEXTS.basmala, repeat: 'fill', wordGap: 2 } };

describe('random compositions and mutation', () => {
  it('always yields valid compositions', () => {
    const rng = new Rng(1);
    let c = randomComposition(texts, { rng });
    for (let i = 0; i < 300; i++) {
      c = i % 25 === 0 ? randomComposition(texts, { rng }) : mutate(c, 0.5, { rng });
      expect(isValidComposition(c), JSON.stringify(c).slice(0, 200)).toBe(true);
    }
  });
  it('mutates presets into valid compositions', () => {
    const rng = new Rng(2);
    for (const p of PRESETS)
      for (let i = 0; i < 20; i++) expect(isValidComposition(mutate(p.comp, 0.6, { rng }))).toBe(true);
  });
  it('produces compositions that resolve', () => {
    const rng = new Rng(3);
    for (let i = 0; i < 12; i++) {
      const c = randomComposition(texts, { rng });
      const p = resolve(c);
      expect(p.items.length).toBeGreaterThan(0);
    }
  });
  it('steps ordinal traits to a neighbouring value', () => {
    const rng = new Rng(4),
      base = randomComposition(texts, { rng });
    base.style.letter.ascenders = 9;
    const seen = new Set<number>();
    for (let i = 0; i < 60; i++) seen.add(mutate(base, 1, { rng }).style.letter.ascenders);
    expect([...seen].every(v => [7, 9, 11].includes(v))).toBe(true);
  });
  it('keeps locked traits in every child', () => {
    const rng = new Rng(5),
      locks = { outline: 'heart', palette: 4, stroke: 'pen' } as const;
    for (let i = 0; i < 30; i++) {
      const t = traitsOf(mutate(randomComposition(texts, { rng, locks }), 0.9, { rng, locks }));
      expect([t.outline, t.palette, t.stroke]).toEqual(['heart', 4, 'pen']);
    }
  });
  it('covers every trait value', () => {
    const rng = new Rng(6),
      seen: Record<string, Set<string>> = {};
    for (let i = 0; i < 400; i++)
      for (const [k, v] of Object.entries(traitsOf(randomComposition(texts, { rng }))))
        (seen[k] ??= new Set()).add(String(v));
    for (const k of ['outline', 'fill', 'separator', 'stroke', 'palette', 'spandrels'] as const)
      for (const v of TRAITS[k].values) expect(seen[k].has(String(v)), `${k}=${v}`).toBe(true);
  });
});

describe('crossover', () => {
  it('preserves schema validity and mixes both parents', () => {
    const rng = new Rng(7);
    let fromB = 0;
    for (let i = 0; i < 100; i++) {
      const a = PRESETS[i % PRESETS.length].comp,
        b = PRESETS[(i * 3 + 1) % PRESETS.length].comp,
        c = crossover(a, b, { rng });
      expect(parseComposition(c)).toBeTruthy();
      if (
        JSON.stringify(c.root.child.borders) === JSON.stringify(b.root.child.borders) &&
        JSON.stringify(a.root.child.borders) !== JSON.stringify(b.root.child.borders)
      )
        fromB++;
    }
    expect(fromB).toBeGreaterThan(20);
  });
});

describe('critic and taste', () => {
  const placed = PRESETS.map(p => resolve(p.comp));
  it('scores every metric in [0, 1]', () => {
    for (const p of placed) {
      const m = metrics(p)!;
      expect(Object.keys(m).length).toBeGreaterThan(0);
      for (const v of Object.values(m)) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });
  it('lets each node type contribute its own metrics', () => {
    const fatimid = metrics(placed[0])!,
      octagon = metrics(placed[2])!;
    expect(fatimid).toHaveProperty('legibility'); // the monogram centre
    expect(fatimid).toHaveProperty('rhythm'); // the text borders
    expect(octagon).not.toHaveProperty('sharing');
  });
  it('learns from picks: weights move toward what the picks do well, and their traits become likelier', () => {
    const t0 = newTaste(),
      ms = placed.map(metrics);
    const best = ms.reduce((b, m, i) => ((m!.rhythm ?? 0) > (ms[b]!.rhythm ?? 0) ? i : b), 0);
    const t1 = learn(t0, [{ comp: PRESETS[best].comp, m: ms[best] }], ms);
    expect(t1.picks).toBe(1);
    expect(t1.pref.outline[String(traitsOf(PRESETS[best].comp).outline)]).toBe(1);
    const sum = Object.values(t1.w).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 9);
    expect(score(ms[best], t1)).toBeGreaterThanOrEqual(score(ms[best], t0) - 1e-9);
  });
});

describe('a seeded run', () => {
  const run = () => {
    const rng = new Rng(4242),
      taste = newTaste();
    const gen1 = freshGeneration(5, texts, { rng, taste });
    const ev1 = gen1.map(c => evaluate(c));
    const order = ev1.map((_, i) => i).sort((a, b) => score(ev1[b].metrics, taste) - score(ev1[a].metrics, taste));
    const gen2 = breedFrom([gen1[order[0]], gen1[order[1]]], 5, 0.25, { rng, taste });
    return JSON.stringify({
      gen1,
      gen2,
      scores: ev1.map(e => score(e.metrics, taste)),
      svg: evaluate(gen2[3]).svg.length,
    });
  };
  it('is reproducible', () => {
    expect(run()).toBe(run());
  });
});

describe('evaluation pool', () => {
  it('streams a result for every candidate (in-thread without workers)', async () => {
    const pool = new EvalPool(0);
    expect(pool.threaded).toBe(false);
    const comps = PRESETS.slice(0, 4).map(p => p.comp),
      got: number[] = [];
    await pool.run(comps, (i, o) => {
      expect(o.ok).toBe(true);
      got.push(i);
    });
    expect(got.sort()).toEqual([0, 1, 2, 3]);
  });
  it('cancels an older run when a new one starts', async () => {
    const pool = new EvalPool(0),
      first: number[] = [];
    const a = pool.run(
      PRESETS.map(p => p.comp),
      i => first.push(i),
    );
    await pool.run([PRESETS[4].comp], () => {});
    await a;
    expect(first.length).toBeLessThan(PRESETS.length);
  });
  it('falls back to in-thread evaluation when its workers are refused or fail to start', async () => {
    // a worker blocked by the page's security policy: it accepts messages but only ever reports an error
    class DeadWorker {
      onmessage: ((e: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;
      postMessage() {}
      terminate() {}
      constructor() {
        setTimeout(() => this.onerror?.(), 0);
      }
    }
    const g = globalThis as { Worker?: unknown },
      had = 'Worker' in g,
      old = g.Worker;
    g.Worker = DeadWorker;
    try {
      const comps = PRESETS.slice(0, 3).map(p => p.comp);
      for (const factory of [
        () => new DeadWorker() as unknown as Worker,
        () => {
          throw new Error('refused');
        },
      ]) {
        const pool = new EvalPool(2, factory),
          got: number[] = [];
        await pool.run(comps, (i, o) => {
          expect(o.ok).toBe(true);
          got.push(i);
        });
        expect(got.sort()).toEqual([0, 1, 2]);
        expect(pool.threaded).toBe(false);
      }
    } finally {
      if (had) g.Worker = old;
      else delete g.Worker;
    }
  });
});

describe('scheduling and speed helpers', () => {
  it('estimates seal monograms and mazes as the slow ones', async () => {
    const { costOf } = await import('../src/evolve/breed');
    const { preset } = await import('../src/model/presets');
    expect(costOf(preset('basmala-seal'))).toBeGreaterThan(costOf(preset('octagon-panel')));
    expect(costOf(preset('kufic-maze-tile'))).toBeGreaterThan(costOf(preset('shahada-block')));
  });
  it('bucketed crossings equal a scan of every edge', async () => {
    const { crossingsOf } = await import('../src/compose/fills');
    const { unitRing } = await import('../src/geometry/outlines');
    const naive = (P: [number, number][], y: number) => {
      const xs: number[] = [];
      for (let i = 0, j = P.length - 1; i < P.length; j = i++)
        if (P[j][1] > y !== P[i][1] > y) xs.push(P[j][0] + ((y - P[j][1]) * (P[i][0] - P[j][0])) / (P[i][1] - P[j][1]));
      xs.sort((a, b) => a - b);
      const iv: [number, number][] = [];
      for (let k = 0; k + 1 < xs.length; k += 2) iv.push([xs[k], xs[k + 1]]);
      return iv;
    };
    for (const o of [
      { kind: 'preset', name: 'heart' },
      { kind: 'star', points: 12, depth: 0.6 },
      { kind: 'polygon', sides: 4 },
    ] as const) {
      const P = unitRing(o).pts.map(([x, y]) => [x * 50, y * 50] as [number, number]),
        f = crossingsOf(P);
      for (let y = -60; y <= 60; y += 0.37) expect(f(y)).toEqual(naive(P, y));
      expect(f(P[0][1])).toEqual(naive(P, P[0][1])); // exactly on a vertex
    }
  });
});
