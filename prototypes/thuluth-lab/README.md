# Thuluth lab (vendored prototype)

The chat-built thuluth lab, exactly as handed over (see `HANDOVER.md`). It is the behavioural reference for the port in
`src/script/thuluth/`; nothing in `src/` imports it.

- `lab/*.js`: the engine, one file per concern, sharing globals. `lab/build-bundle.sh` concatenates them into
  `thuluth-lab.bundle.js` (committed, so the demo and the oracle script need no build step).
- `data/`: learned letter forms (Calliar, MIT licence, ARBML; Alyafeai et al., "Calliar: An Online Handwritten Dataset
  for Arabic Calligraphy", 2021), the list of Calliar files labelled thuluth, and master fits (skeletons and scores only).
- `layouts/zainab-qusay.json`: the pinned wedding cartouche and the recipe that rebuilds it.
- `tools/`: the lab's Python tools (photo masks, letter fitting, Calliar extraction, reference rendering).
- `reference/`: the final wedding piece and the known kaf issue, as the lab rendered them.

Left out on purpose (HANDOVER §10): the photo-derived letter masks (`data/targets/`) and the images that show the
owner's photographs. They stay with the owner.

`node scripts/thuluth-lab.mjs references` re-renders the lab references into `tests/golden-thuluth-lab/` (it runs this
bundle in headless Chromium, as the lab did, and checks two runs agree). `node scripts/thuluth-lab.mjs eval <file>`
runs any script against the lab, which is how the port is checked against it during development.
