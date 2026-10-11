# Golden snapshots

Reference output of the prototype (`index.html`), captured before any code is moved. Later migration steps must
reproduce these exactly.

- `cases.mjs` — the fixed case list: each case is a set of UI settings applied on top of the page defaults.
- `harness.mjs` — loads the page in jsdom, drives its real controls, and records the engine and render calls.
- `svg/<id>.svg` — the SVG the page produced (`lastSVG`, i.e. what Save SVG writes).
- `engine/<id>.json` — `{ fn, args, output }` for the `KUFI.compose()` call (or `KUFI.alphabet()` for the letters
  layout). Typed arrays in `output` are encoded as `{"$u8": "..."}`, one base-36 digit per cell; see `serialize()`.
  Empty-text cases still call `compose()` and are included.
- `manifest.json` — per case: UI settings, which render function ran with which options, and the status line text.

Regenerate with `npm run golden` (only when the prototype itself changes); verify with `npm run golden:check`.
`node scripts/golden.mjs <filter>` runs only the cases whose id contains `<filter>`.
