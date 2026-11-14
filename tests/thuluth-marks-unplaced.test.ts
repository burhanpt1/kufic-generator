// Marks without room, as drawn. Finished.missing, which the roundel's score and the critic's `marked` read, is 0
// whenever the marks solver has run (it places every mark somewhere, with room or without), and the solver is on by
// default: the penalty never fires. The real count (dots and marks the search left lying on ink) is now reported as
// marksUnplaced, on the finished roundel and in its checks, and is not part of any score: the choice of arrangement,
// and so every drawing, is as it was.
import { describe, expect, it } from 'vitest';
import { ROUNDEL_PEN, thuluth } from '../src/script/thuluth/engine';
import { composeRoundel, finishRoundel, roundelChecks } from '../src/script/thuluth/roundel';

const th = thuluth(ROUNDEL_PEN),
  // a crowded text: 36 dots and marks
  r = composeRoundel(th, 'يُثَبِّتُ ٱللَّهُ ٱلَّذِينَ ءَامَنُواْ بِٱلۡقَوۡلِ ٱلثَّابِتِ', {
    tries: 1,
    iters: 600,
    seed: 7,
  })[0],
  finish = (o: Parameters<typeof finishRoundel>[3]) => finishRoundel(th, structuredClone(r), '', o);

describe('marks without room', () => {
  const solved = finish({}),
    starved = finish({ markIters: 1 }),
    greedy = finish({ solver: false });
  it('are counted as drawn when the solver has run, where `missing` is always 0', () => {
    expect(solved.missing).toBe(0);
    expect(starved.missing).toBe(0);
    expect(solved.marksUnplaced).toBe(solved.solved!.unplaced);
    expect(starved.marksUnplaced).toBe(starved.solved!.unplaced);
    // a search cut short leaves more of them on the letters than a full one
    expect(starved.marksUnplaced).toBeGreaterThan(solved.marksUnplaced);
    expect(starved.marksUnplaced).toBeGreaterThan(3);
    expect(solved.marksUnplaced).toBeLessThanOrEqual(solved.solved!.count);
  });
  it('are the greedy pass’s own count without the solver', () => {
    expect(greedy.solved).toBeNull();
    expect(greedy.marksUnplaced).toBe(greedy.missing);
  });
  it('are reported with the roundel’s checks', () => {
    expect(roundelChecks(th, r, solved).marksUnplaced).toBe(solved.marksUnplaced);
    expect(roundelChecks(th, r, starved).marksUnplaced).toBe(starved.marksUnplaced);
  });
  it('is none for a text whose marks all find room', () => {
    const easy = composeRoundel(th, 'محمد علي', { tries: 1, iters: 600, seed: 7 })[0];
    expect(finishRoundel(th, easy, '', {}).marksUnplaced).toBe(0);
  });
});
