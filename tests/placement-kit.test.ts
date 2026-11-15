// The kit that goes with docs/placement-brief/BRIEF.md: the words of four test texts as outlines, in the letters the
// owner chose, for anyone (or any agent) asked to place them in a circle from first principles.
// `KIT=1 npx vitest run tests/placement-kit.test.ts` rewrites docs/placement-brief/kit.json.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ROUNDEL_PEN, thuluth } from '../src/script/thuluth';
import { CHOSEN } from '../src/script/thuluth/alts';
import { cleanOutline } from '../src/script/thuluth/outline';
import type { Poly } from '../src/script/thuluth/types';

const dir = join(import.meta.dirname, '../docs/placement-brief');
const TEXTS: [id: string, text: string, note: string][] = [
  ['names', 'محمد علي', 'two names'],
  ['basmala', 'بسم الله الرحمن الرحيم', 'the basmala, four words'],
  ['salawat', 'اللهم صل على محمد وآل محمد', 'a blessing, six words'],
  ['ikhlas', 'قل هو الله أحد الله الصمد لم يلد ولم يولد ولم يكن له كفوا أحد', 'a whole short surah, fifteen words'],
];
const r3 = (n: number) => Math.round(n * 1000) / 1000;

function kit() {
  const th = thuluth({ ...ROUNDEL_PEN, alts: CHOSEN, pieceGap: 0.45 });
  const shape = (word: string, kashida: number) => {
    const b = th.buildStrokes(word, { kashida }),
      polys: Poly[] = cleanOutline([...b.strokes.flatMap(s => th.strokePolys(s)), ...b.dots.flatMap(([x, y]) => th.dotPolysAt(x, y))]), // prettier-ignore
      xs = polys.flat().map(p => p[0]),
      ys = polys.flat().map(p => p[1]);
    return {
      // x0 is the word's left edge (negative: a word runs leftward from its origin), x1 its right edge
      box: { x0: r3(Math.min(...xs)), x1: r3(Math.max(...xs)), y0: r3(Math.min(...ys)), y1: r3(Math.max(...ys)) },
      polys: polys.map(q => q.map(([x, y]) => [r3(x), r3(y)])),
    };
  };
  return {
    about: 'Words of four Arabic texts as filled outlines, for docs/placement-brief/BRIEF.md.',
    units:
      'pen units; y is up; a word is written right to left along the line y = 0 (its baseline), starting at x = 0 and running to negative x',
    nib: th.style.nib,
    texts: TEXTS.map(([id, text, note]) => ({
      id,
      text,
      note,
      words: text.split(' ').map(word => {
        // the same word drawn out to three lengths, where its letters allow it
        const all = [0, 3, 6].map(k => shape(word, k)),
          variants = all.filter((v, i) => i === 0 || v.box.x1 - v.box.x0 > all[i - 1].box.x1 - all[i - 1].box.x0 + 0.5);
        return { word, variants };
      }),
    })),
  };
}

describe('the placement kit', () => {
  it('holds every word of every text, each with at least one outline on its baseline', () => {
    const k = kit();
    expect(k.texts.map(t => t.words.length)).toEqual([2, 4, 6, 15]);
    for (const t of k.texts)
      for (const w of t.words) {
        expect(w.variants.length).toBeGreaterThan(0);
        for (const v of w.variants) {
          expect(v.polys.length).toBeGreaterThan(0);
          expect(v.box.x1).toBeLessThan(4);
          expect(v.box.x0).toBeLessThan(0);
          expect(v.box.y1).toBeGreaterThan(0);
        }
      }
    if (process.env.KIT) writeFileSync(join(dir, 'kit.json'), JSON.stringify(k) + '\n');
    // the kit in the repo is the one today's letters give
    else expect(JSON.parse(readFileSync(join(dir, 'kit.json'), 'utf8'))).toEqual(JSON.parse(JSON.stringify(k)));
  });
});
