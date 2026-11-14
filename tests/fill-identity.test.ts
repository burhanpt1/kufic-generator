// The flow fill's and the line fill's output is pinned: their scale scans and the streamline tracer were made faster
// (flow.ts, fills.ts) and must place exactly the same strips at exactly the same points.
import { describe, expect, it } from 'vitest';
import { resolve } from '../src/compose';
import { flowLines } from '../src/compose/flow';
import { unitRing } from '../src/geometry/outlines';
import type { Outline } from '../src/geometry/outlines';
import type { Pt } from '../src/geometry/types';
import { TEXTS } from '../src/model/presets';
import type { Composition, FillerNode } from '../src/model/schema';
import { DEFAULT_STYLE } from '../src/model/style';
import { digest, FUZZ_OUT, pick, rng, words, writeDigests } from './helpers/identity';

const outline = (R: () => number): Outline =>
  pick<() => Outline>(R, [
    () => ({ kind: 'circle' }),
    () => ({ kind: 'circle' }),
    () => ({ kind: 'polygon', sides: 3 + Math.floor(R() * 6), rotation: pick(R, [0, 0, 0.3, 22.5]) }),
    () => ({ kind: 'star', points: 5 + Math.floor(R() * 4), depth: 0.3 + 0.3 * R() }),
    () => ({ kind: 'preset', name: pick(R, ['teardrop', 'heart', 'mihrab'] as const) }),
    () => ({ kind: 'preset', name: 'mihrab' }),
  ])();
const text = (R: () => number, max: number) =>
  R() < 0.2
    ? pick(R, [TEXTS.ayatKursi, TEXTS.basmala, TEXTS.tathir, TEXTS.names, TEXTS.ayatKursi + ' ' + TEXTS.ayatKursi])
    : words(R, 1 + Math.floor(R() ** 1.5 * max)).join(' ');

function comp(R: () => number, type: 'flow' | 'lines', maxSize: number): { label: string; c: Composition } {
  const o = outline(R),
    size = Math.round(18 + R() ** 1.5 * (maxSize - 18)),
    t = text(R, 70),
    lineGap = pick(R, [1, 1, 0, 2, 3]),
    wordGap = pick(R, [2, 2, 1, 3]),
    thuluth = R() < 0.06,
    bordered = R() < 0.3,
    fill: FillerNode =
      type === 'flow'
        ? { type, text: 't', lineGap, ...(R() < 0.7 ? { strength: Math.round(R() * 100) / 100 } : {}) }
        : {
            type,
            text: 't',
            lineGap,
            ...(R() < 0.5 ? { vary: pick(R, [0.3, 0.5, 0.8, 1]) } : {}),
            ...(R() < 0.15 ? { plait: true } : {}),
          },
    style = structuredClone(DEFAULT_STYLE);
  if (thuluth) style.script = 'thuluth';
  else {
    style.letter.ascenders = pick(R, [9, 9, 7, 11, 13]);
    style.letter.marks = pick(R, ['dots', 'dots', 'all', 'off']);
    if (R() < 0.2) style.letter.set = 'fatimid';
    if (R() < 0.2) style.letter.alternates = true;
  }
  return {
    label: `${type} ${JSON.stringify(o)} size=${size} words=${t.split(/\s+/).length} gap=${lineGap}/${wordGap} ${JSON.stringify(fill)} ${thuluth ? 'thuluth' : JSON.stringify(style.letter)} ${bordered ? 'bordered' : ''}`,
    c: {
      version: 1,
      seed: 7,
      canvas: { shape: 'square', margin: 3 },
      style,
      texts: { t: { text: t, repeat: 'once', wordGap }, b: { text: TEXTS.basmala, repeat: 'fill', wordGap: 2 } },
      root: {
        type: 'frame',
        child: {
          type: 'region',
          outline: o,
          // a bordered region sizes itself and gives the fill its letter scale; a bare one is set at a fixed size
          ...(bordered ? {} : { size }),
          borders: bordered ? [{ type: 'textBorder', text: 'b', separator: { kind: 'lines', width: 2 } }] : [],
          fill,
        },
      },
    },
  };
}
const placed = (c: Composition) => {
  const p = resolve(c);
  return digest({ items: p.items, fill: p.meta.fill, warnings: p.meta.warnings });
};
const cases = (seed: number, n: number, type: 'flow' | 'lines', maxSize: number) => {
  const R = rng(seed);
  return Array.from({ length: n }, (_, k) => {
    const { label, c } = comp(R, type, maxSize);
    return { label: `${seed}/${k} ${label}`, c };
  });
};

function streamCase(R: () => number) {
  const o = outline(R),
    k = 15 + R() * 120,
    P = unitRing(o).pts.map(([x, y]) => [x * k, y * k] as Pt),
    opts = {
      Hb: pick(R, [9, 11, 13, 13, 15, 19]),
      s: 0.25 + R() * 1.2,
      lineGap: pick(R, [1, 1, 0, 2, 3]),
      strength: pick(R, [0, 0.5, 0.8, 0.9, 1, R()]),
      ...(R() < 0.3 ? { margin: pick(R, [0, 0.3, 1.5]) } : {}),
      ...(R() < 0.3 ? { minLen: R() * 12 } : {}),
    };
  return { label: `stream ${JSON.stringify(o)} k=${k} ${JSON.stringify(opts)}`, P, opts };
}
const streams = (seed: number, n: number) => {
  const R = rng(seed);
  return Array.from({ length: n }, () => streamCase(R));
};

describe('fill identity', () => {
  it('streamlines are the pinned ones', () => {
    expect(digest(streams(21, 24).map(c => flowLines(c.P, c.opts)))).toBe(
      '64dad99e80db821e08f8dcde12e377c7d7d3ad6d4dea239332e92c16eb4bdd13',
    );
  });
  it('flow fills are the pinned ones', () => {
    expect(digest(cases(31, 14, 'flow', 90).map(c => placed(c.c)))).toBe(
      'd52fbb5c407f99f0cae1a7cf9863af305e363f70479e0a0294fa4cd99675ffac',
    );
  });
  it('line fills are the pinned ones', () => {
    expect(digest(cases(41, 40, 'lines', 110).map(c => placed(c.c)))).toBe(
      '336fa0770731f17f12128c9fab4cf98a4e867901d1b28f08767894f611fe89ee',
    );
  });
  const only = process.env.IDENTITY_ONLY;
  it.runIf(!!FUZZ_OUT && (!only || only === 'stream'))('broad fuzz: streamlines', { timeout: 3_600_000 }, () => {
    writeDigests(
      'stream',
      streams(121, 400).map(c => [c.label, digest(flowLines(c.P, c.opts))]),
    );
  });
  it.runIf(!!FUZZ_OUT && (!only || only === 'flow'))('broad fuzz: flow fills', { timeout: 3_600_000 }, () => {
    writeDigests(
      'flow',
      [...cases(131, 260, 'flow', 170), ...cases(132, 12, 'flow', 420)].map(c => [c.label, placed(c.c)]),
    );
  });
  it.runIf(!!FUZZ_OUT && (!only || only === 'lines'))('broad fuzz: line fills', { timeout: 3_600_000 }, () => {
    writeDigests(
      'lines',
      [...cases(141, 700, 'lines', 220), ...cases(142, 40, 'lines', 600)].map(c => [c.label, placed(c.c)]),
    );
  });
});
