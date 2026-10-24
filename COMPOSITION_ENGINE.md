# Kufic composition engine: spec and work plan

## How to use this file

Put this file in the repo root next to `CLAUDE.md`, and add the prototype files to `prototypes/`:

- `prototypes/kufic-lab.html`: the Kufic Lab prototype (shape engine, fill, maze, monograms, curved strokes, breeding, chronogram). **Main reference for this spec.**
- `prototypes/seal.c`: the C kernel for the seal search, compiled to WebAssembly in the lab.
- `index.html`: the original generator. Its migration is already described in `CLAUDE.md` (steps 1–7).

Then tell Claude Code: *"Read CLAUDE.md and COMPOSITION_ENGINE.md. Finish any open migration steps from CLAUDE.md, then start Phase 1 of COMPOSITION_ENGINE.md."*

This document extends `CLAUDE.md`; where they disagree, this one wins. The prototypes are the behavioural reference. Port their ideas faithfully, but fix the known problems listed at the end rather than copying them.

---

## 1. What we are building

A browser-based generative calligraphy system. Today it produces square and Fatimid-style Kufic compositions: text bands around circles, polygons, stars and curved outlines (teardrop, heart, mihrab); filled fields (parallel lines and Kufic mazes); monograms and seals; geometric star patterns; braided bands; finials; vine grounds; and an evolutionary breeder that learns the user's taste.

The prototypes grew as separate tabs, each hard-coding one arrangement. The goal now is **one composition engine** in which every feature is a reusable part of a single model, so any filler can go in any region, any border on any shape, and compositions can nest. The calligraphic script must be a pluggable module: Kufi now, a cursive script such as thuluth later.

### Principles

1. **One model.** A composition is a tree of regions, borders, fillers and features, held as a small JSON document. Presets are saved trees. The breeder evolves trees.
2. **Engine is pure.** Geometry, shaping, layout and solvers never touch the DOM. They run in Node tests and in a Web Worker.
3. **Deterministic.** Same composition JSON and seed give the same SVG. Use the prototype PRNG (Park–Miller, `seed = seed * 16807 % 2147483647`) everywhere randomness is needed.
4. **Script is pluggable.** Everything that depends on letterforms sits behind a `ScriptEngine` interface (section 4).
5. **Complete text.** A text band or field always holds the whole text a whole number of times. It is never cut mid-phrase. Fit is achieved by tuning letter scale and repeat count, not by truncating.
6. **Fast where it matters.** Hot loops (seal search, polygon offsetting, maze search) may be WebAssembly kernels with JS fallbacks. Keep the C sources in the repo with a reproducible build (`zig cc -target wasm32-freestanding`).
7. **SVG out.** Every node renders to namespaced SVG layers. Export SVG and PNG, and later plotter paths.

---

## 2. Prototype inventory: where each idea lives

Search `prototypes/kufic-lab.html` for these function names. The engine core (`KUFI` IIFE) is shared with `index.html` and documented in `CLAUDE.md`.

| Concept | Prototype functions | Notes |
|---|---|---|
| Glyph tables, shaping, marks, strips, justification, stem rhythm | `KUFI` core: `shape`, `buildGlyph`, `prepare`, `strip`, `partition`, `repeatSegs`, `greedyOK`, `markTerminals` | `strip` justifies with weighted stretch points (tails 3, bodies 2.5, word gaps 2, joins before finals 2, joins 1) and a stem-rhythm search. `partition` is the DP that splits text into groups with even slack and a penalty for in-word breaks. |
| Regular outlines | `outline(kind, sides, depth)` | Polygons and stars normalised to edge distance 1, counter-clockwise on screen, first edge at the bottom, per-corner clearance factor \|cot(φ/2)\|. |
| Curved outlines | `CURVES`, `curveUnit`, `offsetPoly`, `runsOf`, `runFrame` | Dense polyline plus corner flags. Runs are smooth stretches between corners. `offsetPoly` prunes fold-overs and re-detects corners; replace it with Clipper2 (Phase 1). |
| Text bands on any outline | `composeShape`, `fitRing` (inside it) | Complete-text rule: per ring, search letter scale × repeats for minimum slack. Rings are inward offsets. **Text groups go round the edges clockwise**: group *g* goes on edge `(G − g) % G`, because edges are stored counter-clockwise. |
| Shape renderer | `renderShape`, `finialSVG` | Circles via `ringSVG`; edges and curve runs via a per-strip map function; bands follow the outline; finials fill sharp tips. |
| Line fill (micrography) | `composeFill`, `buildFill`, `crossings`, `ivIntersect` | Lines one band apart; each line clipped to the shape at five heights; stretches in reading order; largest scale that fits the text once. |
| Kufic maze | `shapeTest`, `mazeCycle`, `mazeRuns`, `composeMaze` | Spanning tree on super-cells, walked to make a cycle covering every corridor; text on straight runs; the baseline turns every corner; short corridors carry the baseline only; outer wall. |
| Monograms | `symCompose`, `blockCompose`, `spiralCompose`, `tughraCompose`, `sealCompose`, `letterShape`, `frameIt`, `dotFill`, `markEnds`, `monoMetrics` | Seal search runs in `prototypes/seal.c` (WebAssembly, about 7× faster than JS) with a JS fallback. Seals support stretch variants, joined forms with join-stub constraints, and mirror or turn symmetry. |
| Curved stroke renderer | `strokeLetters` (inside the renderer) | Cells become a centreline graph; chains between junctions; straight pass-through at crossings; rounded corners; broad-nib pen; over-under halos; floriated ends along chain direction. |
| Ornaments | `patternSVG`, `tiles`, `picPath` (Hankin polygons-in-contact), `bandSVG` / band code in `renderShape`, `starSVG`, `vineDefs`, `numberSVG` | Star patterns on square, 4.8.8, 6.6.6 and 3.12.12 tilings. |
| Critic and breeding | `analyseStrip`, `metrics`, `score`, `learn`, `mutate`, `cross`, `pickPref` | Metrics: stem rhythm, even stretching, density, repetition, centre balance, filled canvas. Taste learning shifts metric weights and trait preferences from picks. |
| Chronogram | `CATS`, `combos`, `val`, `table` | Abjad (Mashriqi or Maghribi, ة as 5 or 400); "complete my phrase", read, and find modes. |

---

## 3. The composition model

### 3.1 Core idea

- **Region**: an area bounded by an outline.
- **Border**: a band along a region's inside edge, either text or ornament. A border always yields a smaller inner region, so borders stack.
- **Filler**: what occupies a region: text lines, maze, monogram or seal, star pattern, vine, solid, or a nested composition.
- **Features**: decoration attached to geometry: finials at tips, ornaments at corners, spandrels between the outline and the frame, stem endings on letters.
- **Style**: script, stroke style, palette, and later materials. Inherited down the tree, overridable per node.
- **Texts**: named slots referenced by borders and fillers.

Example: a mihrab panel.

```
Frame (square canvas)
├─ Spandrels: star pattern 8-fold
└─ Region: mihrab
   ├─ Border: text "basmala", separator braid
   ├─ Border: ornament pearls
   └─ Fill: lines, text "ayat"
```

### 3.2 Schema (TypeScript, version 1)

Treat this as the starting point; refine it as you build, but keep it serialisable and versioned.

```ts
type Seed = number;

interface Composition {
  version: 1;
  seed: Seed;
  canvas: { shape: 'square' | 'portrait' | 'landscape'; margin: number };
  style: Style;                       // defaults, inherited
  texts: Record<string, TextSlot>;    // e.g. { basmala: {...}, ayat: {...} }
  root: FrameNode;
}

interface Style {
  script: 'kufi';                     // later: 'cursive'
  letter: { ascenders: 7 | 9 | 11 | 13; ra: 'desc' | 'short' | 'hook'; ayn: 'open' | 'cup'; lamAlif: 'plain' | 'knot'; marks: 'off' | 'dots' | 'all'; vowels: 'modern' | 'early' };
  stroke: { kind: 'blocks' | 'curved' | 'pen'; corner: number; weight: number; softness: number; banded: boolean };
  terminals: { kind: 'none' | 'notch' | 'bevel' | 'leaf' | 'palmette'; reach: 'tall' | 'tails' | 'all' };
  palette: { ink: string; ink2: string; paper: string; mark: string };
  colouring: 'solid' | 'byRing' | 'byRepeat' | 'radial';
}

interface TextSlot {
  text: string;                       // may include line breaks = one ring per line
  repeat: 'fill' | 'once';            // 'fill' = whole repeats to fill; 'once' = exactly one pass
  wordGap: number;
}

type Outline =
  | { kind: 'circle' }
  | { kind: 'polygon'; sides: number; rotation?: number }
  | { kind: 'star'; points: number; depth: number }
  | { kind: 'preset'; name: 'teardrop' | 'heart' | 'mihrab' }
  | { kind: 'svg'; path: string }     // uploaded outline
  | { kind: 'poly'; points: [number, number][] };

interface FrameNode { type: 'frame'; spandrels?: FillerNode; child: RegionNode; style?: Partial<Style> }

interface RegionNode {
  type: 'region';
  outline: Outline;
  size?: 'auto' | number;             // auto = solved from content
  borders: BorderNode[];              // outermost first
  fill?: FillerNode;
  features?: FeatureSet;
  style?: Partial<Style>;
}

type BorderNode =
  | { type: 'textBorder'; text: string /* slot */; scale?: 'auto' | number; taper?: number; separator?: Separator; ground?: Ground }
  | { type: 'ornamentBorder'; ornament: 'lines' | 'pearls' | 'chevron' | 'braid'; width: number };

type Separator = { kind: 'none' | 'lines' | 'pearls' | 'chevron' | 'braid'; width: number };
type Ground = { kind: 'plain' | 'tint' | 'vine' | 'pattern'; pattern?: PatternSpec };

type FillerNode =
  | { type: 'lines'; text: string; lineGap: number; minWords?: number }
  | { type: 'maze'; text: string; corridors: number /* straightness 0..1 */; wall: boolean }
  | { type: 'monogram'; text: string; method: 'mirror' | 'below' | 'quad' | 'pair' | 'pinwheel' | 'pinwheelIn' | 'block' | 'spiral' | 'tughra' | 'seal'; params: Record<string, number | string | boolean> }
  | { type: 'abjad'; text: string }
  | { type: 'pattern'; pattern: PatternSpec }
  | { type: 'vine' }
  | { type: 'solid' }
  | { type: 'region'; node: RegionNode };   // nesting

interface PatternSpec { tiling: 'square' | '488' | 'hex' | '31212'; angle: number; scale: number }
interface FeatureSet { tips?: 'finial' | 'diamond' | 'none'; corners?: 'diamond' | 'star' | 'none' }
```

### 3.3 Layout pipeline

`resolve(node, region, ctx) → Placed`, recursively:

1. **Region**: build the outline geometry at the current size: polygon(s), corner metadata, runs.
2. **Borders**, outermost first: each border is solved against the current outline (complete-text fitting for text borders) and returns its strips and the **inner outline**, offset inward by band plus separator.
3. **Fill**: resolved against the final inner outline. Nested regions recurse.
4. **Features** are placed on the corners and tips of every ring.
5. **Size = 'auto'**: the outermost text border picks the smallest size at which its text fits once at full scale; a `spread` factor (an evolvable parameter) enlarges it. If an inner fill's letter scale falls below a threshold relative to the border (prototype: 0.42), enlarge and re-solve (see `buildFill`).

`Placed` is renderer-agnostic: strips (cell data plus a map function from strip coordinates to the canvas), paths (outlines, separators), ornament primitives, and metadata for the critic.

---

## 4. Script engine interface

Everything letter-specific goes behind this interface. Kufi implements it now from the existing `KUFI` core.

```ts
interface ScriptEngine {
  id: string;
  shape(text: string, style: Style['letter']): Shaped;               // words → units with joining forms
  prepare(shaped: Shaped, style: Style['letter']): Prepared;         // composited glyphs, band height, baseline, stretch points
  segments(prepared: Prepared, mode: 'words' | 'breaks'): Segment[]; // units for the partition solver
  layout(segments: Segment[], width: number, opts: { wrap: boolean; rhythm: boolean }): Strip; // justified strip
  // grid-based extras; a cursive engine may not support these, and fillers must check capabilities
  capabilities: { grid: boolean; seals: boolean; mazes: boolean };
}
```

The `Strip` stays a cell grid for Kufi. A future cursive engine would return vector strokes instead, so make `Strip` a tagged union now (`{ kind: 'cells', ... } | { kind: 'vector', ... }`), and make the renderer and critic handle both.

---

## 5. Geometry core

- **Polygon offsetting:** use **Clipper2** (JavaScript or WebAssembly port, open licence; check it) for robust inward and outward offsets, with miter limits and self-intersection cleanup. This replaces the prototype's `offsetPoly`, which is fragile at sharp tips.
- **Corners:** detect sharp corners on each offset ring (turn angle threshold plus local maximum). Keep the corner metadata: interior angle, bisector, convexity, clearance factor.
- **Runs:** smooth stretches between corners, with arc-length parametrisation and a frame (position, tangent, inward normal) at any arc length. Long cell runs in renderers must be subdivided so they follow curves.
- **Uploaded outlines:** parse SVG path data (lines, Béziers, arcs) and flatten it adaptively into a dense polyline. Detect corners from tangent discontinuities, normalise and centre it, and orient it counter-clockwise on screen with the first run starting at the bottom-most corner.
- **Deepest point:** find the point furthest inside a region (prototype: grid search) for placing centrepieces. Consider the polylabel algorithm.

---

## 6. Rendering

- One SVG per composition, built from layers in z-order: ground, patterns, spandrels, letters (per colour key), dots, vowels, separators, features.
- **Namespace all `id`s** (`clipPath`, `pattern`, gradients) per composition and node. The prototypes collide when several compositions are inlined on one page.
- The letter drawer is generic over a map function from cell to canvas (prototype `letterShapes`), with three stroke modes: blocks, curved and pen. Over-under at crossings; banded style.
- Exports: SVG, high-resolution PNG, single-line plotter SVG, laser/CNC layers, a relief depth map, and a 3D-printable STL (`src/fabricate/mesh.ts`: the relief map or any image → a watertight solid; adaptive RTIN surface, cut to the mask, walls and a flat bottom).

---

## 7. Evolution, critic and taste

- **Genome = the composition tree** plus seeds.
- **Mutation operators:** tweak a parameter (ordinal genes step to a neighbouring value); switch an outline kind; add or remove a border; change a filler type; change the separator, ground or features; re-seed a maze or seal.
- **Crossover:** swap whole branches between two parents, for example the border stack of A with the fill of B, as well as gene-level mixing.
- **Critic registry:** each node type contributes metrics. Ported metrics: stem rhythm, even stretching, density and evenness, repetition, centre balance, fill ratio (borders); legibility via the solid-2×2-block penalty, compactness, squareness, symmetry and shared strokes (monograms). Overall score = weighted sum.
- **Taste learning** (prototype `learn`): picks shift metric weights toward what the picks do well, and raise the prior of their trait values. Persist it per user in localStorage.
- Generations run in a **Web Worker pool**, streaming thumbnails into the gallery as they finish.

---

## 8. Interface

Three levels over the same model:

1. **Gallery:** presets and Breed (pick one or two, lock traits, vary, save favourites).
2. **Guided editor:** shape → borders (texts, separators) → fill → centre → style. One screen, live preview.
3. **Layers panel:** the composition tree, with nodes to add, remove, reorder and edit.

Also:
- State lives in the URL (compressed JSON), so compositions are shareable links.
- The chronogram becomes a helper on any text slot: show the abjad value, then "complete my phrase to year X".
- The letter editor (from `index.html`) edits the Kufi glyph set used by the script engine.

**Presets** to ship as saved trees: Fatimid medallion (circle, three borders, monogram centre, star-pattern spandrels); Mihrab of Ayat al-Kursi (mihrab, basmala border, line fill); Octagon panel; Basmala seal; Shahada block; Kufic maze tile; Teardrop in gold; Hexagon on lapis.

---

## 9. Work plan

Every phase ends with tests passing, a short demo page under `demos/`, and a PR. Keep PRs small.

### Phase 0: groundwork
- Finish the open `CLAUDE.md` migration steps: golden snapshots of `index.html`, scaffold, engine and renderer extraction.
- Add `prototypes/`. Write a script that renders a fixed list of lab cases (fixed seeds) to SVG and PNG in `tests/golden-lab/`. These are **visual references**, not byte-exact targets, because Phase 1 changes the geometry library. Compare with a pixel-diff threshold and flag big regressions for human review.

### Phase 1: geometry core
- Outline types (section 3.2), Clipper2 offsets, corner detection, runs and frames, SVG path import, deepest point.
- Tests: offsets of every preset outline at increasing distances never self-intersect; corner counts are stable; run lengths shrink monotonically inward; uploaded SVG paths round-trip.

### Phase 2: composition model and resolver
- Schema, validation (zod or similar), versioning.
- Port as node implementations:
  - text borders (complete-text fitting, any outline)
  - separators and grounds
  - fillers: lines, maze, monogram (every method; seal via the WebAssembly kernel), abjad, pattern, vine, solid, nested region
  - features: finials, corner ornaments, spandrels
- Tests: every preset resolves; complete-text invariant (each band's text is whole repeats); clockwise reading order of groups; determinism (the same JSON gives the same `Placed`).

### Phase 3: renderer
- Layered, namespaced SVG; three stroke modes; banded; over-under; PNG export.
- Visual comparison against `tests/golden-lab/`.

### Phase 4: evolution
- Tree genome, mutation and crossover operators, critic registry, taste learning, worker pool.
- Tests: mutations always yield valid compositions; crossover preserves schema validity; a seeded run is reproducible.

### Phase 5: interface
- Gallery and Breed, guided editor, layers panel, URL state, presets, chronogram helper, letter editor, export.

### Phase 6: the ambitious work
Do these after Phase 5. Rough order of value:
1. **Uploaded outlines everywhere:** borders and fills of any SVG shape (a mosque silhouette, a dome, a lamp).
2. **Variable line height in fills:** lines shrink where the shape narrows, so tips and curves stay crisp; letter scale varies smoothly between lines.
3. **Flow fill:** text lines follow streamlines of a field aligned to the outline (parallel to the edge near the boundary, relaxing inward), like engraving hatching. Reuses curved-run strips; needs a streamline-spacing solver.
4. **Interlaced maze:** corridors that cross over and under each other, using the over-under renderer on corridor centrelines.
5. **Better seals:** letters that reshape (not only stretch) to share strokes; a tughra mode with true curved loops wrapping the spines.
6. **Letter alternates and a proper Fatimid letter set:** designed variants chosen by the solver, plus the glyph editor working on vector stroke skeletons. Rana Kufi (Khaled Hosny) follows the Fatimid measurements of Mohammad Abdul Qadir; use it as a reference and check its AGPL licence before copying anything.
7. **Performance:** move offsets, the maze search and fill fitting to WebAssembly if profiling says so. Target: a 16-candidate generation in under 1 second for typical presets.
8. **Fabrication:** plotter single-line paths, laser and CNC layers, a relief depth map for 3D printing or carving.
9. **Visual critic (optional):** send a rendered thumbnail to the Claude API for a calligraphy-teacher style critique, and use its suggestions as mutation hints. Keep it off by default.
10. **Cursive script module (parked):** a font-based cursive engine (HarfBuzz WebAssembly plus an open-licence font with good ligatures) behind `ScriptEngine`, starting with borders and line fills.

---

## 10. Known problems in the prototypes: fix, don't copy

- `offsetPoly` is naive and fails at sharp tips and deep notches; replace it with Clipper2.
- Duplicate SVG ids when compositions are inlined together (clip paths and patterns collide).
- Curved-outline offsets are O(n²); generation slowed from about 1 s to about 4–5 s with curves.
- Polygon text-group order was once counter-clockwise; the fixed rule is clockwise (`(G − g) % G`). Add a test.
- Stars: edges are short and text is tiny; consider fewer, deeper points or text only on the outer ring.
- Fill letters are small in narrow shapes (about 40% of border size); variable line height (Phase 6.2) is the real fix.
- Pen stroke mode draws each path seven times, so SVGs get heavy; consider a true outline (Minkowski sum with the nib) instead.
- The tughra is schematic; real tughras need curved loops (Phase 6.5).
- The monogram critic over-rewards four-fold symmetry.
- The abjad convention for ة (5 or 400) must be a visible setting, not a hidden default.
- The heart preset was rebuilt from two circles and tangent lines because the parametric heart's cusps wasted most of the outline; keep that construction.

---

## 11. Conventions

- **Units:** 1 cell = 10 SVG units in output.
- **Strip coordinates:** x along the path (text reads right to left, so the first glyph sits at high x); y from the band's outer edge (row 0, descenders and below-marks) inward to the letter tops. Baseline row = `base`.
- **Reading direction:** around any outline, clockwise starting at the bottom. On the bottom edge, letters are upright and read right to left.
- **Outlines:** counter-clockwise on screen (y down); inward normal of an edge with tangent `t` is `(t.y, −t.x)`.
- **Cell values in strips and grids:** 1 letter stroke, 2 vowel, 3 dot or consonant mark, 4 stem terminal.
- **Randomness:** only through seeded Park–Miller generators passed in from the composition.
- **No letterform changes in refactor PRs.**
