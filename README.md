# Kufic generator

Generative square and Fatimid-style Kufic calligraphy in the browser. Kufic Studio composes texts into borders, rings and fills of any outline (seals, medallions, mihrabs, strapwork, lattices, mazes), ornaments them, breeds variations, writes chronograms, and exports SVG and PNG.

The composition is kept in the URL fragment (`#c=…`, compressed), so the address bar is always a shareable link.

Run `npm run dev` and open the printed URL, or use the GitHub Pages build. See `CLAUDE.md` for the architecture and migration plan.

## Development

Needs Node 22.12 or later.

```sh
npm install
npm run dev          # Vite dev server
npm run build        # static site in dist/
npm test             # Vitest: engine and renderer against the golden snapshots, and everything else
npm run lint         # ESLint
npm run format       # Prettier
npm run typecheck    # tsc
npm run golden       # rewrite tests/golden/ from the current engine (only for intentional output changes)
npm run mosque       # render the mosque programme (src/mosque) and its qibla wall to docs/mosque/
npm run showpiece    # render "Light upon light" (src/showpiece), an A1 sheet of the Light Verse, to docs/showpiece/
```

The original single-file prototype, and the rebuilt prototype UI that replaced it, are in git history; the golden
snapshots in `tests/golden/` were first captured from the prototype and now track the current letter set.
Pushes to `main` deploy `dist/` to GitHub Pages (enable Pages with source "GitHub Actions" in the repository settings).
