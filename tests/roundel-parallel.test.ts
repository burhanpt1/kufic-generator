// A roundel built on several workers is the roundel built in one thread: the composer's tries run apart and merged by
// number, the best arrangements finished apart. Here the workers are stand-ins that copy every message both ways, as
// postMessage does, and answer in their own time, so tries finish out of order.
import { afterAll, describe, expect, it } from 'vitest';
import { resolve, resolveAsync } from '../src/compose';
import { forgetRoundels } from '../src/compose/roundel';
import { preset } from '../src/model/presets';
import { renderPlaced } from '../src/render/composition';
import { ROUNDEL_PEN, thuluth } from '../src/script/thuluth';
import { buildRoundel, composeRoundel } from '../src/script/thuluth/roundel';
import type { RoundelSpec } from '../src/script/thuluth/roundel';
import type { RoundelJob } from '../src/script/thuluth/roundel/parallel';
import { RoundelWorkers, runRoundelJob } from '../src/script/thuluth/roundel/parallel';

let delay = 0;
const standIn = () => {
  const w = {
    onmessage: null as ((e: MessageEvent) => void) | null,
    onerror: null,
    postMessage(m: RoundelJob) {
      const job = structuredClone(m);
      // each answer takes its own while, so they come back out of order
      setTimeout(() => w.onmessage!({ data: structuredClone(runRoundelJob(job)) } as MessageEvent), (delay++ % 5) * 3);
    },
    terminate() {},
  };
  return w as unknown as Worker;
};
const pool = new RoundelWorkers(4, standIn);
afterAll(() => pool.terminate());

const NAMES = 'بُرْهَان وَشَمِيرَة',
  th = thuluth({ ...ROUNDEL_PEN, great: { ya: true, yaWide: 2.6, yaDeep: 1.3 } }),
  base: RoundelSpec = {
    text: NAMES,
    compose: { elongate: true, cross: true, fillTarget: 0.5, noRise: true, cradle: true, oval: 1.45, kern: true, tries: 5, iters: 1500 }, // prettier-ignore
    tweaks: [{ at: 'و', scale: 0.62 }],
    bowl: { clear: 5.6, autoOval: true },
    frame: { markReach: 2.2 },
  };
// everything a drawing is made from
const digest = (b: ReturnType<typeof buildRoundel>) =>
  b && JSON.stringify([b.r.st, b.r.lv, b.r.wp, b.r.up, b.r.E, b.r.disc, b.r.bowlGrow, b.r.shapes.map(S => S.b.strokes), b.f]); // prettier-ignore

describe('a roundel on several workers', () => {
  it('merges the tries as the composer orders them', async () => {
    const o = { ...base.compose!, tries: 7, iters: 400 };
    expect(JSON.stringify(await pool.compose(th.style, NAMES, o))).toBe(JSON.stringify(composeRoundel(th, NAMES, o)));
  });
  for (const [name, spec] of [
    ['a great bowl, its best six judged', base],
    [
      'drawn-out tails, stacking',
      { ...base, compose: { ...base.compose, nest: true, stack: true }, tails: { reach: 8 } },
    ],
    ['no frame, judged by three', { ...base, bowl: false, frame: false, judge: 3 }],
    ['three seeds to choose from', { ...base, choose: 3, compose: { ...base.compose, tries: 3 } }],
  ] as [string, RoundelSpec][])
    it(`is the one-thread roundel: ${name}`, async () => {
      expect(digest(await pool.build(th, spec))).toBe(digest(buildRoundel(th, spec)));
    }, 120_000);
});

describe('a composition with its roundels drawn on workers', () => {
  for (const id of ['names-cartouche', 'ahl-al-bayt'])
    it(`resolves as in one thread: ${id}`, async () => {
      const c = preset(id);
      forgetRoundels();
      const parallel = renderPlaced(await resolveAsync(c, pool), { idPrefix: 'p' });
      forgetRoundels();
      expect(parallel).toBe(renderPlaced(resolve(c), { idPrefix: 'p' }));
    }, 120_000);
});
