# The letters-first roundel: the rule set as it stands

Source: `tests/helpers/char-roundel.ts` (`arrange`, `ground`, `levels`), with the strokes of
`tests/helpers/char-first.ts` (`sweep`, `bowlPen`, `findStems`, `raise`, `cradleCompose`). Lengths are in nibs
(1 nib = 1.6 pen units) unless a number is an angle. No rule names a text or a word; the only words known are the two
ligature names (الله, whose stems rise together or not at all, and محمد, which is stacked by the engine).

The text is written level and upright. Only single strokes follow circles: the rim's own circle (0.9 nib inside the
circle, the stroke 0.93 nib thick on it) and circles concentric with it.

## A. What each letter can carry (decided from the text, before anything is drawn)

1. **Stems.** A tall stem is a near-upright run of a letter's stroke (at most 0.2 sideways per unit of rise), at
   least 2.8 nibs long, whose top stands at least 3.75 nibs above its line. A word with a stem is a _stem word_.
2. **The canopy's letter** is looked for in the first word only, the first of these that applies:
   1. its first letter is a tall stem (ا أ إ ل لا ك ط): that stem carries the canopy;
   2. its first letter takes an entry and the word has no stem. A letter takes an entry if its first stroke starts
      downward or to the right, it is a tooth, a roof or a head (ب ي ئ س ح ج خ ع غ م), and it has no dot above it (so
      not ن ت ث ش: the arc arrives from above and swallows the dot). The arc is then led into that letter;
   3. the word has a tall stem further in: its first stem carries the canopy;
   4. otherwise there is no canopy. An entry is never led into ر ز د ذ و (one stroke going down: an entry makes a
      stem letter of it) or into a loop (ص ض ط ظ ف ق ه). A word is never drawn out along the rim.
   - Not built: a roof that starts up and to the right (this hand's ح and ع) belongs at the top left, drawn out to
     the left over its own word; today such a word has no canopy.
3. **The cradle's letter** is the final letter of a word that best becomes a returning bowl:
   ن 1.0, ي ى 0.95 (+0.1: a ya returns in every hand), ل 0.9, ج ح خ ع غ 0.9 (they return of themselves), ق 0.85,
   س ش ص ض 0.8; less 0.12 for each word after it; at most three words after it; a later word wins a tie. On a ground
   line (B) its line may hold at most three words.
4. **A tail never returns.** ر ز و and final م are not cradle letters. If there is no bowl (3) and the last word
   ends in a tail, the tail _runs forth_ (D4).
5. **The sub-cradle's letter** (only if there is a cradle with words after its word): among those words, the final
   letter with the best score of: the bowls of 3, م 0.6, ر ز و 0.5, د ذ 0.3; less 0.12 for a word after it; at most
   one word after it.
6. No bowl and no tail: no cradle. No letter by 2: no canopy. Nothing is forced.

## B. Up to six words: the ground line

7. The **ground line** is the cradle word and the stem words before it, written as one line in their order; with no
   cradle, all the stem words (four at most). The other words before the cradle word are _upper words_. The words
   after the cradle word sit in its bowl, on one line or two (with a sub-cradle: up to its word on one line, a word
   after it inside the inner arc).
8. The ground line stands as low as its ink allows: on the bowl's words at 0.55 nib of ink, or CLEAR (0.3 nib) over
   the bowl's floor, or, with no cradle, on the margin. It may be slid sideways (0, ±1.5, ±3, ±4.5, ±6 nibs; up to
   10.5 to the left beside a hung opening word) and each of its word spaces opened by 1.5 nibs.
9. **Stems rise.** Every stem of the ground line is redrawn taller, along its own direction, until it meets the rim
   or stands CLEAR under the canopy; never more than 3 times its written height; not at all if it would rise by
   less than 0.15 of its height, or would meet the rim lower than 20 degrees above the level diameter. The stems of
   الله rise together or not at all.
10. **Upper words** are placed in the order of the text, each at the lowest place, tried every 0.25 nib sideways,
    where it rests on what is under it at 0.55 nib of ink and stands over no stem; among places, the one that puts
    the fewest ground words out of reading order (ground line right to left, an upper word just before the ground
    word it stands over, the bowl's words last).
11. **The circle** is the smallest in which all this stands, or one up to 1.1 times that if it costs less. Cost: the
    radius, times (1 + the share of stems that do not reach), times (1 + 0.2 for each ground word out of order),
    times (1 + 0.6 x the empty share of the height under the writing; 1.0 x with no cradle).
12. **Soundness.** A ground-line arrangement is taken only if: no ground word is read out of order; its circle is
    at most 1.25 times the circle the same text needs on plain level lines; with no cradle, at most 0.4 of the
    circle's height is empty under the line; and no ink leaves the margin.
13. **The ladder.** The first sound arrangement of: cradle and canopy; cradle alone; canopy alone; the ground line
    alone. (For the canopy, the candidates of 2 in their order, then none.) A single word follows the same ladder:
    its bowl or tail if it has one, else its canopy; never both.
14. If none is sound, the text is set by C.

## C. Longer texts, and short texts no ground line suits: level lines in one circle

15. The words are split into level lines, centred, in the smallest circle that holds them (at least 15.5 pen units
    of pitch, widened if two lines touch); the cradle word (3, among the last four words) ends a line and the words
    after it sit in its bowl. Writing gets smaller as the text gets longer; the text stays in one roundel.
16. The canopy, if 2 gives one for the first word of the top line, is drawn from there; shortened at its tip until
    it is CLEAR of the writing; dropped if it cannot be.
17. The top line's other stems rise as in 9 (halved until clear of the canopy and the rim).
18. With no cradle, a tail that ends the last line runs forth (D4).

## D. The strokes

19. **The cradle** (returning bowl): from where its letter last leaves the line of writing, the pen comes down in
    one curve to the rim's circle, landing 1.4 times as far along the rim as it started above it (5 nibs at least),
    and runs along it to the right, pen turned with the rim, one weight; it ends as high on the right as it landed
    on the left (at most 80 degrees from the bottom), or, with nothing in it, just past the line it holds; the last
    5.6 nibs thin to a tip that lifts 0.9 nib off the rim. Its dots: a letter whose dots belong under or in the bowl
    (ن ي ج) has them set along the floor where the bowl begins; a letter whose dots sit on its head (ق ض ش) keeps
    them there.
20. **The canopy**: the cradle's stroke turned half round. From a stem's top (risen until its split stands 2.5 to 4
    nibs inside the rim's circle) or from an entry (the first stroke taken over where it has 0.9 of the pen's
    weight, the word hung 22 to 60 degrees above the level diameter on the right, to the right of every stem), the
    stroke climbs to the rim's circle, runs over the top and ends 25 degrees left of the top; it follows the rim
    for at least 40 degrees, and on a small circle for at least the least length a stroke that thins to a tip can
    have (9.3 nibs). A stem carries the canopy only if its top stands at least 5 degrees right of the top of the
    circle: the arc must cross the top. Left of that the stem only rises.
21. **The nested arcs**, on circles each 2.13 nibs inside the one before (the stroke and 1.2 nibs of air):
    the _sub-canopy_ is the next tall stem to the left of the canopy's letter, risen to the first inner circle on
    which it clears what hangs from the canopy and bowed over to the left; it follows its circle for 0.62 of what
    the canopy follows (25 degrees at least), its tip 14 degrees short of the canopy's, and it ends no further than
    50 degrees left of the top (a stem too far left for that is not bowed). The _sub-cradle_ is the cradle's stroke
    from the sub-cradle's letter (a foot د ذ: from its tip, the letter kept whole) on the next circle in, for 0.62
    of the cradle's run, its tip 14 degrees short of the cradle's. Both are added if the circle grows no more than
    1.12 times; else the one that costs less; else none.
22. **A tail running forth** (D4): the final ر ز و م of the last word, taken over as a bowl is, comes down to the
    rim's circle the way it is already going and follows it on up the left side for 55 degrees, shortened until it
    is CLEAR of the writing, never nearer the level diameter than 10 degrees. Only where it is taken over within 5
    nibs of the rim's circle (a low ground line; the last of the level lines): a longer way down would make a stem
    of it. Nothing sits in it.

## E. Clearances (measured on a raster, 5 cells to a pen unit)

23. Ink to the circle: 0.9 nib. Line to line and word to word across lines: 0.55 nib of ink. Any stroke on a circle
    to any other ink (from two nibs past where it leaves its letter): 0.3 nib. An arrangement that fails any of
    these is not drawn; the next rung of the ladder is.

## F. Each line depends only on its text

24. Every line is written by an engine of its own (`tests/helpers/char-pure.ts`): the shared engine's piece cache
    made a line depend on what the run had written before it.

## Known gaps (stated so that they are not mistaken for rules)

- On level lines the cradle is the helper's (`cradleCompose`), which still sets every dot of the cradle letter in
  the bowl, also a ض's or a ق's.
- Level lines raise only the top line's stems; a second ground line whose stems rise to their own circle is not built.
- The roof of ح / ع drawn out along the top left is not built (2, note).
- The entry search is slow for a three-word text whose opening word hangs (minutes).
