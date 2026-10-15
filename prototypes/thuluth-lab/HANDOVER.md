# Thuluth engine: handover for kufic-generator

**Audience:** the Claude Code agent bringing thuluth into `kufic-generator`, working from the repo briefing (snapshot `e20ec5b`, 2026-10-15).
**Source:** a chat-based lab (plain JavaScript, run in headless Chromium), built 2026-10-12 to 10-17 alongside the Kufic lab.
**State:** working and deterministic, but a lab: shared globals, canvas rasterisation, no types, no tests. The output is
good enough that the owner used it for a family wedding piece (Zainab and Qusay, nikah 24 October 2026).

---

## 0. In one paragraph

The thuluth engine is a **pen-stroke engine, not a font**. Each letter form is a short list of skeleton control points
drawn with a broad-nib model (fixed nib angle, width, minimum-thickness floor). Letter skeletons come from three layers:
hand-drawn, averaged from an MIT-licensed calligraphy stroke dataset (Calliar), and fitted to photos of historic master
calligraphy. On top sit joining and kashida, a stacking (istif) composer, a roundel and cartouche composer with a global
dot and vowel solver, bowl shaping and frame fitting, counter fills, and a quasi-periodic tile-pattern generator with
8-, 10- and 12-fold symmetry. Nothing here uses HarfBuzz or font outlines. To enter the repo it needs: a pure
(non-canvas) rasteriser, its globals turned into an explicit style object, and an adapter onto `ScriptEngine` that
returns `VectorStrip`s.

## 1. What's in this export

```
HANDOVER.md                  this file
PROMPT.md                    a prompt for the first Claude Code session
lab/                         the engine, one file per concern, concatenated in order by build-bundle.sh
  engine3.js                 pen model, letter tables, shaping/joining, kashida, line renderer
  tarkib.js                  stacking (istif): letter groups, group shapes as typed raster masks, variants, line composer
  roundel.js                 roundel/cartouche composer (simulated annealing), finishRoundel, renderer, fixed layouts
  ring.js                    inscription ring (text bent round a circle, pen turning with it) and illumination (rays, panel, Iznik)
  marks2.js                  global mark solver: dot groups, vowels, ornaments (plume, tirfil), density, crowding items
  iznik.js                   Penrose (Robinson triangle) tiling + Iznik dressing (older, 5-fold only)
  counters.js                counter detection (enclosed letter spaces) and the inscription-band renderer
  multigrid.js               de Bruijn multigrid tilings (any 2N-fold) + rotation-invariant Iznik dressing
  fitted.js                  letters fitted to masters (waw, ain, medial mim, hah family, sad loop) and roundel gestures (GREAT)
  learned.js                 letters averaged from Calliar, which forms to use, loop enlargement, the master/learned/hand switch
  bowl.js                    shapeBowl, fitFrame, crowding, scaleGroup, groupBox, placeUnder
  style.js                   (optional) 15-parameter style layer used by the ranking experiment
  fit.js                     (optional) the photo fitter, fitGlyph
data/
  learned-all-styles.json    per letter form: mean skeleton of the 25 nearest neighbours of the most typical instance
  learned-thuluth.json       the same from 70 hand-labelled thuluth samples (used where a form has 10 or more instances)
  calliar-thuluth-samples.json  which Calliar files were labelled thuluth (by eye, 180 reviewed)
  fits/*.json                fitted skeletons (scale, position, IoU before/after); images stripped
  targets/*.json             photo-derived letter masks used for the fits (owner's photos)
layouts/zainab-qusay.json    the pinned wedding cartouche: layout record plus the full recipe to rebuild it
tools/
  photo_mask.py              photo -> letter mask (blue tile ground, gold ground, black ink); crop a letter target
  fit_letter.py              fit an engine letter to a target in headless Chromium
  render_reference.py        render the reference set twice and check determinism
  calliar_extract*.py        Calliar -> per-form instances (scale by alif, form from connections, pen direction)
reference/
  golden/*.svg               22 lab references: line specimens (two pens), the wedding cartouche, three tilings
  images/*.png               milestones and known issues (see §11)
```

Run anything with `lab/build-bundle.sh`, then load `thuluth-lab.bundle.js` into a page (or Playwright) and call
the functions directly. `tools/render_reference.py` is the quickest end-to-end check. It renders the set twice, and it
currently reports **deterministic**.

## 2. What it can do (proven in the lab)

- **Lines:** any Arabic text with the supported letters, joined, with kashida and dots. `renderLine(text, opts)`, `buildStrokes(text, opts)`.
- **Vowelled text:** `parseVowels` splits harakat from letters; the mark solver places them (fatha, kasra, damma, sukun, shadda, tanwin, dagger alif).
- **Stacking (istif):** words broken into connected groups, groups stacked in 2 or 3 tiers, elongations with a shelf reward (`compose`, `composeRoundel`).
- **Roundels and oval cartouches:** fill a disc or oval, solve dots and vowels globally, ornaments in gaps, blessing text (companion) placed in free space.
- **Great bowls:** a returning ya or final nun redrawn along the frame's lower rim, with another word cradled inside it (after the Husayn roundel in Hagia Sophia).
- **Inscription rings and bands:** text bent round a circle, the pen turning with it; horizontal tile bands with stems on one top line.
- **Finishing:** turquoise counters, per-group colour (`tint`), frames fitted to everything drawn, illumination (rays, panel, Iznik tile panel for circles and ovals).
- **Patterns:** quasi-periodic tilings with exact 8-, 10- or 12-fold symmetry (de Bruijn multigrid), dressed with saz leaves, tendrils, hatayi rosettes, buds and stars.
- **Animation:** the pen writing the composition, quad by quad (`renderRoundel(..., { animate: true })`).

Published lab pages (owner's claude.ai account): thuluth roundels, learned letters, Zainab and Qusay after Husayn, the
nikah page, Iznik tiles, the pairwise style ranking page.

## 3. Lab architecture

### Data flow

```
text --parseVowels--> bare letters + marks
     --splitGroups--> connected letter groups per word
     --groupVariants--> per group: shapes at several stretch levels, stacked joins, emphasis variants
          (each shape = buildStrokes() strokes + a typed raster mask: stems / horizontals / other)
     --composeRoundel (or compose)--> group positions (simulated annealing over word moves, variant swaps,
          shelf and cradle placement; energy: overlap, order, aspect, fill, balance, shelves, noRise, ceiling)
     --shapeBowl (optional)--> great bowl redrawn to the frame; its dots inside, its vowels at its start
     --fitFrame / finishRoundel--> frame size; solveMarks places dots, vowels, ornaments
     --renderRoundel / renderBand / renderLine--> SVG (nib quads as polygons; counters under the letters)
```

### Key functions

| File | Function | Role |
|---|---|---|
| engine3.js | `buildStrokes(text, o)` | shaping, joining, kashida, lean; returns `{ strokes, dots, placed, dotGroups }` |
| engine3.js | `sampleStroke`, `nibQuads`, `nibPath`, `dotPath` | pen model: Catmull-Rom sampling (tension `CR_T`), quads per segment, minimum-thickness pass |
| engine3.js | `glyphFor(c, form)`, `FAM`, `FORM_FAM`, `T` | letter table lookup, scaled by `BODY` for non-stem families |
| tarkib.js | `splitGroups`, `groupShape`, `groupVariants`, `compose` | stacking machinery; `groupShape` rasterises (canvas) |
| roundel.js | `composeRoundel`, `finishRoundel`, `renderRoundel`, `roundelParts` | roundel composer and renderer; `o.fixed` rebuilds a recorded layout |
| marks2.js | `solveMarks` | global mark solver; rasterises ink (canvas); returns strokes, dots, items |
| bowl.js | `shapeBowl`, `fitFrame`, `crowding`, `scaleGroup`, `placeUnder` | finishing passes used by the wedding piece |
| counters.js | `findCounters`, `renderBand` | counters (canvas flood fill), tile bands |
| multigrid.js | `multigrid(N, reach, edge)`, `iznikField(S, o)` | tilings (pure: no canvas) |
| learned.js | `useLearned(on, scale)` | swaps letter forms into `T` (master > learned > hand) |
| fitted.js | `useGreat(on, which)` | swaps roundel gestures into `T` |

### Global state (the main porting hazard)

Mutable module-level state, set by callers between calls:

| Global | Meaning | Typical values |
|---|---|---|
| `T` | the active letter table (mutated by `useLearned`, `useGreat`, `applyStyle`) | |
| `BODY` | body scale for non-stem letters | 1.25 lines, 1.35 bands, 1.45 roundels |
| `NIB_FLOOR` | minimum stroke thickness as a fraction of the nib | 0.43 tile, 0.3 roundel |
| `LOOP_GAP` | baseline between two joined loop letters, in BODY units | 0.9 default, 1.8 wedding |
| `CR_T` | curve tension | 0.5 |
| `OPT` | `heh` final form, `slant` | `round`, `-0.06` |
| `LOOP_X`, `LOOP_Y`, `LOOP_GROW` | loop-head enlargement per family | grow 1.35, sad y ×1.3 |
| `USE_FITTED`, `USE_SAD_MASTER`, `USE_FA_MASTER` | layer switches | true, true, false |
| `MAX_COUNTER` | largest enclosed area filled as a counter | 9 |
| `gcache`, `RID` | glyph cache (must be cleared after any table change), renderer id counter | |

All randomness is seeded Park–Miller (`seed * 16807 % 2147483647`). One stray `Math.random` (an SVG pattern id in
`renderBand`) must go.

### DOM and canvas use (must be replaced for the repo)

Canvas is used only as a **rasteriser**: `groupShape` (collision masks), `solveMarks` (ink occupancy and distance field),
`findCounters` (flood fill), `fitGlyph` (IoU). Everything drawn is a polygon (nib quads, rhomb dots), so a small pure
scanline polygon filler at the same resolutions (K = 1.6 to 4 px per unit) replaces it. Expect small pixel differences
from canvas antialiasing; compare by pixel diff, not bytes.

## 4. Letters: layers, provenance and status

Resolution order when `useLearned(true)`: **master fits, then learned (Calliar), then hand-drawn**, per letter form.

| Family | Source in use | Status |
|---|---|---|
| alif | learned (iso, fin) | good |
| lam | learned (ini, med); hand (fin, iso) | good; learned final lam had no bowl |
| tooth letters (ba, ta, tha, nun and ya initial/medial) | learned | good; dots centred over their own tooth (`dotX`) |
| ba final, emphasised | hand `finLong` | long shallow sweep, tughra-like |
| nun final, ya final | learned bowls; ya final in roundels: `GREAT` bowl | good; great bowl only via `shapeBowl` |
| ra, zay, waw | learned; **waw fitted to master** | good |
| ain | learned; **initial ain fitted to master** | good |
| seen | learned (ini, med) | good |
| hah, jim, khah | **initial and medial rebuilt from the master's centreline** (gold panel), long-headed variant in `GREAT` (Husayn roundel) | good; old hah was confusable with ain |
| mim | hand, loops enlarged; **medial mim fitted to master** | acceptable |
| sad, dad | **loop rebuilt from the master's dad** (Husayn roundel blessing), hand tooth | good |
| fa, qaf | hand, loops enlarged | dense head at heavy pens; two redesigns rejected (read as kha and ain) |
| dal | hand | learned dal curved like ra (changed words), rejected |
| heh | hand | untouched; no clean master instance found |
| kaf | learned initial only; hand medial/final | **final and isolated kaf are wrong** (no shoulder; بارك reads as بارد). See §11. |
| tah, lam-alif, Allah | hand | acceptable |

**Calliar (learned layer):** about 2,000 samples of Arabic calligraphy recorded as pen strokes, MIT licence. Each stroke
is labelled with its base letter shape (dots separate), but not its form. Pipeline (`tools/calliar_extract.py`):
scale each sample by its alif height (alif = 10 units), read the form from connections to neighbouring strokes,
orient strokes by pen direction, resample to 48 points, then take the most typical instance and average it with its
25 nearest neighbours. Limits: centrelines only (no width); hand-traced and loose; styles mixed. Filtering to 70
hand-picked thuluth samples changed little, because annotators traced every style with the same simplified hand.
Calliar stores kaf only as its initial shape (other kafs are lam plus hamza), which is why the learned medial and final
kafs are wrong.

**Master fits (fitted layer):** analysis by synthesis. The engine draws the letter with the photo's pen; a search
adjusts control points, size and position to maximise IoU with the photo's ink, holding points outside the box and the
joins in place. Results: waw 0.67 → 0.83, initial ain 0.75 → 0.88, medial mim 0.57 → 0.73, Husayn great bowl and long
hah 0.20 → 0.55. Where the master's construction differed from the engine's skeleton (hah, sad), the letter was
rebuilt from the master's extracted centreline instead. Conversion to engine units: `k = engine_nib * s / nibPx / BODY`.

## 5. Pen and calibration

- Nib angle **69°**, measured from about 6,400 stroke samples in the owner's Topkapı photo (the engine's guess was 70°).
- Contrast depends on the medium: glazed tile about **2.5:1** (`NIB_FLOOR` 0.43), painted jali roundel about **6:1** (0.3 used, which keeps letters solid).
- Tall stems in the tile band are about 16 pen widths; the engine's alif is 10 units against nibs of 0.85 to 1.6.
- Vowels use a pen about 0.34 of the letter pen (traditional one third). Dots are rhombs of the full pen.
- Pens used: lines 0.95 to 1.1; bands 1.3; roundels 1.35 to 1.6.

## 6. Composition notes worth keeping

- **Stacking rules:** stacks before hah, jim, khah and mim; stems may pass through horizontals cheaply (`cross`); one long elongation per word, neighbours alternate; `noRise` keeps a later word from rising above the start of an earlier one; `ceiling` pulls all stems to one top line.
- **Roundel moves:** word shift, variant swap, shelf placement (a word sits on an elongation or a long final), and **cradle** placement (a word sits inside a great bowl). The cradle move is what let the composer find the Husayn structure.
- **Kerning:** pieces of a word broken by a non-joining letter slide together on **bare** ink (not the safety margins), allowing a light touch (`o.kern`).
- **Loop letters:** two joined loop letters always get a stretch of baseline (`LOOP_GAP`), or their loops merge.
- **Marks:** dots stay over their letter's centre and close to it; vowels sit beyond the dots on the same side; `markReach` keeps vowels near their letter; ornaments fill the largest gaps (`ornaments`, `density`).
- **Great bowls (`shapeBowl`):** lead out left of the join, drop in a broad open curve (a tight turn closes into a loop that reads as ta marbuta), follow the lower half of an ellipse clearing the other letters, rise on the right. The letter's dots go inside the curve; its vowels anchor at its start.
- **Frames (`fitFrame`):** the smallest oval holding letters, dots and vowels, searched over centre and proportions; marks re-solved inside it. Circles do not suit great-bowl compositions.
- **Fixed layouts:** `composeRoundel(..., { fixed: { lv, wp } })` rebuilds a recorded arrangement, so letters can be refined without the layout reshuffling. The owner relies on this workflow (pick a favourite, then refine it).
- **Speed:** roundel composition takes 20 to 60 s per text. Use the repo's worker pool.

## 7. Mapping onto the repo's `ScriptEngine`

### Units and axes
- **1 thuluth unit = 1 cell** (10 SVG units). The engine's alif is 10 units tall, comparable to Kufi ascenders of 9 to 13 cells.
- Strip coordinates **y-up**, matching the briefing. Emit `VectorStrip.paths` in strip coordinates, in cells, y-up, and document that the renderer flips. All paths are **straight-line polygons** (`M x y L … Z`): nib quads, the minimum-thickness quads, rhomb dots. They are already flat, so mapping every point through `placeMap` handles `line`, `arc` and `run`. Quads are short, so polar distortion is negligible; split long kashida quads if needed.
- Path roles: letter bodies and **dots → `letter`** (dots are part of the letterform); harakat → `vowel`; ornaments (plume, tirfil) → `mark`. `tag` = repeat + 1, as for Kufi.

### Prepared metrics and band sizing
Thuluth needs a taller band than Kufi: alif about 10 above the baseline, bowls 3 to 5 below, vowels 2 to 3 above the tallest stem. `bandRoom()`
assumes Kufi proportions (stem tops at `base + ascenders`, stems about 83 % of the band). Proposal: extend `Prepared`
with engine-reported metrics (`ascent`, `descent`, `markAscent`, `inkRows` or ink extents) and have `bandRoom`,
autoSize and border fitting use them when present. Lattice and strapwork centre by `Hb/2`; patternText and radial need
an ink-extent equivalent, which a vector engine can report directly.

### segments and layout
- `segments(prepared, 'words')`: one segment per word, `minW` = natural width (letters plus minimal kashida), in cells, rounded up.
- `segments(prepared, 'breaks')`: break segments at connected-group boundaries (after non-joining letters), consistent with the solvers' 1-cell in-word gap.
- `layout(segs, prepared, width)` must return exactly `width`:
  1. Lay out words at natural width.
  2. Widen with **kashida**, thuluth style: at most one long elongation per word, never on neighbouring joins, preferring joins after tooth letters (`kashMap`). Then distribute the remainder across word gaps.
  3. Narrowing below natural width needs stacking, which is too slow for the hot path. Return `null`, and leave stacking to dedicated fillers.
- The shared solvers (`partition`, `repeatSegs`, `greedyOK`) are generic enough to reuse once their types are loosened from Kufi's `Segs`.

### The rest of the contract
- `shape` / `prepare`: thuluth shaping is its own (`FAM`, `FORM_FAM`, `NONJOIN`, the lam-alif ligature, Allah); `Shaped` is Kufi-specific. Make it opaque or generic.
- `abjad`: the same values as Kufi; share the function.
- `capabilities`: `{ grid: false, seals: false, mazes: false }`.
- `id`: `'thuluth'` (monogram memo keys include it).
- **Purity:** no canvas, no DOM; the letter table and style passed explicitly, not via globals; no hidden state between calls.
- **Determinism:** keep Park–Miller everywhere; replace the `Math.random` pattern id.

### Beyond ScriptEngine
Roundels, cartouches, great bowls, rings and bands are **compositions**, not strips. Bring them in as fillers or
features (a thuluth roundel filler for circle and oval regions, a ring feature, a band border), each returning placed
vector items. This also meets the long-standing plan of a thuluth roundel as a filler inside a Kufic composition: a
Kufic ring round a thuluth centre is the owner's favourite combination.

## 8. Suggested PR sequence

Adapted from the briefing's §6. Each PR is small, ships a demo page, and changes no Kufi golden.

1. **Vendor the lab as a prototype.** `prototypes/thuluth-lab/` with this bundle, plus pixel-diff lab references (like `tests/golden-lab/` for Kufic) from `reference/golden/`. No `src` changes.
2. **Pure rasteriser and core port.** `src/script/thuluth/`: pen model, letter tables as data (with provenance), shaping and joining, kashida, a scanline polygon filler. Tests: determinism, line output matching lab references within tolerance.
3. **The `ScriptEngine` adapter.** `src/script/thuluth.ts` returning `VectorStrip`: `segments`/`layout` width invariants (exactly `width`, or `null`), metrics in `Prepared`.
4. **Registry and schema.** `style.script` enum, engine lookup in `resolve`, a script-keyed style union (thuluth needs `pen`, `body`, `floor`, `loopGap`, `letterSet`, not Kufi's switches).
5. **Vector rendering.** Map polygons through `placeMap`, colour by `tag`, keep layers; critic, space and fabricate read vector ink via the new rasteriser (or opt out explicitly). Thuluth goldens for a few borders and line fills.
6. **Gating and evolve.** Capabilities for pattern-text, plait, terminals and stroke styles; script-aware genes.
7. **Thuluth roundel filler.** `composeRoundel`, the mark solver, `shapeBowl`, `fitFrame`, counters, tint; pinned layouts saved in the composition. Run in the worker.
8. **Patterns.** The multigrid tilings and Iznik dressing as a ground or pattern source, shared with Kufi.
9. **Legibility tests and letter fixes** (kaf first), as rules the engine must keep.

## 9. Tests to write

- **Determinism:** same input and seed ⇒ identical SVG (the lab already passes).
- **Lab references:** pixel diff against `reference/golden/` within a tolerance; byte equality won't survive the rasteriser change.
- **Width invariants:** `layout` returns exactly `width` or `null`; `minW` consistent with solver gaps.
- **Legibility rules,** each a mistake caught by eye during the lab:
  - every letter has its dots (count per letter in a word: زينب has 1 + 2 + 1 + 1 = 5);
  - dots and vowels don't overlap ink (beyond a small tolerance);
  - confusable pairs stay distinct: hah versus ain (الحمد / العمد), qaf versus ain and kha (قلب / غلب, فصل / خصل), dal versus ra (محمد / محمر), final kaf versus dal (بارك / بارد); compare raster templates or a simple classifier on the rendered letters;
  - loop letters keep open counters at the roundel pen;
  - no small closed loop where a bowl leaves a letter (the ta marbuta look-alike).
- **Performance:** line layout within the hot-path budget; roundel composition in the worker with a time cap.

## 10. Licensing and provenance

- **No fonts and no font outlines** in the engine. (The wedding page used Amiri and Cormorant Garamond, both OFL, for its own text only.)
- **Hand-drawn skeletons:** original work from the lab.
- **Learned skeletons:** derived from **Calliar** (MIT, ARBML; Alyafeai et al., "Calliar: An Online Handwritten Dataset for Arabic Calligraphy", 2021). Keep the attribution with the data.
- **Master fits:** fitted to the owner's own photos of historic works: Topkapı tile bands (Ayat al-Kursi; al-Baqarah 255–256), a gold-on-green panel (al-Baqarah 238), and the Husayn roundel in Hagia Sophia (Kazasker Mustafa İzzet, 19th century). Store fitted skeletons and provenance only; don't commit the photos. The masks in `data/targets/` are derived from those photos; keep them out of the repo, or in a non-distributed folder.
- **A note on contemporary works:** the owner also shared an Ayat al-Kursi panel that may be by a living calligrapher. It was too small to use; any future use should be for learning proportions only.

## 11. Known issues and open decisions

**Letters**
- **Kaf final and isolated:** wrong (no shoulder). Needs a master instance and a rebuild. Thuluth text containing kaf is not yet safe. (`reference/images/known-issue-kaf.png`)
- **Heh:** hand-drawn; no clean master example in the photos so far.
- **Final ya (ordinary size):** hand-drawn; the only master instance (الوسطى) is a great sweep.
- **Fa and qaf heads** are dense at heavy pens; their small counter shows only as a turquoise eye.

**Composition**
- **Long bands** (Ayat al-Kursi) have the right stem rhythm but tangled reading order.
- **Companion text** (blessings) uses a smaller pen; jali convention is one pen. Move it to its own ring.
- **Circles and great bowls** don't mix; ovals do.

**Tools**
- Style ranking by pairwise preference worked technically, but the style deltas were too subtle to judge; superseded by learning from data and masters.

**Open decisions for the owner** (answering the briefing's §6 questions)
- *Font or strokes?* Strokes; no HarfBuzz. Shaping is the engine's own.
- *Licence?* See §10; nothing restrictive in the engine itself.
- *Mixed scripts?* Recommend one engine per composition first, then thuluth as a roundel filler inside Kufic compositions (the owner's favourite combination) rather than per-region script switching.
- *Justification?* The engine's own kashida inside `layout`; reuse the shared solvers for partitioning.

## 12. Owner's taste (for judging output)

**Likes**
- Thuluth roundels and oval cartouches, Iznik tiles (dense eight-fold), turquoise counters, white on cobalt and gold on black or lapis.
- Long tughra-like sweeps; the Husayn great bowl.
- Pick-a-favourite-then-refine iteration, often from a phone.

**Dislikes**
- Empty space in a composition; crowded marks; letters touching or merging (qaf and sad).
- A blessing in the main composition (vetoed for the wedding piece).
- Anything that changes a word: legibility first, always.
