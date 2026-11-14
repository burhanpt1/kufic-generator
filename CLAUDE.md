# Kufic generator

**The current plan is `COMPOSITION_ENGINE.md`** (one composition engine: regions, borders, fillers, features, a pluggable script engine, evolution). It extends this file and wins where they disagree. Its behavioural reference is `prototypes/kufic-lab.html` (with the seal kernel `prototypes/seal.c`); visual references rendered from it are in `tests/golden-lab/` (`npm run golden:lab`, compare with `npm run compare:lab <dir>`).

A generative art tool that lays out Arabic text as square / Fatimid-style Kufic calligraphy on a cell grid, winds it into square or circular rings, and decorates it (floriated stems, geometric star patterns, braided bands, abjad numerals). Everything runs client-side and outputs SVG.

The original prototype was one self-contained `index.html` (~1,360 lines) built iteratively in a claude.ai chat. It has been migrated to `src/` (migration steps 1–7 are done) and retired; it is in git history as `legacy/index.html`, and so is the rebuilt prototype UI (`src/ui`), retired in favour of Kufic Studio (`index.html`, `src/studio`). `tests/golden/` holds the engine and renderer's reference output, first captured from the prototype and now on the current letter set; the code must keep reproducing it exactly unless a change is intentional (then run `npm run golden` and review the diff).

## How the prototype was organised (line numbers approximate; the same names exist in `src/`)

Engine — inside the `KUFI` IIFE between `// ==== CORE START ====` (≈229) and `// ==== CORE END ====` (≈863):
- Glyph tables: `D` (letter groups × forms as `#`/`.` row strings, top row first), `VARIANTS` (ra, ayn), `LAMALEF_KNOT`, `OVR` user overrides, `def()/baseDef()`, `bitmap()` (rows → bitmap; 7-row glyphs stretch row index 1 for taller ascenders; `{rows, base}` = rows below baseline).
- Shaping: `MAP` (char → group), `RJ`/`NJ` joining classes, `shape()` (words → units with form ini/med/fin/iso, lam-alif ligature).
- Marks: `S` shapes, `DOTS`, `HAMZA_ON`, `COMB` (harakat), `unitMarks()`, `buildGlyph()` (places dots/vowels in lanes; marks that would rise past the ascender go in a side lane). Cell values: 1 letter, 2 vowel, 3 dot, 4 stem terminal.
- `prepare()`: composites glyphs to a shared band height `Hb`, finds stretchable columns (`str`: word-final tails weight 3, letter bodies weight 2.5) and tall-stem columns.
- `strip()`: justifies a line to width W (weights: tails 3, bodies 2.5, word gaps 2, join-before-final 2, joins 1), then optional stem-rhythm local search (`RHY.on`) that evens out tall-stem spacing; blits to a `{W, data, tag}` strip. `tag` = repeat index + 1.
- Solvers: `partition()` (DP split into contiguous groups with even slack, penalty for in-word breaks), `fitFlow()` (one text through all rings, picks repetition count), `fitPerRing()` (one text per ring).
- Geometry: `geomSquare()`, `geomCircle()` — outer size → rings with scale (taper), capacity, reserved centre.
- `markTerminals()`, `placeSide()` (pinwheel placement of 4 sides into a square frame), `rotate()`, `ABJAD` + `abjad()`, `uniqueLetters()`.
- `compose(opts)` → `{kind: 'square'|'circle'|'grid'|'empty', rings[], centre, bands[], rules[], info}`.
- `alphabet()`, `getRows()`, `setOverrides()`, `GROUPS`.

Renderer / UI — after CORE END:
- Rendering helpers (≈917): `prims()` (cells → horizontal runs, vertical runs, dots, diagonal links), `termCmds()` (stem-ending shapes), `letterShapes()` (generic over a cell→screen map, so the same code draws square grids and bent circle strips; banded style; over/under halos at diagonal crossings), `gridSVG()`, `ringSVG()`.
- Ornaments (≈1044): `DIGITS` + `numberSVG()` (angular Eastern Arabic numerals), `starSVG()`, `vineDefs()`, `tiles()` + `picPath()` + `patternSVG()` (Hankin polygons-in-contact star patterns on square / 4.8.8 / hex / 3.12.12 tilings), `bandSVG()` (lines, pearls, chevron, braid).
- Compositions (≈1152): `renderSquare()`, `renderCircle()`, `renderGrid()`.
- Letter editor (≈1247), main `render()` + Fatimid preset (≈1284), downloads.

Artifact-only code to replace: the `claude.use('downloads')` block at the end. In the standalone app, use a Blob + `<a download>` for SVG/PNG. `localStorage` (key `kufi-glyphs`) is fine to keep.

## Where things are now

Plain ES modules + TypeScript, Vite for dev/build, Vitest for tests, no UI framework. Deployed with GitHub Pages
(`.github/workflows/ci.yml`).

```
src/
  glyphs/ shaping/ layout/ abjad.ts   the classic Kufic engine described above (cells, strips, rings)
  render/ ornament/                   SVG: prims, letters, strokes, composition.ts (renderPlaced); bands, stars, patterns, palettes
  model/                              the composition tree: schema.ts (zod), presets, styles, silhouettes
  compose/                            the composition engine: resolve.ts, text borders, fills, flow, weave, strapwork, lattice, roundel
  geometry/                           outlines, offsets (Clipper2), corners, SVG paths
  script/                             the pluggable script engine: kufi.ts, registry.ts, thuluth/ (pen strokes; roundel/ is the roundel composer)
  monogram/                           seals, word blocks, tughra and spiral monograms
  kernels/                            C sources, their embedded WebAssembly (*.wasm.ts, built by `npm run build:wasm`) and TypeScript ports
  evolve/ critic/                     breeding, taste, the critic, the rating fit, worker pool
  fabricate/                          plotter, laser, relief map and STL
  studio/ app/                        Kufic Studio (index.html): tabs, URL state, storage, letter editor, export
  showpiece/ mosque/ tune/            the showpieces, the mosque programme, the tuning page
demos/        one page per feature, built with the site
prototypes/   behavioural references only; nothing in src/ imports them
tests/        golden/ (classic engine, byte-exact), golden-lab/ (pixel compare), golden-thuluth*/, ratings/ (rounds and votes)
```

The engine (everything but `studio`, `app`, `tune` and the demos) must not touch the DOM, so it runs in tests and in
workers.

The classic engine's `compose()` and `renderSquare`/`renderCircle` are still used by the spiral monogram, the letters
view and `tests/golden/`; new work goes through `compose/resolve.ts` and `renderPlaced`.

## History

The migration from the single-file prototype (golden snapshots, scaffold, engine, renderer, UI, unit tests, state in
the URL) is finished, and so are COMPOSITION_ENGINE.md's phases; the commit history has the detail.

## Roadmap
Open work is listed in `ROADMAP.md`, by area, with sources and status.

## Conventions
- Strip coordinates: x left→right (text reads right to left, so the first glyph is at the right), y up with row 0 at the bottom of the band; `base` = baseline row.
- Square grids: y down. Circle: baseline outward, letters point to the centre, reading clockwise from the bottom.
- Keep the engine deterministic (the rhythm search uses a seeded PRNG). Same input → same SVG.
- Don't change letter designs in refactor PRs.
- Seeds, sizes and counts that reach a search loop are bounded in `model/schema.ts`; a composition from a URL is
  untrusted input.
- A change to a kernel's C needs `npm run build:wasm` (`tests/kernels-fresh.test.ts` fails otherwise).
