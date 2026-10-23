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

**This is the historical reference, frozen as handed over on 15 October.** The lab as of 22 October, with the owner's
ratings and the port plan, is in `refresh/` (see its README). The port's own letter fixes supersede it:
`src/script/thuluth/fixes.ts` redraws the forms that fail the legibility rules (`tests/thuluth-legibility.test.ts`):
- the final and isolated kaf;
- the initial and medial lam (the learned ones were short or retraced; the lab's own `LEARN_USE` still selects them);
- the isolated ba, ta and tha;
- the medial kaf;
- the initial heh;
- the final and isolated seen, which the lab never drew.

The lab's session of 17 October made some of the same fixes. It also added `checker.js` (the rasm confusion matrix;
the port has its own in `src/script/thuluth/checker.ts`) and `band.js`, and removed a stray `Math.random` in
`counters.js`. Those changes are not vendored here. To compare the port with this lab, use `thuluth({ ...pen,
labLetters: true })`, which skips the fixes; the line-reference test does.

Left out on purpose (HANDOVER §10): the photo-derived letter masks (`data/targets/`) and the images that show the
owner's photographs. They stay with the owner.

`node scripts/thuluth-lab.mjs references` re-renders the lab references into `tests/golden-thuluth-lab/` (it runs this
bundle in headless Chromium, as the lab did, and checks two runs agree). `node scripts/thuluth-lab.mjs eval <file>`
runs any script against the lab, which is how the port is checked against it during development.
