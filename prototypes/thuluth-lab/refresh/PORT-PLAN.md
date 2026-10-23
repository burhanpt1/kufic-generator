# Thuluth: what to port from the lab, in priority order

**For:** the Claude Code session on `burhanpt1/kufic-generator`.
**Compared against:** `main` at `7e1b1d0` (22 October 2026).
**Lab code:** in the refreshed export (`thuluth-export-repo.zip`, under `lab/`). Evidence: B's pairwise ratings
(`data/ratings/`: 148 ratings over 81 compositions).

## What the repo already has (keep it; don't re-port the lab's versions)

- **Letter fixes** (tall lam, flat isolated ba, shouldered medial kaf, two-eyed heh) and the **legibility checker**
  (`checker.ts`, `confusionMatrix`). Done.
- **In-word stacking:** `stack`, `stackAt`, pinned stacks, reading order for stacked pieces (`orderFault`), `noRise`,
  `topFirst`, `ceiling`.
- **Nesting in tails** (`nest`: after ra, zay, waw, ya), with drawn-out tails curving round what they hold. This is
  better than the lab's `nest` (which only adds cradle shelves in every final bowl): **keep the repo's**.
- **Great bowls, cradles, kerning, a companion text, tail-clash checks.**

The lab's main gap-fillers are between-word structure, marks, mirrored composition and judging. Below, in order.

---

## 1. Mark rules from the Arabic sources (port first: small, clear, rated)

**Evidence:** the same Light verse composition ranked **9th with the new marks and 26th with the old** (out of 63 at the
time). It's the cleanest single comparison in the ratings: same letters and layout, only the marks differ.

**Source:** the Egyptian Cultural Development Fund's notes on tashkil and ornaments in thuluth and naskh (cdf.gov.eg/khate).

**Lab:** `lab/marks2.js`, `solveMarks`.
- **Fatha length by its space.** After placement, measure the free run along the fatha's slant (blocked by letter ink
  within 0.9 nib, the field edge, other marks).
  - **Short:** 3.5 dots.
  - **Medium:** 5 dots, when the run is at least 6.
  - **Long:** 10 dots, when the run is at least 11, drawn with the main pen.

  A dot is the main pen's width. The repo's fatha (`marks.ts`, `fatha` shape × mark scale) is about 1.8 dots, shorter
  than the source's shortest. Options: `fathaRule`, `longFatha`.
- **Parallel fathas.** All fathas share one slant (already true if the angle is fixed; keep it so).
- **Three pens.** Vowels, signs and ornaments use about a third of the main pen (`markPen` 0.34, `signPen` 0.3); the
  long fatha uses the main pen.
- **Clarifying letters** (huruf idahiyya), under ح س ص ط ع ك م: `miniSign(c)` builds each from the engine's own
  isolated letter (`glyphFor(c,'iso')`), normalised to `SIGN_SIZE` 2.5. At half the main pen they became blobs, so
  they use the marking pen.
- **No fatha merely as filler;** ornaments come after text, dots and marks (the solver already orders things this way).

## 2. The dagger alif on الله (port with 1)

**Problem:** the repo's `alifk` (`marks.ts` line 22) is a long thin wisp floating above the shadda. In thuluth it's a
short, firm stroke seated on the shadda, one compound mark over the doubled lam.

**Lab:** `lab/roundel.js` `MARK_SHAPES.alifk` and `lab/marks2.js`.
- **Shape:** `[[0.16,1.0,0.55],[0.06,0.3,1],[-0.04,-0.55,1],[-0.08,-0.95,0.7]]` at 0.8 scale (`alifScale`).
- **Pen angle:** the **stem angle, 38°** (at the marks' usual 70°, a near-vertical stroke comes out at its thinnest).
- **Pen width:** **half** the main pen (`alifPen` 0.5).
- **Placement:** after solving, it is seated on the shadda of the same letter, as one compound mark.

## 3. Reading paths with fitted lanes, and the reading rules (the one structural idea the repo lacks)

**Evidence.** The best basmala, salawat and الحمد لله رب العالمين in the whole set came from fitted horizontal lanes,
and they read top to bottom, which B wants.
- **The salawat** (six words) had defeated every earlier approach: words scattered, or one long line, or a diagonal
  lean. Lanes fixed it: اللهم صل, then على محمد, then وآل محمد, interlocked and filling the circle.
- **The basmala on three lanes** had the lowest noise of any composition (+0.12).

**Concept.** A **path** is the composition's spine: one or more strokes in reading order, with pen lifts between them.
Each word gets a target point along it in proportion to its width; the composer keeps each word's centre within a
tolerance of its target. Letters still stack, dip and interlock around the spine. Reading order is right by
construction. This sits **on top of** the repo's in-word stacking and ordering; it replaces only the between-word
layout.

**Lab:** `lab/roundel.js`.
- `pathTargets(path, widths, fill)`: targets by word width; the path is scaled so its length is `fill` (0.7) of the
  text's width.
- `PATHS`: line, diagonal, zigzag, bolt, cup, and lane sets.
- `lanes(deg, n, gap, R)`: n parallel chords of the field's circle at angle deg (180 = right to left), spaced gap
  apart, sorted upper lane first. Outer chords are shorter, so lanes fill the disc.
- **`composeRoundel` options:**
  - `path`: an explicit path.
  - **`lanes: { deg, n?, bandFrac? }`: fitted lanes.** It tries 2–4 lanes at spacings 0.3–1.05 and keeps the set
    whose bands are about a word high (`bandFrac` 0.75 × mean word height), whose total length is about the text's,
    and which span the field (about 1.85).
  - `pathTol` 1.4, `pathW` 0.6.
  - **Words start at their targets,** not in a line. This is essential for convergence.
- **The reading rules in path mode** (both needed):
  - **The eye reads across** (`readRule`, `readW` 1.5): a later word at about the same height as an earlier one
    (baselines within 0.45 × mean word height) must lie to its left.
  - **No climbing back** (`orderFirm` 3, `orderSlack` 1.0): a later word's baseline may not sit more than 1 unit above
    the one before.
  - **Use baselines,** not bounding boxes. Tall alif and lam stems make word boxes overlap, so box centres misjudge
    which storey a word is on. This caused two rounds of bottom-to-top results.
- **Default: top to bottom.** B's stated preference. (Derman describes Ottoman istif as built from the foundation up;
  B prefers top to bottom.)

**What not to port from this area:**
- **Parallel diagonal lanes,** at any angle (45°, 60°, 70° tried). Words from neighbouring lanes sit side by side at
  the same height and the eye reads them as a pair. In the basmala, الرحمن read beside الله, then beside بسم. Even both
  reading rules couldn't overcome the path's pull. Horizontal lanes, or sloping lanes whose height ranges don't overlap
  (`stag2`, `stag3`), read correctly.
- **The storey model** (`storeys`, `fromTop`, `minStoreys`, storey balance and interlock in `roundel.js`): superseded
  by paths. Its failure modes (six-word texts scattering, a single line, a diagonal staircase) are why paths exist.

**Calliar reading paths.** `data/calliar_paths.json` holds 63 master routes.
- **Method:** letter centres in writing order, split where the route jumps back right (pen lift), smoothed within each
  storey to remove the stacking zigzag, then simplified.
- **Flipping:** 35 of 63 climb from bottom right to top left (the Ottoman build); those are flipped to read top to
  bottom.
- **Shapes:** `data/calliar_picks.json` holds five distinct shapes.
- **Results:** the sharp V (`calliar3`) gave the densest, quietest compositions for all three texts. But it climbs
  before descending, so words on the rising stretch can land above earlier ones. Fix that (start the path at its
  highest point, or flip rising stretches) before relying on it.

## 4. Mirrored compositions (müsennâ), combined

**Evidence:** the combined mirrored علي (cup form) won all six of its games and ranked **2nd of 81**. The same
composition drawn without combining ranked 29th.

**The principle** (B's): in a mirrored composition the halves are one design. Whatever falls on or near the axis is
shared, not doubled.

**Lab:** `lab/deco.js`.
- **`musenna(text, o)`:** compose once, set against a vertical axis with an overlap, mirror, and rank candidates with
  the critic.
- **`renderMusennaCombined(c, o)`:**
  - **Dot groups:** dots within about 1.6 nib form a group, like a ya's pair. A group that overlaps its own mirror image
    becomes one shared group with the **same number of dots**, symmetric about the axis, drawn as diamonds (45°). A
    pairwise merge chained four ya dots into one; group-wise fixes it.
  - **Marks:** one that overlaps its own mirror image is centred on the axis and drawn once. **If it is asymmetric
    (fatha, kasra) it is left out:** a slanted mark on the axis breaks the symmetry, and vowels are optional in
    decorative work.
  - **Strokes:** a letter stroke within about a nib of the axis that overlaps its own mirror image becomes **one
    shared stroke on the axis** (`shareStrokes`). In علي the two lams become one central stem, the classic
    construction.
  - **Mirrored marks** are drawn with the mirrored pen angle (180° − angle), so thick and thin mirror too.
- **Choosing texts:** mirroring works when a tall stroke can be shared on the axis (the lam of علي). It's weak when the
  halves only face each other: the mirrored محمد reads as a horned mask; combining didn't rescue it (29th and 35th).
- **Owner's decision:** do **not** generate mirrored compositions of **الله** (possibly controversial).
- **Don't port:**
  - **Double symmetry** (`quad`): lost all six games, combined or not.
  - **Hairline piercing in mirrored work:** B wants overlaps to combine, not weave.

## 5. The critic, the noise measure, and the rating loop

**Why:** it lets the repo's breeding engine select with B's taste.

**The critic** (`lab/deco.js`, `decoMetrics(ink, field, W, H)`). It reads only an image, so it can also judge a
master's photograph. Its features:
- **Texture evenness:** ink blurred over about an eighth of the field.
- **Knots:** share of the field above 2× mean density.
- **Looseness at the top.**
- **Stem spacing:** this feature never fired on these compositions; rebuild or drop it.
- **Unity:** the share of ink in the main body.
- **Span and fill.**

Judge letters first: measure texture and unity on letters and dots, and count ornaments only towards how evenly gaps are
filled (`rasterUnits(..., 'letters')`).

**Noise** (`tools/noise.py`) is B's word for unresolved contact. It is the standardised sum of two measures:
- **Notches:** tiny gaps where strokes nearly touch (closing with a disc of radius 2 px at 480 px).
- **Pinholes:** enclosed holes under 40 px.

Measures that failed to track B's choices:
- **Fragment counts, edge length and fine detail:** they can't tell intended richness from noise. Dense istif is full
  of marks.
- **Thin slivers:** they track thin strokes, which B rewards.

**Fitted to B's ratings** (logistic regression on pairwise differences of standardised features; leave-one-out tested):
- **Accuracy:** 76% from the critic, 77% with noise. The hand-set weights managed 66% at 68 ratings, and accuracy rose
  as ratings grew.
- **Weights:**

  | Feature | Weight |
  |---|---|
  | Texture | +0.63 |
  | Knots | −0.53 |
  | Looseness at top | +0.04 |
  | Unity | **+1.41** |
  | Span | +0.34 |
  | Fill | −2.50 |
  | Noise | **−0.93** |

  (`data/ratings/noise_fit.json`.)
- **Calibration caveat:** the critic scores the Husayn master roundel lowest, because its texture rules describe dense
  istif. A single-name roundel built on one great gesture is a different genre.

**Negative result, don't repeat:** fitting to synthetic "good versus damaged" pairs got 4 of 5 real judgements wrong.
Collapsing a composition raises unity, scattering lowers it, so the damage types disagreed. Use real ratings only.

**The rating loop:**
- **The page** (`tools/rating-page.html`) shows two compositions; each tap is saved to the published page's database
  (`db` capability, collection `votes`, rows `{a, b, w: 'a'|'b'|'tie', t}`). It shows least-rated items first, never
  repeats a pair, and supports undo.
- **Analysis:** `tools/bradley_terry.py` ranks items from the votes.
- **Why a database:** B lost an earlier set of ratings that lived in browser storage. This design is the fix. Build it
  into Studio if possible.

## 6. The learned stacking prior

**Lab:** `lab/tarkib.js`, `STACK_PRIOR`, `stackWeight`, with `LEARNED_STACK` and `STACK_MIN` 0.2.

**Data:** stacked-join rates from 70 Calliar thuluth compositions, by the letter after the join (362 joins):
ra/zay 0.56, hah 0.44, mim 0.40, final nun 0.31, waw 0.27, final ya 0.22. Everything else is under 0.13.

**Use:** weight the repo's `stack` moves towards the joins masters actually stack. It lowered composition energy for
the Panjatan names.

## Later, as options rather than defaults

- **A girift dial** (`girift: k` in `lab/roundel.js`): a stem crossing a horizontal earns −k per pixel; overlap
  touching a curve or eye costs 1.6. B ranked two dense "collapsed" basmalas (k = 0.12) **4th and 5th**, so
  interpenetration should be adjustable. k = 0.04 is the safe default.
- **Towers** (`towers` in `lab/tarkib.js`): three stacked joins in one letter group. They need long connected runs
  (الحمد, محمد, العالمين), and rarely win at normal stacking pull.
- **The Timurid band:** jali thuluth with a Kufic line in the upper zone, the thuluth uprights passing over it with a
  hairline. Built from the repo's own thuluth and Kufic line fills; unrated.

## Don't port

- **Silhouette fields** in their current form (`silhouette: 'pear'`): rated low, and marks still assume a circle.
- **The cradle move combined with storeys or paths:** it teleports whole words across the field.
- **The storey model:** superseded by paths, as above.
- **Hairlines in mirrored work; double symmetry; parallel diagonal lanes.**

## Results to keep in mind

- **B's preferences:**
  - Compositions should read **top to bottom**.
  - Dense many-word istif and the new marks hold the top of the ratings.
  - Noise counts against a composition. Thin, elegant strokes don't.
  - No mirrored الله.
- **Run several seeds and let the critic choose.** In almost every test one seed worked and another didn't.
