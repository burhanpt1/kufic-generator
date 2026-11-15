# The letters-first roundel: the rule set as it stands (round two)

Source: `tests/helpers/char-roundel.ts` (`arrange`, `ground`, `levels`, `curve`, `nestedBowls`), with the strokes of
`tests/helpers/char-first.ts` (`sweep`, `bowlPen`, `takeOver`, `findStems`, `raise`, `meridians`, `cradleCompose`).
Lengths are in nibs (1 nib = 1.6 pen units) unless a number is an angle. No rule names a text or a word; the only
words known are the two ligature names (الله, whose stems rise together or not at all and bend as one body, and
محمد, which is stacked by the engine).

The text is written level. Single strokes follow circles: the rim's own circle (0.9 nib inside the circle, the
stroke 0.93 nib thick on it) and circles concentric with it, each 2.13 nibs inside the one before. Risen stems may
follow the meridians of the rim's circle (F).

## A. What each letter can carry (decided from the text, before anything is drawn)

1. **Stems.** A tall stem is a near-upright run of a letter's stroke (at most 0.2 sideways per unit of rise), at
   least 2.8 nibs long, whose top stands at least 3.75 nibs above its line. A word with a stem is a _stem word_.
2. **The canopy's letter** is looked for in the first word only. The candidates, in the order they are tried:
   1. its first letter is a tall stem (ا أ إ ل لا ك ط): that stem carries the canopy (_stem_), and nothing else is tried;
   2. its first letter is a tooth or a head whose stroke starts downward or to the right (ب ي ئ س م ن ت ث ش): an arc
      is led into it (_entry_). Dots that sit above such a letter are not swallowed: they ride outside the arc's
      neck (25);
   3. its first letter opens with a roof written to the left (ح ج خ ع غ): the roof's own line is drawn on, to the
      left, along the rim (_roof_);
   4. the word has a tall stem further in: its first stem carries the canopy;
   5. none. An entry is never led into ر ز د ذ و (one stroke going down: an entry makes a stem letter of it) or into
      a loop (ص ض ط ظ ف ق ه). A word is never bent along the rim.
3. **The cradle's letter** is the final letter of a word that best becomes a returning bowl:
   ن 1.0, ي ى 0.95 (+0.1: a ya returns in every hand), ل 0.9, ج ح خ ع غ 0.9 (they return of themselves), ق 0.85,
   س ش ص ض 0.8; less 0.12 for each word after it; at most three words after it; a later word wins a tie. On a ground
   line (B) its line may hold at most three words.
4. **A tail never returns.** ر ز و and final م are not cradle letters. If there is no bowl (3) and the last word
   ends in a tail, the tail _runs forth_ (28).
5. **The sub-cradle's letter** (only if there is a cradle with words after its word): among those words, the final
   letter with the best score of: the bowls of 3, م 0.6, ر ز و 0.5, د ذ 0.3; less 0.12 for a word after it; at most
   one word after it.
6. **A dot belongs to the part of the letter it sat over as written.** When a bowl is redrawn, a dot goes with it
   only if it sat under the line or beside the kept part of its letter (a ن's, a ي's, a ج's: set along the bowl's
   floor where the bowl begins). A dot above the line that stands within 0.5 nib of the extent of what is kept of
   its letter (the head of ق ض, the teeth of ش, the roof of خ غ) stays where it was written. This holds on every
   kind of line.
7. No bowl and no tail: no cradle. No letter by 2: no canopy. Nothing is forced.

## B. Up to six words: the ground line

8. The **ground line** is the cradle word and the stem words before it, written as one line in their order; with no
   cradle, all the stem words (four at most). A single word is its own ground line, stem or none. The other words
   before the cradle word are _upper words_. The words after the cradle word sit in its bowl, on one line or two
   (with a sub-cradle: up to its word on one line, a word after it inside the inner arc).
9. The ground line stands as low as its ink allows: on the bowl's words at 0.55 nib of ink, or CLEAR (0.3 nib) over
   the bowl's floor, or, with no cradle, on the margin; or 1.25 or 3.1 nibs higher. It may be slid sideways (0,
   ±1.5, ±3, ±4.5, ±6 nibs; up to 10.5 to the left beside a hung opening word) and each of its word spaces opened
   by 1.5 nibs.
10. **Where the opening word stands.** If it is not on the ground line (no stem, not the cradle word) it _hangs_:
    from an entry, at the upper right, 22 to 60 degrees above the level diameter, to the right of every stem; from
    a roof, at the top, centred or moved right by 0.12 or 0.24 of the radius, its roof-top 1.9 to 6.25 nibs inside
    the rim's circle. If it is the ground line's first word it stays _seated_ and its arc is led from where it
    stands, but only from within 5 nibs of the rim's circle (a longer way up would make a stem of a tooth).
11. **Stems rise.** Every stem of the ground line is redrawn taller, along its own direction, until it meets the rim
    or stands CLEAR under the canopy (and under a word hung from the top); never more than 3 times its written
    height; not at all if it would rise by less than 0.15 of its height, or would meet the rim lower than 20
    degrees above the level diameter. The stems of الله rise together or not at all.
12. **Upper words** are placed in the order of the text, each at the lowest place, tried every 0.25 nib sideways,
    where it rests on what is under it at 0.55 nib of ink and stands over no stem; among places, the one that puts
    the fewest ground words out of reading order (ground line right to left, an upper word just before the ground
    word it stands over, the bowl's words last).
13. **The circle** is the smallest in which all this stands, or one up to 1.1 times that if it costs less. Cost: the
    radius, times (1 + the share of stems that do not reach), times (1 + 0.2 for each ground word out of order),
    times (1 + 0.6 x the empty share of the height under the writing; 1.0 x with no cradle; nothing for a single
    word).
14. **Soundness.** A ground-line arrangement is taken only if: no ground word is read out of order; its circle is
    at most 1.25 times the circle the same text needs on plain level lines; with no cradle, at most 0.4 of the
    circle's height is empty under the line; and no ink leaves the margin.
15. **The ladder.** The first sound arrangement of: cradle and canopy; cradle alone; canopy alone; the ground line
    alone. (For the canopy, the candidates of 2 in their order, then none.)
16. **A single word** is drawn large and stands where its own strokes reach the rim: it may stand up to 14 nibs
    above its lowest place, and every rung of 15 that is sound is drawn. The rung with the most arcs is taken; of
    two with as many, the earlier, unless the later takes the arc at the word's other end and draws the word 1.1
    times larger. It may have both a canopy and a cradle.
17. If no rung is sound, the text is set by C.

## C. Longer texts, and short texts no ground line suits: level lines in one circle

18. The words are split into level lines, centred, in the smallest circle that holds them (at least 15.5 pen units
    of pitch, widened if two lines touch); the cradle word (3, among the last four words) ends a line and the words
    after it sit in its bowl. Writing gets smaller as the text gets longer; the text stays in one roundel.
19. The canopy, if 2 gives one for the first word of the top line, is drawn from where that word stands (stem,
    entry, or roof drawn out); shortened at its tip until it is CLEAR of the writing; dropped if it cannot be.
20. The top line's other stems rise as in 11 (halved until clear of the canopy and the rim).
21. **Nesting in bowls.** Every line but the first that ends in a bowl letter (ن ي ى ل ق س ش ص ض ج ح خ ع غ), above
    the cradle's line (above the last line, where there is no cradle), has that bowl drawn out as a cradle round
    all the lines after it: the last two such lines at most. The bowls are concentric: the earliest in the text
    on the rim's circle, each later one 2.13 nibs further in, the cradle itself innermost; each ends 14 degrees
    further up the right side than the one inside it. Taken only if every bowl is CLEAR of all the writing and the
    circle grows no more than 1.12 times; else none. Reading is unchanged: the lines from the top down; a bowl
    closes its line and holds what follows.
22. With no cradle and no nested bowl, a tail that ends the last line runs forth (28).

## D. The strokes

23. **The cradle** (returning bowl): from where its letter last leaves the line of writing, the pen comes down in
    one curve to its circle, landing 1.4 times as far along it as it started above it (5 nibs at least), and runs
    along it to the right, pen turned with the rim, one weight; it ends as high on the right as it landed on the
    left (at most 80 degrees from the bottom), or, with nothing in it, just past the line it holds; the last 5.6
    nibs thin to a tip that lifts 0.9 nib off its circle. Its dots: by A6.
24. **The canopy from a stem or an entry**: the cradle's stroke turned half round. From a stem's top (risen until
    its split stands 2.5 to 4 nibs inside the rim's circle) or from an entry (the first stroke taken over where it
    has 0.9 of the pen's weight) the stroke climbs to the rim's circle, runs over the top and ends 25 degrees left
    of the top; it follows the rim for at least 40 degrees, and on a small circle for at least the least length a
    stroke that thins to a tip can have (9.3 nibs). A stem carries the canopy only if its top stands at least 5
    degrees right of the top of the circle: the arc must cross the top. Left of that the stem only rises.
25. **Dots that ride**: the dots above a letter that takes an entry are set on the outer side of the arc's
    neck (the side away from the word), the first 1.3 nibs from the stroke's middle beside where it is taken over,
    each further dot 1.2 nibs further out; the arrangement stands only if they are inside the margin.
26. **The canopy from a roof**: the letter is kept whole. A stroke of its own, begun on the roof a little before
    its highest point, carries the roof's line on to the left, up to the rim's circle and along it, ending 75
    degrees left of the top (9:30), or at 0.85, 0.7 or 0.55 of that: the longest that is CLEAR of its own word.
27. **The nested arcs above and below**: the _sub-canopy_ is the next tall stem to the left of the canopy's letter,
    risen to the first inner circle on which it clears what hangs from the canopy and bowed over to the left; it
    follows its circle for 0.62 of what the canopy follows (25 degrees at least), its tip 14 degrees short of the
    canopy's, and it ends no further than 50 degrees left of the top (a stem too far left for that is not bowed).
    The _sub-cradle_ is the cradle's stroke from the sub-cradle's letter (a foot د ذ: from its tip, the letter kept
    whole) on the next circle in, for 0.62 of the cradle's run, its tip 14 degrees short of the cradle's. Both are
    added if the circle grows no more than 1.12 times; else the one that costs less; else none.
28. **A tail running forth**: the final ر ز و م of the last word, taken over as a bowl is, comes down to the
    rim's circle the way it is already going and follows it on up the left side for 55 degrees, shortened until it
    is CLEAR of the writing, never nearer the level diameter than 10 degrees. Only where it is taken over within 5
    nibs of the rim's circle. Nothing sits in it.

## E. Clearances (measured on a raster, 5 cells to a pen unit)

29. Ink to the circle: 0.9 nib. Line to line and word to word across lines: 0.55 nib of ink. Any stroke on a circle
    to any other ink (from two nibs past where it leaves its letter): 0.3 nib. An arrangement that fails any of
    these is not drawn; the next rung of the ladder is.

## F. Curved stems (after the layout is settled; the layout is not changed)

30. A risen stem keeps its share of the circle's width as it rises: at height y it stands at x0 w(y)/w(y0), where
    w is the half-width of the rim's circle at that height and (x0, y0) its foot. It leaves its foot upright and
    has turned to its meridian within about 1.9 nibs; its head is carried whole on its top, turned with it; the
    pen turns with the stem. Unrisen stems stay straight, and so does a stem that is one stroke with the cradle's
    bowl.
31. The stems of الله bend as one body, on the meridian of its middle stem.
32. Not on a line whose stems' feet stand higher than 0.4 of the radius above the centre.
33. A stem that is the canopy, or is bowed over as a sub-canopy, rises on its meridian and is led into its circle
    from the direction it then has (its split 1.4 to 4 nibs inside that circle, the pen turning over 5 nibs).
34. Each other stem rises until it meets the margin or comes within CLEAR of an arc above it; of two stems that
    come within CLEAR of each other the outer is drawn shorter, 0.4 nib at a time; if the line then comes within
    CLEAR of other writing, all are drawn 0.85 as tall, up to six times; if that does not clear it, the stems stay
    straight.
35. Only where at least three stems of the line curve, with one at least 0.15 of the radius to each side of the
    upright axis. Fewer read as a slip of the pen; all on one side as a slant.

## G. Each line depends only on its text

36. Every line is written by an engine of its own (`tests/helpers/char-pure.ts`): the shared engine's piece cache
    made a line depend on what the run had written before it.

## How sure each threshold is (re-derived on the 29 texts that could be looked at)

- **1.25 times the level-lines circle (14).** Arrangements taken stand at 0.67 to 1.12; those refused for size
  stand at 1.27 and above (five texts). Any value from 1.13 to 1.26 gives the same 29 results. It separates, but it
  is not pinned: the nearest text on each side is 0.15 away.
- **0.4 of the height empty under a line with no cradle (14).** Taken: up to 0.31 (two texts at 0.31, one judged
  good, one weak). Refused: one text, at 0.44. Any value from 0.32 to 0.43 gives the same results: one text decides
  it. Weak.
- **5 degrees right of the top for a stem to carry the canopy (24).** Set on two texts in round one; both now open
  with another stroke (an entry, a roof), and none of the 29 is refused by it. Sixteen stem canopies land between
  0 and 44 degrees right of the top. Unsupported by the present texts; kept as a guard.
- **50 degrees left of the top for an inner arc above (27).** Twelve sub-canopies end between 3 and 50 degrees left
  of the top; one stands exactly on the limit (and is a good image), one at 46. It binds, on one text. Weak.
- **5 nibs for a seated arc and for a tail running forth (10, 28).** Not re-derived: no text sits near either.
- **Three stems, 0.15 of the radius each side, for curved stems (35).** Chosen by looking at the five texts that
  curve under it (three clearly better, two slightly). A looser rule (two stems, on either side) curved two more
  texts; those were not judged. Weak.

## Known gaps (stated so that they are not mistaken for rules)

- Level lines raise only the top line's stems; a second ground line whose stems rise to their own circle is not
  built, and was not tried.
- Stacking a short word over its neighbour on level lines is not built; on a ground line the upper words already
  stand in the bays (12).
- A roof cannot be drawn out (26) where the word has a tall stem beside the roof: the arc has no way past it, and
  the word gets no canopy. Found on a held-out text; not mended.
- A tail running forth and an entry cannot both be had by a short single word: the tail needs the word low, the
  entry needs it high.
- A dot stays over a kept head only where the kept part reaches under it (A6); a roof whose kept part ends short of
  its dot would lose it to the bowl.
- A drawn-out join (kashida) to fit a word to its chord, and dots set as weights in an empty part, are not built.
- The entry search is slow for a three-word text whose opening word hangs (minutes).
