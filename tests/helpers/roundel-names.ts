// The Burhan and Shamira cartouche the great-bowl tests are built on (tests/roundel-bowl*.test.ts).
import { ROUNDEL_PEN, thuluth } from '../../src/script/thuluth';
import type { RoundelSpec } from '../../src/script/thuluth/roundel';
import type { buildRoundel } from '../../src/script/thuluth/roundel';

export const NAMES = 'بُرْهَان وَشَمِيرَة';
export const th = thuluth({ ...ROUNDEL_PEN, great: { ya: true, yaWide: 2.6, yaDeep: 1.3 } });
export const spec = (o: Partial<RoundelSpec> = {}): RoundelSpec => ({
  text: NAMES,
  compose: { elongate: true, cross: true, fillTarget: 0.5, noRise: true, cradle: true, oval: 1.45, kern: true, tries: 6 }, // prettier-ignore
  tweaks: [{ at: 'و', scale: 0.62 }],
  bowl: { clear: 5.6, autoOval: true },
  frame: { markReach: 2.2 },
  ...o,
});
export const bowlGroup = (r: ReturnType<typeof buildRoundel>) => r!.r.groups.findIndex(g => g.s === 'ن');
