# Kufic generator

A generative art tool that lays out Arabic text as square / Fatimid-style Kufic calligraphy on a cell grid, winds it into square or circular rings, and decorates it (floriated stems, geometric star patterns, braided bands, abjad numerals). Everything runs client-side and outputs SVG.

The original prototype was one self-contained `index.html` (~1,360 lines) built iteratively in a claude.ai chat. It has been migrated to `src/` (migration steps 1–5 are done) and retired; it is in git history as `legacy/index.html`. Its output is frozen in `tests/golden/`, and the code must keep reproducing it exactly unless a change is intentional (then run `npm run golden` and review the diff).

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

## Target structure

Plain ES modules + TypeScript, Vite for dev/build, Vitest for tests, no UI framework. Deploy with GitHub Pages.

```
src/
  glyphs/      tables.ts (D, VARIANTS, knots), marks.ts (S, DOTS, COMB...), overrides.ts
  shaping/     shape.ts, buildGlyph.ts, prepare.ts
  layout/      strip.ts (justify + rhythm), solvers.ts, geometry.ts, compose.ts, terminals.ts
  render/      prims.ts, letters.ts, square.ts, circle.ts, grid.ts
  ornament/    numerals.ts, stars.ts, bands.ts, patterns/ (tilings.ts, pic.ts)
  abjad.ts
  ui/          controls.ts, editor.ts, presets.ts, export.ts, main.ts
index.html
tests/
```
The engine (`glyphs`, `shaping`, `layout`, `abjad`) must not touch the DOM, so it can run in tests and later in a worker.

## Migration plan — do these in order, one PR each

1. **Golden snapshots first.** Before moving any code, add a script that loads the prototype's `KUFI` engine and renderers in Node (jsdom or by extracting the script) and writes SVG snapshots for a fixed set of cases into `tests/golden/`: each layout (square, circle, line, letters) × a few texts (basmala vocalised, basmala plain, "بسم الله الرحمن الرحيم\nمحمد علي فاطمة\nالحسن الحسين", "لا اله الا الله", "يا علي مدد") × key option combos (Fatimid preset, banded, by-repeat colour, each centre type, each corner type, each band style, each tiling). Also snapshot `compose()` JSON for the same cases.
2. **Scaffold** Vite + TS + Vitest + ESLint/Prettier, GitHub Pages workflow. Copy `index.html` to `legacy/index.html` and keep it working.
3. **Extract the engine** into the modules above with no behaviour change. Tests: `compose()` output must equal the golden JSON.
4. **Extract the renderer and ornaments.** Tests: SVG must equal the golden SVGs (normalise number formatting if needed).
5. **Rebuild the UI** as modules, same controls and copy, standalone export. Then retire `legacy/`.
6. **Unit tests** for shaping (joining forms, lam-alif, harakat attachment, unsupported chars), abjad (786 for the basmala, 165 for لا اله الا الله), `partition()` invariants, `strip()` width = target.
7. **State in the URL** (all options + text, compressed) so compositions are shareable links.

Only after step 5: performance (move compose to a Web Worker if needed) and the roadmap.

## Roadmap after migration
- Letters as centreline strokes (graph per glyph) so interlace can do true over/under across letters, curved floriation along strokes, variable stroke width.
- Real letter alternates (separately designed variants chosen by the solver), stacked ligatures.
- A proper Fatimid letter set (Rana Kufi by Khaled Hosny follows the Fatimid measurements of Mohammad Abdul Qadir — use as reference, check its AGPL licence before copying anything).
- Material rendering (carved relief, gold on lapis, banna'i brick), fabrication export (plotter single-line paths, laser/CNC, 3D relief).
- Abjad breakdown and chronogram (ta'rikh) search.
- Generative search: render many variations, rank by stem rhythm / density evenness / kashida balance, pick from a gallery.

## Conventions
- Strip coordinates: x left→right (text reads right to left, so the first glyph is at the right), y up with row 0 at the bottom of the band; `base` = baseline row.
- Square grids: y down. Circle: baseline outward, letters point to the centre, reading clockwise from the bottom.
- Keep the engine deterministic (the rhythm search uses a seeded PRNG). Same input → same SVG.
- Don't change letter designs in refactor PRs.
