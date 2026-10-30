# Roadmap

Everything still to do, in one place. Last reviewed 30 October 2026, at `1519791` (ruled roundel composition).

**How to read it.** The first section is the order I'd work in. The rest is grouped by area, and every item says where it
came from (a file, a handover section or a commit), so it can be checked. When something here is finished, delete it
in the same PR; when new work comes up, add it here, not only in a commit message.

**Status marks:**

- `[ ]` not started
- `[~]` partly done
- `[!]` known broken, tolerated for now
- `[?]` a decision for the owner
- `[r]` built as an option, off by default, waiting on ratings before it is promoted

What is already done is listed at the end only as milestones; the commit history has the detail.

---

## Next up

1. **[?] A second round of ratings, on today's engine.** Most of the open composition work is a built option waiting
   on ratings (ruled composition, the Timurid band, girift, mark spacing, learned stacking), and the critic is not yet
   good enough to stand in for them. Dense roundels fit at 78%, mirrored at 75% and single names at 87%; the target
   is 85% (`10f7d0f`, `719cd4a`). Owner action; the loop is in `tests/ratings/README.md`.
2. **[ ] A thuluth inscription band that reads strictly right to left.** Long bands such as Ayat al-Kursi still tangle
   their reading order (lab HANDOVER §11). The lab's `bandCompose` (`refresh/lab/band.js`) is the proposed basis
   (refresh/HANDOVER.md, addendum 2). This is also the first step towards tughra-style thuluth (see Thuluth
   composition).
3. **[ ] Roundel composition in the worker, with a time cap.** A roundel takes 20–60 s (lab HANDOVER §6). The roundel
   tests take 30–70 s each, and CI went from about 2 to 6½ minutes with them (run 172).
4. **[ ] The inscription ring and illumination from the lab's `ring.js`:** rays, panel and Iznik panel round a
   roundel. They are not ported; the roundel renderer says so (`src/script/thuluth/roundel/render.ts:1`).
5. **[~] Finish the istif write-up** (`docs/writeup/thuluth-istif.md`):
   - rebuild its showpieces on the finished engine;
   - report the critic's accuracy on the second rating round;
   - compare against masters' istif with the same critic.

   Candidate venues: Bridges, Nexus Network Journal, the Eurographics expressive track.

6. **[ ] Housekeeping:**
   - Bring CLAUDE.md up to date. Its migration plan is finished, and its roadmap now points here.
   - Commit PLAN-2. Commits cite its §1–§10, but the file is not in the repo.

---

## Thuluth letters

- [~] **Heh is the weakest letter; it needs a master example.**
  - The initial heh was redone as a split, two-eyed form (`63c3861`). The medial heh is unchanged: a figure-of-eight
    came out too close to mim.
  - Source: refresh/HANDOVER.md, letters; `tests/thuluth-legibility.test.ts`.
- [!] **The dense loop heads sit under the 0.3 confusion threshold.** These are fa and qaf, heh and mim, in initial
  and medial position. The test holds each at its present distance, so they may move apart but never closer.
  Initial fa/heh is the closest pair, at 0.18 (`tests/thuluth-legibility.test.ts`, confusion matrix).
- [?] **The final and isolated seen are a construction, not a master's form.** They are the seen's teeth followed by
  the final nun's bowl (`65efddf`). The owner should review them.
- [ ] **The final ya at ordinary size is still hand-drawn.** The only master instance is a great sweep (lab HANDOVER
      §11).
- [ ] **The lab's "initial lam/tooth at 0.35" finding was never explained** (refresh/HANDOVER.md). The port has since
      redrawn the initial and medial lam. Check whether the finding still holds.
- [~] **Mim, tah, lam-alif and the Allah ligature are hand-drawn and only "acceptable"** (lab HANDOVER §4). Each
  needs a master fit when photos allow.
- [~] **Solid heads at the roundel pen:** mim (initial and medial), waw, initial heh and initial ta. This is a jali
  convention, but the handover asks that loop letters keep open counters.
- [ ] **Calibrate the port's rasm confusion matrix against the lab's `checker.js`.** That file is now vendored in
      `refresh/lab/`. The port's scale differs from the lab's: for example, isolated ba/ra and medial kaf/lam are not
      flagged.
- [~] **The handover's last test is still missing: "dots and vowels don't overlap ink"**, at every pen and in
  roundels. The lab found شيخ at 0.32 overlap (lab HANDOVER §9; refresh/HANDOVER.md).

## Thuluth composition and roundels

- [ ] **Tughra-style thuluth composition.** The stacked, interlocked pieces of a tughra, beyond the Kufic tughra
      monogram (owner, 16 October). This builds on stacking (istif), girift and the band composer above.
- [ ] **Companion text (blessings) in its own ring, at one pen.** It is currently set smaller inside the roundel. Jali
      convention is one pen throughout (lab HANDOVER §11; `companion` in `roundel/compose.ts`).
- [!] **Great bowls need an oval:** in a circle the bowl and the circle fight (lab HANDOVER §11). Either guard against
  it or design for it.
- [~] **A ta marbuta lifted onto another word's stroke by stacking can still get past the critic.** `orderFault`
  covers stacking itself (`c786fae`, `7380a89`).
- [?] **The traced master route `calliar3` (the sharp V).** Every dense composition on it was disliked in the 24
  October round (`844ad32`). Drop it, or fix it and rate it again.
- [ ] **The pen-writing animation (`renderRoundel animate`)** has no port.
- [r] **Built options, each waiting on ratings:**
  - ruled composition (`1519791`)
  - the girift dial (`9274874`, `e06c0d0`)
  - learned stacking (`a6a785f`)
  - towers (`8554321`)
  - hairline piercing (`e06c0d0`)
  - nesting, drawn-out tails, rising stems and `stackAt` (`d77fd76`, `1d7f561`, `8727be9`)
  - mark `clearance`, `markDensity` and `fathaGap` (`8271e6f`)
- [?] **Mirrored work: the list of refused texts.** Mirrored الله is refused. The owner may add Hu and other divine
  names (`fed534d`).
- [?] **Should the Timurid band (Kufic over jali thuluth) become a preset?** It must be rated first (`bd147de`).

## Kufic engine

- [~] **A full Fatimid letter set**, as vector stroke skeletons with an editor. There is a cell-based `fatimid` set
  (`ae2d8bd`), but the letter editor is still cell-based (docs/letters.md; COMPOSITION_ENGINE.md 6.6).
- [?] **Rana Kufi (Khaled Hosny, AGPL).** Use it as a reference only, or take outlines and relicense? (docs/letters.md)
- [~] **Letters as authored centreline graphs**, for true over/under across letters. Curved strokes, variable width
  and leaves are done (`9951997`); per-glyph authored skeletons are not (CLAUDE.md).
- [ ] **Stacked Kufic ligatures** (CLAUDE.md).
- [ ] **Star outlines have short edges and tiny text.** shape--star-6-pen is the worst lab-compare case, at 0.224
      (COMPOSITION_ENGINE.md §10).

## Composition engine

- [~] **20 of the 35 Kufic lab-compare cases differ from the lab by more than 12%.** They were reviewed and accepted
  (`tests/golden-lab/reviewed.json`). Revisit the worst: star-6-pen, la-ilaha-poly5, square-4, fatimid-circle.
- [ ] **Region clipping for spandrels still uses the TypeScript Clipper2.** Only ring and band offsets are native
      (`dd46d6b`). It runs once per composition, so it is low priority.

## Rendering and ornament

- [~] **Material rendering:** carved relief, gold on lapis, banna'i brick. Only palettes exist (`src/model/style.ts`);
  there is no relief shading.
- [~] **The "Light upon light" radial rays are still marked experimental** (`src/showpiece/radial.ts`).

## Studio and interface

- [?] **The rating page lives outside the Studio.** The owner asked for it inside if possible (refresh/PORT-PLAN.md).
  A static Studio has no shared store, so it is published as a page and its source is in `tests/ratings/page`
  (`04ed956`).
- [r] **Thuluth is never bred at random** (prior 0) until taste or a lock asks for it (`src/evolve/genes.ts`).

## Evolution, critic and ratings

- [~] **The critic's accuracy on the current engine is below target:** dense 78%, mirrored 75%, single 87%, against
  85%. Dislikes flatter it (`844ad32`, `10f7d0f`).
- [?] **Promote the reported checks into the score?** These are word space, stray marks and dots, doubled ink,
  clashes, crossings and alignment. So far only word space moved a fit, by 1.3 points, "too little to promote"
  (`src/evolve/critic.ts:130`, `844ad32`).
- [~] **Single-name roundels are their own genre.** Per-genre fits exist (`18ca2a7`). Check the Husayn master now
  scores well.
- [ ] **Check whether the monogram critic still over-rewards four-fold symmetry.** Its weights are fixed
      (COMPOSITION_ENGINE.md §10; `src/monogram/methods.ts`).
- [r] **Seal reshaping** scored no better across eight texts (`155f709`).

## Performance

- [~] **Target: a generation of 16 in under 1 s** (COMPOSITION_ENGINE.md 6.7; `demos/perf.html`).
  - A generation of 24 is about 6 s on a four-core VM, from 14 s on 15 October.
  - What's left is rendering (about 30%), garbage collection (about 15%) and strip layout (about 12%), with no single
    hotspot. A full C port was weighed and declined: the expected gain is small, and it would move every golden.
- [ ] **Roundel composition in the worker with a time cap** (see Next up).
- [?] **Print files are large:** the A1 sheet is 48 MB and the wedding sheet 12 MB. Coarser Iznik detail or coarser
  coordinates would shrink them, but both change the image slightly.

## Fabrication and export

- [ ] **A true relief render** to go with the relief map and STL (see Material rendering).

## Docs and process

- [~] **Finish the istif write-up** (see Next up).
- [ ] **Bring CLAUDE.md up to date.** Its migration plan is finished, and it still names retired paths such as
      `src/ui`.
- [ ] **Add PLAN-2 to the repo** (see Next up).
- [~] **Chronogram Hijri/CE conversion uses the lab's approximations** (`src/studio/chronogram.ts`).

## Decided: not doing

- **The lab's silhouette fields, in lab form.** The port has its own shaped fields.
- **Not ported from the lab** (refresh/PORT-PLAN.md):
  - cradle combined with paths or storeys
  - the storey model
  - hairlines in mirrored work
  - double symmetry
  - parallel diagonal lanes
- **Fitting the critic to synthetic damaged pairs:** tried, it didn't help.
- **A HarfBuzz and font-based cursive engine:** superseded by the pen-stroke thuluth engine.
- **A full C/WebAssembly rewrite.** Targeted kernels instead: `partition`, the rasteriser and Clipper2.

## Done (milestones)

- **The migration from the prototype, steps 1–7** (CLAUDE.md), and **COMPOSITION_ENGINE Phases 0–6**:
  - fills, flow, weave, tughra loops, long alternates, speed, fabrication, the visual critic
  - the Kufic lab port §1–§7
- **The thuluth port, HANDOVER PRs 1–9:**
  - the core, the strip adapter and mixed scripts
  - roundels, multigrid tilings and Iznik
  - legibility rules and the letter fixes
- **The refreshed lab, PORT-PLAN 1–6, and PLAN-2 §1–§10:**
  - marks rules, paths and lanes, müsennâ, the critic and rating loop, learned stacking
  - shaped fields, exact girift, towers and nesting, shared-stroke gating, straight-to-round in CI
  - the Timurid band, and the first draft of the write-up
- **Showpieces:** Light upon light (A1), the mosque programme, Zainab and Qusay (A3), the names cartouche.
- **Native kernels:** `partition` and the rasteriser in C, and Clipper2's C++.
- **Pruned ring fitting.**
