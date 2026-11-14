// The roundel composer and the mark solver, pinned to the bit: a handful of arrangements in each mode (free, on a
// reading path, in fitted lanes, ruled), finished and built, each reduced to a checksum of everything it places
// (positions, variants, energies and the marks, every number at full precision). Work on the composer's speed must
// leave these as they are; a change that is meant to move a drawing records them anew (the failure prints the new
// checksum).
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { setRoundelBackend } from '../src/kernels/roundel';
import { thuluthStyleOf } from '../src/script/registry';
import { thuluth } from '../src/script/thuluth/engine';
import type { BuiltRoundel, Roundel, RoundelOptions, RoundelSpec } from '../src/script/thuluth/roundel';
import { buildRoundel, composeRoundel, finishOne } from '../src/script/thuluth/roundel';

const th = thuluth(thuluthStyleOf({ preset: 'roundel' }));
const sum = (v: unknown) =>
  createHash('sha256')
    .update(
      JSON.stringify(v, (_k, x: unknown) =>
        typeof x === 'number' && !Number.isFinite(x) ? String(x) : Object.is(x, -0) ? '-0' : x,
      ),
    ) // prettier-ignore
    .digest('hex')
    .slice(0, 16);
const placed = (r: Roundel) => ({ E: r.E, overlap: r.overlap, disc: r.disc, st: r.st, lv: r.lv, wp: r.wp, up: r.up, lanes: r.lanes, ruled: r.ruled, bowlGrow: r.bowlGrow, tailsDrawn: r.tailsDrawn, risen: r.risen }); // prettier-ignore
const built = (b: BuiltRoundel) => [placed(b.r), b.f.marks, b.f.solved, b.f.companion, b.f.discScale, b.f.missing, b.f.marksUnplaced, b.path]; // prettier-ignore

const BASMALA = 'بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ',
  SALAWAT = 'اللهم صل على محمد وآل محمد',
  PEN: RoundelOptions = { elongate: true, cross: true, kern: true },
  RICH: RoundelOptions = { ...PEN, stack: true, nest: true, cradle: true, emph: 'ب', noRise: true, topFirst: true, ceiling: true, fillTarget: 0.5, oval: 1.3 }; // prettier-ignore

const COMPOSED: [string, string, RoundelOptions, string][] = [
  ['free', BASMALA, PEN, '84556d1f6ba3e9a1'],
  ['free, every rule', BASMALA, RICH, '8c040b6c42f59b02'],
  ['girift', SALAWAT, { ...PEN, girift: 0.04, merge: true, stack: true, learnedStack: true }, '0858f91c0e2b9873'],
  ['fitted lanes', BASMALA, { ...PEN, lanes: {} }, '80dc86d9710623cb'],
  ['lanes in a pear', SALAWAT, { ...PEN, lanes: {}, field: 'pear', stack: true }, 'f54dc1f305b213b3'],
  ['a path (stag2)', BASMALA, { ...PEN, path: 'stag2' }, 'b06e7acd878c5516'],
  ['a path (calliar4)', SALAWAT, { ...PEN, path: 'calliar4', stack: true }, 'ce69f289af4a4efd'],
  ['ruled', BASMALA, { ...PEN, ruled: true }, 'd5d49f72ac0c2ec3'],
  ['ruled, with riders and stacks', SALAWAT, { ...PEN, ruled: { anchors: true }, stack: true, nest: true, oval: 1.3 }, '8771b90cddbb3193'],
  ['ruled in a tulip', BASMALA, { ...PEN, ruled: { anchors: true, lines: 3 }, field: 'tulip', stack: true }, '81afd3a683f8d872'],
  ['two names', 'زينب قصي', { ...PEN, companion: 'سنة', stack: true }, 'b97f16664c44c97c'],
  ['one name', 'محمد', {}, '97e9e4d2dcb81618'],
]; // prettier-ignore
const FINISHED: [string, string, RoundelOptions, Partial<RoundelSpec>, string][] = [
  ['in a fitted frame', BASMALA, PEN, { frame: {} }, 'c86f334e3c61f326'],
  ['with ornaments and clearance', BASMALA, { ...PEN, lanes: {} }, { frame: { ornaments: true, density: 0.6, markReach: 2.2, clearance: 0.3, markDensity: 0.8, fathaGap: true } }, '4a99590f65fd539d'],
  ['in the composed disc, with a companion', SALAWAT, { ...PEN, ruled: true }, { frame: false, companion: 'سنة' }, '09be8bc7d0e0271f'],
]; // prettier-ignore

describe('roundels, to the bit', () => {
  for (const [name, text, o, want] of COMPOSED)
    it(`composes: ${name}`, () => {
      expect(sum(composeRoundel(th, text, { ...o, tries: 2, iters: 500, seed: 11 }).map(placed))).toBe(want);
    });
  it('composes the same without the kernels', () => {
    setRoundelBackend('js');
    try {
      for (const k of [0, 3, 7]) {
        const [, text, o, want] = COMPOSED[k];
        expect(sum(composeRoundel(th, text, { ...o, tries: 2, iters: 500, seed: 11 }).map(placed))).toBe(want);
      }
    } finally {
      setRoundelBackend('auto');
    }
  });
  for (const [name, text, o, spec, want] of FINISHED)
    it(`finishes: ${name}`, () => {
      const [r] = composeRoundel(th, text, { ...o, tries: 1, iters: 300, seed: 9 });
      expect(sum(built(finishOne(th, { text, compose: o, ...spec }, structuredClone(r))))).toBe(want);
    });
  it('builds: the path fitted to the text', () => {
    const b = buildRoundel(th, { text: BASMALA, compose: { ...PEN, path: 'auto', tries: 2, iters: 300 }, frame: {} })!;
    expect(sum(built(b))).toBe('5f7fb65e728b0c3c');
  });
}, 300_000);
