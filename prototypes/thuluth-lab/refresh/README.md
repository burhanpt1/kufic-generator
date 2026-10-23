# Thuluth lab, refreshed export (22 October 2026)

The lab as it stood after the sessions of 17–22 October, vendored next to the frozen 15 October copy (`../`) so the
references and the oracle script (`scripts/thuluth-lab.mjs`) keep running against the version they were made from.
`PORT-PLAN.md` is the owner's list of what to port from here, in order; `HANDOVER.md` carries the addenda for these
sessions.

- `lab/`: every lab file, including the new `band.js`, `checker.js` and `deco.js` (critic, mirrored composition).
  `build-bundle.sh` concatenates them; no bundle is committed for this copy.
- `data/calliar_paths.json`, `data/calliar_picks.json`: reading paths traced from 63 Calliar thuluth compositions, and
  the five distinct shapes picked from them.
- `data/stack-prior-*.json`: stacked-join rates from 70 Calliar thuluth compositions (`tools/calliar_stack_stats.py`).
- `data/ratings/`: the owner's pairwise ratings (`votes.json`, 148 votes over 81 compositions in `items.json`), the
  Bradley–Terry ranking (`bt4.json`), the noise features of the rated set (`debris.json`) and the critic fitted to the
  ratings (`noise_fit.json`).
- `tools/`: `noise.py`, `bradley_terry.py`, the rating page (`rating-page.html`, with the rated compositions embedded),
  `calliar_stack_stats.py` and `lab_generate_paths.py`.

Left out, as before: the photo-derived masks (`data/targets/`) and the reference images that show photographs of
masters' work.
