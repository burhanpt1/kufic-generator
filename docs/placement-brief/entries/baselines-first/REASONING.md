# Baselines first

An entry for `../../BRIEF.md`. `node procedure.mjs` writes `placements.json`; the steps and every number are at the
top of that file.

## The principle

A reader does not find the order of words by looking at where each one is. They follow a line, and when it ends they
take the next line. So the one thing an arrangement must give the reader is lines. Everything here follows from
that: the words stand on a few level lines at one even pitch, each line centred, and nothing is placed anywhere
else. No word is turned or resized.

What is left to choose is small and can be searched completely: how many lines, where the text is cut into them,
and how long each word is drawn. All three are chosen for one aim, the largest writing the circle will hold. A
circle is widest across the middle, so a cut whose lines are short at the top and bottom and long in the middle
fits best; the cost that picks the cut says so directly (the radius, raised by how far each line falls short of the
circle's width where it sits).

Two measurements are made on the ink and not on boxes, because boxes waste the space that writing with tails and
tall strokes leaves open. On a line, a word is set a fixed clear distance from the ink before it, so it runs in
over a tail. Between lines, the pitch is the least at which the inks of neighbours stay a fixed distance apart, so a
descender drops into a gap in the line below.

## How a reader finds the order

Start at the top line and read each line from right to left.

## Other texts and frames

- **One word:** one line, centred; the circle is the smallest round it.
- **Thirty words:** the search over cuts grows quickly (it is every way of cutting the words into up to seven
  lines), so past about twenty words it would need the usual line-breaking shortcut: best cut of the first k words
  into j lines. The result would be six or seven lines of small writing: correct, and dull.
- **An oval, a square, a pointed arch:** only two things change: the smallest frame of that shape round the ink, in
  place of the smallest circle, and the frame's width at each line's height, in place of the chord. A square gives
  lines of equal length; an arch gives a short first line and long lower ones.

## Where it fails or looks poor

- It is plain. It is a justified block that happens to be round; it has none of the stacking, interlocking or great
  sweeping strokes that make a calligraphic composition more than set text.
- The even pitch is set by the worst pair of lines, so one deep tail or tall stroke opens every line.
- A line is only ever lengthened by drawing a word out, and only some words can be: a short line of fixed words
  stays short (the two lower lines of the basmala).
- Lines are centred on their ink's extent, not its weight, so a line with a long thin tail at one end looks pushed
  to the other side.
- The fill is low (about 14% ink): the corners between a block of lines and a circle stay empty.
