// The cradle (owner's experiment, 15 November 2026). Whole words placed on level lines give typesetting; what has
// looked like calligraphy came from a letter doing something because of where it is. Here one letter of the text, a
// final bowl, is drawn out into a great sweep that follows the circle's lower rim, and the rest of the text is set in
// the space it encloses: the bowl is the composition's floor, and the writing draws the circle's lower edge itself.
//
// The bowl returns: it leaves its letter at the left end of a line, comes down to the rim and runs back to the right
// under its own line and the lines after it, as the returning ya does in every hand and as the great nun does in the
// Husayn roundel (letters.data GREAT). So the words keep the order of level lines, read from the top line down, and
// the words that follow the cradle word sit in its bowl.
//
// The rule, the drawing and every number are in tests/helpers/char-first.ts (which the crown and cradle shares), in
// the order they are applied.
// `CRADLE=1 CRADLE_OUT=<dir> npx vitest run tests/char-bowl-sheet.test.ts --maxWorkers=2` writes the sheet.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { toPNG } from '../scripts/raster.mjs';
import './helpers/char-pure';
import type { CradleLaid as Laid, CradleOptions as Options, Span } from './helpers/char-first';
import { NIB, TEXTS, cradleCompose as compose, cradleOf, sheetOf, svgOf } from './helpers/char-first';

describe('the cradle: a final bowl drawn out along the lower rim', () => {
  it('picks the cradle letter of each text', () => {
    const picked = TEXTS.map(([, t]) => {
      const c = cradleOf(t)!;
      return `${t.split(' ')[c.wi]} ${c.c}`;
    });
    expect(picked).toEqual(['علي ي', 'الرحمن ن', 'وآل ل', 'يكن ن']);
    // a text with no final bowl has no cradle
    expect(cradleOf('الله أحد')).toBeNull();
  });
  it.runIf(!!process.env.CRADLE)(
    'writes the sheet',
    () => {
      const out = process.env.CRADLE_OUT ?? join(import.meta.dirname, '../docs/cradle');
      mkdirSync(out, { recursive: true });
      const report: string[] = [],
        say = (tag: string, id: string, l: Laid | null) =>
          report.push(
            !l
              ? `${tag} ${id}: no arrangement`
              : `${tag} ${id}: radius ${l.R.toFixed(1)} (${(l.R / NIB).toFixed(1)} nibs); lines: ${l.lines.join(' / ')}` +
                  (l.cradle ? `; cradle: ${l.cradle.why} (score ${l.cradle.score.toFixed(2)}); bowl spans ${(l.span * 100).toFixed(0)}% of the diameter, ${l.arc.toFixed(0)} degrees of rim, and holds ${l.inside} line${l.inside === 1 ? "" : "s"} besides its own` : ''), // prettier-ignore
          );
      const only = process.env.CRADLE_ONLY,
        texts = TEXTS.filter(([id]) => !only || only.split(',').includes(id)),
        row = (tag: string, o: Options) =>
          texts.map(([id, t]) => {
            const l = compose(t, o);
            say(tag, id, l);
            if (l && tag !== 'level') writeFileSync(join(out, `${tag}-${id}.png`), toPNG(svgOf(l), 900));
            return l;
          }),
        rows = [row('level', { cradle: false }), row('cradle', {})];
      writeFileSync(join(out, 'cradle-sheet.png'), toPNG(sheetOf(rows), texts.length * 480));
      // CRADLE_VAR=long,short: the bowl ending far up the rim, and just past the line it holds, under the default
      const vars = (process.env.CRADLE_VAR ?? '').split(',').filter(Boolean) as Span[];
      if (vars.length)
        writeFileSync(join(out, 'cradle-variations.png'), toPNG(sheetOf([rows[1], ...vars.map(v => row(`cradle-${v}`, { span: v }))]), texts.length * 480)); // prettier-ignore
      writeFileSync(join(out, 'numbers.txt'), report.join('\n') + '\n');
      expect(rows[1].every(Boolean)).toBe(true);
    },
    1_800_000,
  );
});
