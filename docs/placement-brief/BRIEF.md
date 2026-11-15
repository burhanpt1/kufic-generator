# Placing calligraphy in a space

## The question

Given a short Arabic text written in a formal pen script, and an empty circle, where should each word go?

We want an answer from first principles: a way of placing words that a reader finds legible, reasoned and
beautiful, and that works for any text, not only the examples here. Do not start from an existing method, ours or
anyone's. Start from what you believe makes writing in a bounded space readable and pleasing, say what that belief
is, and build a procedure on it.

You do not need to read Arabic or to draw letters. The words are given to you already written.

## What you are given

`kit.json` holds four texts. Each is a list of words in reading order, and each word is a filled outline.

| id        | words | what it is             |
| --------- | ----- | ---------------------- |
| `names`   | 2     | two names              |
| `basmala` | 4     | a four-word invocation |
| `salawat` | 6     | a blessing             |
| `ikhlas`  | 15    | a whole short chapter  |

What you need to know about the writing:

- **Direction.** Arabic is written and read from right to left. Inside the kit, a word starts at its origin
  `(0, 0)` and runs toward negative `x`. The first word of a text is read first.
- **Units.** Everything is in pen units, `y` up. `nib` (1.6) is the width of the pen that wrote the words; it is
  the natural unit for spacing.
- **The line of writing.** Each word was written along the line `y = 0`. Tall strokes rise well above it (to about 10) and tails and bowls fall below it (to about −7). `box` gives each outline's extent.
- **Variants.** Some words come in two or three `variants`: the same word with a stroke drawn out longer. They are
  the same word and read the same; you may use any one of them.
- **Outlines.** `polys` is a list of closed polygons, `[x, y]` points, filled by the non-zero rule (a hole is wound
  the other way).

## The task

Design a procedure that takes a text from the kit and places its words in a circle, and run it on all four texts.

For each text you choose the circle's radius and, for each word, which variant to use, where its origin goes, how
far it is turned, and its size. A smaller circle for the same words means larger writing.

## Rules

1. Every word of the text is placed exactly once, whole, in one of its given variants.
2. Every word lies inside the circle.
3. No two words touch: their inks stay at least 0.3 of a nib apart.
4. A word may be moved, turned by any angle, and scaled between 0.5 and 1. It may not be mirrored, sheared or
   redrawn.
5. Nothing is added: no lines, ornaments, marks or extra copies of words.
6. One procedure produces all four layouts. It must be a procedure, not four arrangements made by hand, and it must
   give the same result each time it is run.

## How it will be judged

A person will look at the drawings from every entry side by side, without knowing whose is whose, and ask:

- **Can it be read?** Is it clear where to start and which word follows which?
- **Does it look reasoned?** Does the arrangement seem to follow from an idea, or do the words look dropped?
- **Is it beautiful?** Balance, rhythm, the shape of the empty space, how the writing sits in the circle.
- **Does it use the space?** Large, confident writing in a well-filled circle, or small words in an empty one?

Then the procedure itself is read: is the idea clear, and would it hold for a text or a frame it has not seen?

## What to return

1. **`placements.json`**, in this form (see `example-format.json`, which shows the format only and is not a
   suggestion):

   ```json
   {
     "entry": "a-short-name",
     "principle": "One paragraph: the idea your procedure follows.",
     "reading": "One sentence: how a reader finds the order of the words.",
     "layouts": {
       "basmala": {
         "radius": 30,
         "words": [{ "variant": 0, "x": 12.5, "y": 4, "rotate": 0, "scale": 1 }]
       }
     }
   }
   ```

   `words` has one entry per word, in the kit's order. `x`, `y` is where the word's origin goes, measured from the
   centre of the circle. `rotate` is in degrees, counter-clockwise, about the origin. `scale` is about the origin.
   Include all four texts.

2. **The procedure**, as code or as steps precise enough for someone else to implement, including how every number
   in it was chosen.

3. **One page of reasoning:**
   - the principle you started from and why;
   - how a reader is meant to find the order;
   - what happens with a text of one word, of thirty words, and in a frame that is not a circle (an oval, a square,
     a pointed arch);
   - where your procedure fails or looks poor, as you see it yourself.

## Checking your work

`node kit.mjs placements.json out/` (Node 18 or later, nothing to install) draws each layout as an SVG and reports
whether every word is inside the circle, how much ink is touching, how much of the disc is filled, and the radius in
nibs. Look at the drawings. An entry that breaks rules 1 to 3 is set aside.
