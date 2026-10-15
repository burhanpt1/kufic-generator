# Golden snapshots

Reference output for the cell engine and renderer: each case is a recorded `compose()` (or `alphabet()`) call and
the render call that drew it. First captured from the original single-file prototype (see git history); since the
prototype UI was retired they follow the current letter set (stemmed ع, dropped final م, short ص tooth, rigid
loops), with the `letters-alt` cases keeping the prototype's letters so those variants stay covered.

- `engine/<id>.json` — `{ fn, args, output }`. Typed arrays in `output` are encoded as `{"$u8": "..."}`, one
  base-36 digit per cell; see `serialize()` in `harness.mjs`.
- `svg/<id>.svg` — the SVG the render call produces.
- `manifest.json` — per case: which render function ran, with which options.
- `svg.ts` — runs a case's engine call and render call (shared by the tests and the rewriter).

Tests: `tests/engine.test.ts` (engine vs `engine/`) and `tests/render.test.ts` (renderer vs `svg/`). `npm run golden`
(`tests/golden-update.test.ts`) rewrites the outputs from the current engine, keeping each case's calls; only do that
for an intentional output change, and review the diff.
