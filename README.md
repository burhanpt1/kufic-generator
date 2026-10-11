# Kufic generator

Generative square and Fatimid-style Kufic calligraphy in the browser. Type Arabic text and it is shaped into grid letterforms, wound into square or circular rings, and ornamented — floriated stems, geometric star patterns, braided bands, and the abjad value as a centrepiece. Exports SVG and PNG.

Every option, the text and any letter edits are kept in the URL fragment (`#s=…`, compressed), so the address bar is always a shareable link to the current composition.

Run `npm run dev` and open the printed URL, or use the GitHub Pages build. See `CLAUDE.md` for the architecture and migration plan.

## Development

Needs Node 22.12 or later.

```sh
npm install
npm run dev          # Vite dev server
npm run build        # static site in dist/
npm test             # Vitest: engine, renderer and UI against the golden snapshots
npm run lint         # ESLint
npm run format       # Prettier
npm run typecheck    # tsc
npm run golden       # rewrite tests/golden/ from the current app (only for intentional output changes)
```

The original single-file prototype is in git history (`legacy/index.html` before the UI rebuild); the golden
snapshots in `tests/golden/` were captured from it.
Pushes to `main` deploy `dist/` to GitHub Pages (enable Pages with source "GitHub Actions" in the repository settings).
