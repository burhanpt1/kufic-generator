# Golden snapshots

Reference output captured from the original single-file prototype (`index.html`, later `legacy/index.html`, now
retired; see git history) before any code was moved. The modular engine, renderer and UI reproduce it exactly.

- `cases.mjs` — the fixed case list: each case is a set of UI settings applied on top of the page defaults.
- `harness.mjs` — `applyUI()` drives the page's controls for a case; `serialize()` is the JSON form of engine output.
- `svg/<id>.svg` — the SVG the page produced (what Save SVG writes).
- `engine/<id>.json` — `{ fn, args, output }` for the `compose()` call (or `alphabet()` for the letters layout).
  Typed arrays in `output` are encoded as `{"$u8": "..."}`, one base-36 digit per cell; see `serialize()`.
- `manifest.json` — per case: UI settings, which render function ran with which options, and the status-line text.

Tests: `tests/engine.test.ts` (engine vs `engine/`), `tests/render.test.ts` (renderer vs `svg/`), `tests/ui.test.ts`
(the whole UI in jsdom vs everything). `npm run golden` rewrites the snapshots from the current app; only do that for
an intentional output change, and review the diff.
