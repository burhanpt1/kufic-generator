# The letters-first roundel: the rule set as it stands (round three)

Source: `tests/helpers/char-roundel.ts` (`arrange`, `ground`, `tiersCompose`, `levels`, `curve`, `nestedBowls`),
with the strokes of `tests/helpers/char-first.ts` (`sweep`, `bowlPen`, `takeOver`, `bowlLast`, `mendDots`,
`findStems`, `raise`, `drawnOut`, `meridians`, `cradleCompose`; `fine` draws with the mended strokes of 28a to 28e).
Lengths are in nibs (1 nib = 1.6 pen units) unless a number is an angle. No rule names a text or a word; the only
words known are the two ligature names (الله, whose stems rise together or not at all and bend as one body, and
محمد, which is stacked by the engine).

Round three's changes are marked (r3); round four's (r4) are strokes only, in D: no rule of A to C, E or F was
changed. Two things rank above every other rule (owner, on round two's drawings):
**a letter must stay readable** (its dots with it, in their written place), and **the calm of plain lines is not
traded for devices**.

The text is written level. Single strokes follow circles: the rim's own circle (0.9 nib inside the circle, the
stroke 0.93 nib thick on it) and circles concentric with it, each 2.13 nibs inside the one before. Risen stems may
follow the meridians of the rim's circle (F).

## A. What each letter can carry (decided from the text, before anything is drawn)

1. **Stems.** A tall stem is a near-upright run of a letter's stroke (at most 0.2 sideways per unit of rise), at
   least 2.8 nibs long, whose top stands at least 3.75 nibs above its line. A word with a stem is a _stem word_.
2. **The canopy's letter** is looked for in the first word only. The candidates, in the order they are tried:
   1. its first letter is a tall stem (ا أ إ ل لا ك ط): that stem carries the canopy (_stem_), and nothing else is tried;
   2. its first letter is a tooth or a head whose stroke starts downward or to the right and that carries no dot
      above it (ب ي ئ س م): an arc is led into it (_entry_). (r3) Not into ن ت ث ش: the arc hides the tooth, and
      a dot moved off its letter to ride the arc makes it unreadable;
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
6. **A dot stays with its letter** (r3). A dot written above the line stays where it was written, whatever becomes
   of its letter's bowl (a ن's dot is not set in the great bowl: it is lost there, and the ن with it). If the new
   stroke would pass within 0.3 nib of it, it is lifted straight up, 0.3 nib at a time, until it is clear. Words
   placed afterwards keep 1.5 nibs from such a dot: it must be nearer its own letter than any other writing. Only
   a dot written under the line (a ي's, a ج's) goes with a redrawn bowl: along its floor, where the bowl begins.
   **A dot touches no stroke** (r3): a group of dots that touches a stroke as written (closer than 0.12 nib) is
   moved, whole, by the least of these that clears it: away from the line of writing by 0.5, 1, 1.5 or 2 pen
   units, along the line by 0.5, 1 or 1.5 either way, or both by 0.7 or 1.4. Three dots stay a pyramid. A group
   that touches nothing is not moved.
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
    at most 1.25 times the circle the same text needs on plain level lines; with no cradle, at most 0.2 of the
    circle's height is empty under the line (r3: was 0.4; a line across the middle with the lower part of the
    circle bare is refused, and the text is set by C, which fills the circle); and no ink leaves the margin.
15. **The ladder.** The first sound arrangement of: cradle and canopy; cradle alone; canopy alone; the ground line
    alone. (For the canopy, the candidates of 2 in their order, then none.)
16. **A single word** is drawn large and stands where its own strokes reach the rim: it may stand up to 14 nibs
    above its lowest place, and every rung of 15 that is sound is drawn. (r3) A rung whose circle is more than 1.15
    times the smallest rung's is passed over: an arc that leaves the word small in an empty circle is not worth
    having. Of the rest, the rung with the most arcs is taken; of two with as many, the earlier, unless the later
    takes the arc at the word's other end and draws the word 1.1 times larger. It may have both a canopy and a
    cradle. (r3) If the rung taken has no arc, the word is not a ground line: it stands in the middle of the
    smallest circle that holds it (C).
17. If no rung is sound, the text is set by C.

## C. Longer texts, and short texts no ground line suits: tiers in one circle (r3)

18. **Tiers.** The words up to the cradle word (3, among the last four words) are split into lines in their order;
    the cradle word ends its line, and the words after it are one line or two in its bowl; six lines at most. The
    cradle's line is never the first. Writing gets smaller as the text gets longer; the text stays in one roundel.
    1. **Stacking.** A line may be written with its short words stacked: a word of at most three letters that is
       not the first word of the text, does not carry the cradle, does not end its line in a bowl letter, and does
       not follow a stacked word, is taken off the line and set above it, at the lowest place where it rests on
       the writing at 0.55 nib of ink, over no tall stem (its middle at least its half-width and 0.47 nib from
       every stem), between the right end of the word before it and the left end of the word after it; of places
       as low (within 0.3 pen unit), the nearest to where those two words meet. A word that finds no place stays
       on the line. Reading: a stacked word is read after the word under its right and before the word under its
       left.
    2. **The lines rest on one another** at 0.55 nib of ink, measured column by column (columns of 0.2 pen unit),
       not at one pitch: a stem stands up into a gap of the line above.
    3. **Which split.** Every split, each line plain or stacked, is weighed: its radius (the smallest circle about
       the lines, each centred; the first line 1.4 nibs further in, for the canopy's room; what stands in the
       cradle's bowl 1.2 nibs further in, and 2.13 nibs more under each nested bowl of 21), times (1 - 0.04 for
       each line that ends in a bowl letter, not the first line, above the cradle's: two at most), times (1 + 0.5
       x the mean share of its chord that a line leaves empty, the chord taken 3 pen units over its baseline),
       times (1 + 0.06 for each stacked word: the calm of plain lines is worth that). The least is taken; if its
       bowl cannot be drawn clear, what stands in the bowl is lifted (0.4, 1.2, 2.2, 3.5, 5 pen units); if that
       fails, the next of the six best.
    4. **The first line's stem.** Where the canopy's letter (2) is a stem, or may be one that stands in the first
       two letters of its word, the first line is slid to the right until that stem stands 3 nibs right of the
       axis.
    5. **Two ground lines.** Over a line that has two tall stems or more, the gap is opened as far as the circle
       of 18.3 lets it (at most the height of that line's shortest stem; all such gaps by one share), and the
       stems of every line but the first rise as in 11: each until it comes within 0.3 nib of the ink above it or
       meets the margin, never past the baseline of the line above less 0.55 nib, not at all by less than 0.15 of
       its height; halved (twice at most) until the line is clear, else left. The first line's stems rise to the
       rim, the lower lines' to the first line's feet.
    6. If no split stands (a cradle on the first word, a bowl that cannot be drawn), the text is set on level
       lines at one pitch (15.5 pen units at least), as in round two.
19. The canopy, if 2 gives one for the first word of the top line, is drawn from where that word stands (stem,
    entry, or roof drawn out); shortened at its tip until it is CLEAR of the writing; dropped if it cannot be.
    (r3) A roof that cannot be drawn out clear of its own word (a stem stands beside it) gives way to that word's
    first stem, which carries the canopy. A stem's arc is not drawn if its neck would come within 0.3 nib of a dot
    of its line.
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
    along it to the right (its pen: 28a); it ends as high on the right as it landed on the left (at most 80 degrees
    from the bottom), or, with nothing in it, just past the line it holds; the last 5.6 nibs thin to a tip that
    lifts 0.9 nib off its circle. Its dots: by A6.
24. **The canopy from a stem or an entry**: the cradle's stroke turned half round. From a stem's top (risen until
    its split stands 2.5 to 4 nibs inside the rim's circle) or from an entry (the first stroke taken over where it
    has 0.9 of the pen's weight) the stroke climbs to the rim's circle, runs over the top and ends 25 degrees left
    of the top; it follows the rim for at least 40 degrees, and on a small circle for at least the least length a
    stroke that thins to a tip can have (9.3 nibs). A stem carries the canopy only if its top stands at least 5
    degrees right of the top of the circle: the arc must cross the top. Left of that the stem only rises.
25. **Arcs scaled to the circle** (r3; round two's rule 25, dots that ride an arc, is withdrawn: an entry is led
    only into a letter with no dot above it, 2). A stroke that follows a circle is drawn with a lighter pen the
    smaller its circle: so an inner arc is lighter than the arc outside it. (r4) With no threshold: the pen's
    weight is v / (1 + v^4)^(1/4), v the circle's radius (to the pen's middle) over 9 nibs, never less than 0.55:
    0.72 at 7 nibs, 0.84 at 9, 0.93 at 12, 0.97 at 15, the full pen on a large circle. (The layout is found with
    round three's weight, the radius over 9 nibs and at most the full pen, which is never lighter: 28e.)
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

Round four (r4): the strokes the owner named on round two's drawings, which no arrangement could mend.

- **28a. The pen of an arc is the fixed pen.** The nib is not turned with the rim: every arc (cradle, canopy, the
  nested arcs, a tail running forth) is written with the line's own pen, held at its 69 degrees all the way round,
  as every other stroke is. So an arc thins and swells of itself: full where the rim runs level (a little past
  12 and 6 o'clock), a hairline where the rim runs along the nib (near 3:40 and 9:40). A cradle comes down from its
  letter thin, swells along the bottom and thins up the right side; a roof drawn out to 9:30 ends in a hairline.
  Where the fixed nib would lie more squarely across the stroke than the turned pen did (0.93 of the nib), the
  stroke is lightened to that. On its way from its letter to its circle the pen's weight passes evenly from the
  letter's to the arc's over the whole way, not within the first 2 nibs.
- **28b. A risen stem is one stroke.** A stem is not cut and pieced out with a shaft of one weight. The stretch of
  its skeleton between its split and its foot is drawn out whole: a point at the share u of that stretch stays at
  u and is moved up by e(3u² − 2u³), keeping the pen's weight it had, so the taper of the written stem is the
  taper of the risen one, spread over its length. The foot is the end of the upright run, no lower than 1.9 nibs
  above the line where the stroke runs on into a join or a bowl, 0.75 nib where it ends at the line (an alif). A
  stem of one weight down to its join (a lam) has no such stretch and is lengthened by a straight shaft, as before.
  The same on a meridian (F). Measured: no turn over 6 degrees from one sample to the next, no step in the weight
  over 0.06.
- **28c. A stem turns into its arc as one stroke.** Where a stem carries a canopy or is bowed over (24, 27, 33),
  the nib comes from the stem's pen (38 degrees) to the line's (69) as the stroke turns: by the share of its way
  round to the rim's direction that the stroke has gone; and the stroke's thickness passes evenly from the stem's
  to the arc's over the whole climb. No swelling and no waist at the shoulder (measured: the thickness changes by
  less than 0.03 nib from one sample to the next through the turn, and stays between its two ends).
- **28d. A letter written bowl first is taken over from its head.** The engine writes a final or isolated ج ح خ
  from the line down round its bowl and up into its head. As a cradle it was taken over where its stroke first
  leaves the line, and lost its head: a stub and a bowl. Such a letter (its stroke starts at the line, goes down,
  and after its lowest point rises 1.9 nibs or more above the line) is turned round and written from its head:
  the roof and the slope back are kept, and the bowl is taken over where the slope comes down across the line. A
  joined one keeps its join, drawn on along the line to that crossing. This is the one change of round four that
  moves a layout: the line of such a cradle is wider by the letter's head.
- **28e. An initial ح ج خ is open.** The engine's long-headed initial hah is a closed leaf (the roof, down the left
  side, back along the line, up to close) and reads as a loop. The side that closes it is not drawn: from where
  the stroke, past the roof's top, heads more down than along, to where it heads back to the right.
- **28f. The layout does not move with the pen.** Every clearance and every circle is measured with the strokes
  as round three drew them (the shaft of one weight, the pen turned with the rim, the closed hah); the arrangement
  found is then drawn once more with the strokes of 28a to 28c and 28e. Those lie inside the strokes it was found
  with, but for the even passage of 28a and 28c on the way to a lighter arc, where the stroke may be up to 0.15 of
  the pen heavier (under 0.1 pen unit to a side). `WIDE_TURNED=1`, `WIDE_RODS=1`, `WIDE_CLOSED=1` draw each as it
  was.

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

36. (r3) The engine writes a line the same whatever it wrote before (mended in `src/`), so every line is written
    by the one shared engine and kept; the engine-per-line helper of round two is gone. Five texts drawn both ways
    are the same bytes.

## H. Speed (r3; no drawing changes)

37. Each stretch of words is written once and kept with its hull; the lowest place of a line in a circle is found
    on the hull. A text is composed once for each set of options.
38. A ground line's first arrangement is not looked for beyond the largest circle its caller would take: 1.25
    times the level lines' circle for a rung (14), 1.12 times the base for an inner arc (27).

## How sure each threshold is

Round two's notes on 1.25 (14), 5 degrees (24), 50 degrees (27), 5 nibs (10, 28) and the curved stems (35) stand;
none was re-derived. New or changed in round three, on the 43 texts that could be looked at:

- **0.2 of the height empty under a bare ground line (14).** Lowered from 0.4 because the owner graded the texts
  it had let through (a line across the middle, the lower part bare) poor. Two texts stood at 0.31 and now go to
  tiers; single words taken stand at 0.05 to 0.19; rungs refused stand at 0.22 to 0.29. Any value from 0.20 to
  0.21 gives the same results: it is pinned by one text on each side. Weak.
- **0.06 of the radius for a stacked word (18.3).** At 0.03, five of the long texts stacked a word or two and
  looked busier for a circle 3 to 4% smaller; at 0.06 one text stacks (two words, a circle 29% smaller). Set by
  eye on those six; the owner's "do not trade calm" decided the direction, not the value.
- **0.5 for the empty share of the chords (18.3).** At 0.5 two long texts come out as five short lines in a
  column; at 1.2 they come out as three wide lines with the lower third of the circle bare. Neither is right; 0.5
  was kept because every text had been looked at with it. Unsettled.
- **1.15 for a single word's arc (16).** One word is refused an arc at 1.40; the words that keep theirs stand at
  1.00 to 1.11. Any value from 1.12 to 1.39 gives the same results.
- **9 nibs and 0.55 for the lighter pen (25).** Not fitted: 9 is the brief's "about 9 nibs"; only strokes on
  circles under it change, by 5 to 30%.
- **3 nibs for the first line's slide (18.4).** Not fitted; chosen so that the stem stands more than 5 degrees
  right of the top (24) in every circle up to 34 nibs.
- **0.12 nib and the list of moves for a touching dot (6).** The threshold is "touching" on a raster of 8 cells
  to the pen unit; the moves were not tuned.

## Known gaps (stated so that they are not mistaken for rules)

- **Nesting inside the text is not built.** A word that follows a bowl letter in mid-line does not sit in that
  bowl (a bowl drawn a little deeper under its guest). Bowls nest only along the rim (21, the cradle, the
  sub-cradle). The tiers favour a line that ends in a bowl (18.3), and that is all.
- **Stacking is rare.** Under 18.3's cost for a stacked word, one text of the 43 stacks. Where a line is all tall
  stems there is no bay for a stacked word, and it stays on the line.
- **A kashida to fit a word to its chord is not built**, nor a single word with both an entry and a tail.
- **Dots as weights were not built**, by the owner's ruling on round two (a dot stays with its letter).
- **A roof cannot pass a stem beside it.** The arc would have to climb four nibs in two. The stem carries the
  canopy instead (19); where that stem stands left of the axis and the line cannot slide (18.4), the word has no
  canopy.
- **Two-word texts with no bowl** get a canopy from a stem if they have one (19); their final tails do not run
  forth, because the tail is taken over more than 5 nibs from the rim.
- **Single words with no arc** are honest and small: a word of three or four letters with no stem and no bowl
  stands in the middle of its circle with nothing drawn out.
- **Stroke faults the owner named** (r4): the stem pieced out of a head, a rod and a foot, the seam where a stem
  turns into the canopy, the final jim as a cradle and the closed initial hah are mended (28a to 28e). Not
  mended, because they are the layout's and not the pen's: a lam whose bowl is the sub-cradle and that stands at
  the left of its circle (the lam after the waw of وآل) has no room to swing its bowl to the left before it
  returns, so it still reads as a stem with a tail to the right; its weight is now the pen's (the stem, a thin
  descent, the swell along the bottom). A final mim's tail drawn out is now thin where it leaves the head and
  swells into its arc; the small spur where the engine's mim head meets its tail is the letter's own and is left.
- The lower lines' stems are straight (F curves only the first line's).

## Grading by the owner

The roundels of a round are graded by the owner on a page of their own
(https://claude.ai/artifact/WyJWzhb5PiRYTsUQ8vEKb2; source `docs/letters-first/grade.html`, published with each text's
picture as `img/<id>.png`). It shows one roundel at a time with three grades (I'd hang it / sound but weak / poor) and
a note, and shows the grade the rules' author gave only after the owner's. Grades are kept one document per roundel in
the page's collection `grades`, named `<round>__<id>`: `{ id, round, grade: 'good' | 'fair' | 'poor', note, t }`. Read
them back with ArtifactData (list, collection `grades`) and compare with the round's own verdicts: where the owner is
harsher, the note says what the rules miss.

### Round two (15 Nov 2026): what the owner's grades decided

Grades and notes are in `grades-round2.json`: 6 good, 23 fair, 7 poor (the rules' author had 11, 24, 1).

- **Order of precedence.** The letter is recognisable, with its dots in their classical place (three dots as a
  pyramid); then the circle is filled; then embellishment, only where a letter offers it.
- **How much licence, by length (owner's words, paraphrased).** One or two words are talismanic: beauty may lead, and
  a hard read is acceptable. A longer prayer must be legible, unless it is one a viewer recognises at sight (the
  basmala, the shahada), which may take more licence.
- **Opening arcs** suit letters whose tooth stays readable (the ب of the basmala); into ن ت ث they hide the letter.
- **Short texts** that leave the lower part of the circle empty are poor: start at the lower rim and fill upward.
- **Long texts on calm level lines** were graded good; do not trade their calm for devices.
