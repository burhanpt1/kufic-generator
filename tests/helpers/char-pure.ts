// Each line of writing depends only on its text. The experiments share one engine (`th`, tests/helpers/char-first.ts),
// and the engine keeps what it has measured: the sides of each piece of a word, the first time it is written
// (src/script/thuluth/engine.ts `pieceSides`, keyed by the piece's letters and their places rounded to 1e-4), and the
// room between two such sides (`slideRooms`). A piece written again is spaced by the sides kept from the line it was
// first met in, so the same text came out differently, by up to 0.009 of a pen unit, according to what the same run
// had written before it (181 of 227 lines of the wider set of texts, measured): enough to move a rounded coordinate,
// and now and then a decision of a search. Importing this file makes `th.buildStrokes` write every line with an
// engine of its own, so nothing is kept from one line to the next. (The engine itself is not changed here: src/ is
// outside these experiments. The fault is its cache key. CHAR_SHARED=1 leaves the shared engine as it was, to show
// the fault.)
import { thuluth } from '../../src/script/thuluth';
import { th } from './char-first';

const PURE = Symbol.for('char-pure');
type Marked = typeof th & { [PURE]?: true };
if (!(th as Marked)[PURE] && !process.env.CHAR_SHARED) {
  (th as Marked)[PURE] = true;
  th.buildStrokes = (text, o) => thuluth(th.style).buildStrokes(text, o);
}
/** The same, for a test to call by name. */
export const pureLine: typeof th.buildStrokes = (text, o) => thuluth(th.style).buildStrokes(text, o);
