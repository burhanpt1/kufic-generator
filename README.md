# Kufic generator

Generative square and Fatimid-style Kufic calligraphy in the browser. Type Arabic text and it is shaped into grid letterforms, wound into square or circular rings, and ornamented — floriated stems, geometric star patterns, braided bands, and the abjad value as a centrepiece. Exports SVG and PNG.

Open `index.html` in a browser to use the current prototype. See `CLAUDE.md` for the architecture and migration plan.

## Development

Needs Node 22.12 or later.

```sh
npm install
npm run dev          # Vite dev server
npm run build        # static site in dist/ (index.html and legacy/index.html)
npm test             # Vitest, including the golden-snapshot check of legacy/index.html
npm run lint         # ESLint
npm run format       # Prettier
npm run typecheck    # tsc
npm run golden       # regenerate tests/golden/ from legacy/index.html (only when the prototype changes)
```

`legacy/index.html` is the reference prototype; `index.html` is kept identical to it until the new UI replaces it.
Pushes to `main` deploy `dist/` to GitHub Pages (enable Pages with source "GitHub Actions" in the repository settings).
