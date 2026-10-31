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

1. **[~] A second round of ratings, on today's engine.** Published 30 October (`tests/ratings/rounds/2026-10-30`);
   waiting on votes. Most of the open composition work is a built option waiting
   on ratings, and the critic is not yet good enough to stand in for them. Dense roundels fit at 78%, mirrored at 75%
   and single names at 87%; the target is 85% (`10f7d0f`, `719cd4a`).
   - **Contents (owner, 30 October):**
     - ruled roundels, against free and lanes, on the same texts;
     - each built option as an on/off pair: girift, learned stacking, towers, mark spacing, nesting.
   - **Refit:** offer the reported checks as candidates, and promote any that earn their weight.
   - **Option pairs** are built on fitted lanes, not free composition: free composition scatters (see below), and a
     pair whose sides are both scattered says nothing about the option. Towers changed nothing in two of its four
     pairs, which were dropped.
   - **Who does what:** I sweep and publish the round; you vote. The loop is in `tests/ratings/README.md`.
2. **[~] Legibility first: one basmala roundel set by hand until it reads, then its rules.** An outside judge could
   read none of round 2's dense roundels (30 October): some letters were clear, the order was not. The owner's plan:
   - pin one basmala by hand on the tuning page, first on a straight line, then in a circle (owner, 31 October) (https://claude.ai/artifact/Nq3Ynm7NjHrfdKrkeRrKz7,
     `demos/tune.html`), until it is right;
   - reverse-engineer it: measure its word spacing, line steps, stacking and marks, and turn them into a reading check
     that every roundel must pass before taste scores it;
   - then train the critic on legibility as well as taste, and refit with round 2's held votes.
   - **Landed 31 October, from reading the round 2 roundels letter by letter:** the order was lost in two ways, a
     stacked join dropping a word's last letters (ـمن, ـيم) into the next line, and the next word slid in to the right
     of them. Three changes: a reading-order rule on the letters' bodies (`roundel/bodies.ts`: stems and tails are
     not bodies; a later word's bodies must lie left of an earlier word's where level, and never higher),
     kept by the composer in every mode, weighed by the judge and reported as the check `reading`; stacked joins are
     opt-in (`stackPull`, learned stacking, towers or `stackAt`), since rewarded by default they turned every hah and
     mim join into a staircase; and filler ornaments only in pockets among the letters, never out by the rim, where
     they read as stray dots. On the basmala, salawat and الحمد لله: reading faults 0 across lanes and ruled (from
     2–261), every word on its own line.
   - **Landed the same night (overnight run, 31 October to 1 November):** ruled lines are the default for three
     words or more (the Studio's dense texts get kashidas and kerning with it; free composition is out of the
     sweep's families); the number of lines is chosen by roundness (each line about a word high, the block about
     the field's proportion) and carried as a prior, so a dense text no longer ends as two wide lines in a flat
     oval; a ruled line's band holds the letters' bodies only, so tails and stems interlock between tiers; kerned
     pieces stop 0.4 of a pen short of touching; vowels keep within four pens of their letter; the long fatha only
     across a gap; stacked joins on offer at a small cost rather than rewarded. Judged by eye on five texts (the
     basmala, the salawat, الحمد لله رب العالمين, the shahada, the opening of Ayat al-Kursi), plain and vocalised:
     see the write-up and the round 3 pairs. Still open: the hand-pinned basmala, a rule tying stacked drops to the
     line pitch, and the critic's legibility training.
3. **[ ] A thuluth inscription band that reads strictly right to left.** Long bands such as Ayat al-Kursi still tangle
   their reading order (lab HANDOVER §11). The lab's `bandCompose` (`refresh/lab/band.js`) is the proposed basis
   (refresh/HANDOVER.md, addendum 2). This is also the first step towards tughra-style thuluth (see Thuluth
   composition).
4. **[ ] Roundel composition in the worker, with a time cap.** A roundel takes 20–60 s (lab HANDOVER §6). The roundel
   tests take 30–70 s each, and CI went from about 2 to 6½ minutes with them (run 172).
5. **[ ] The inscription ring and illumination from the lab's `ring.js`:** rays, panel and Iznik panel round a
   roundel. They are not ported; the roundel renderer says so (`src/script/thuluth/roundel/render.ts:1`).
6. **[~] Finish the istif write-up** (`docs/writeup/thuluth-istif.md`):
   - rebuild its showpieces on the finished engine;
   - report the critic's accuracy on the second rating round;
   - compare against masters' istif with the same critic.

   Candidate venues: Bridges, Nexus Network Journal, the Eurographics expressive track.

7. **[ ] Housekeeping:**
   - Bring CLAUDE.md up to date. Its migration plan is finished, and its roadmap now points here.

---

## Thuluth letters

- [~] **Heh is the weakest letter; it needs a master example.**
  - The initial heh was redone as a split, two-eyed form (`63c3861`). The medial heh is unchanged: a figure-of-eight
    came out too close to mim.
  - Source: refresh/HANDOVER.md, letters; `tests/thuluth-legibility.test.ts`.
- [!] **The dense loop heads sit under the 0.3 confusion threshold.** These are fa and qaf, heh and mim, in initial
  and medial position. The test holds each at its present distance, so they may move apart but never closer.
  Initial fa/heh is the closest pair, at 0.18 (`tests/thuluth-legibility.test.ts`, confusion matrix).
- [ ] **The final ya at ordinary size is still hand-drawn.** The only master instance is a great sweep (lab HANDOVER
      §11).
- [ ] **The lab's "initial lam/tooth at 0.35" finding was never explained** (refresh/HANDOVER.md). The port has since
      redrawn the initial and medial lam. Check whether the finding still holds.
- [~] **The name of God is now one ligature** (owner, 30 October; `ALLAH_*` in `src/script/thuluth/fixes.ts`): lams
  shorter than the alif and joined in bowls, the heh a tall arch as high as the lams, the shadda on the second lam
  level with the alif's top, the small alif only where a vowelled text writes it. It is drawn everywhere thuluth writes
  الله; the lab's letters (`labLetters`) keep the old form. Still to judge on the tuning page.
  - Since the lams were shortened, the girift dial no longer draws the basmala in tighter; it still makes crossings
    (`tests/thuluth-paths.test.ts`).
- [~] **Mim, tah and lam-alif are hand-drawn and only "acceptable"** (lab HANDOVER §4). Each
  needs a master fit when photos allow.
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
- [!] **Free composition scatters the words.** Without lanes, a path or ruling, a dense roundel nearly always ends
  as small words strewn across a large field (fill under 0.05, against 0.08–0.14 for lanes and ruled). In round 1,
  every free dense roundel but one was disliked. **Why (31 October):** nothing in the energy pulls consecutive words
  together. The only cohesion is the fill term, which is flat for every word not on the hull of the enclosing disc,
  and the overlap term (on masks grown by a margin) pushes neighbours apart, so random word moves drift outward and
  the disc follows them; the reading-order rule is satisfied by a scatter too. A cohesion term (the gap from each
  word's last body to the next word's head, beyond a word space, squared) would mend it. Since 1 November free
  composition is off the defaults for three words or more (ruled lines are), and out of the sweep's families; it
  stays selectable (`ruled: false`, the Studio's "free").
- [!] **Great bowls need an oval:** in a circle the bowl and the circle fight (lab HANDOVER §11). Either guard against
  it or design for it.
- [~] **A ta marbuta lifted onto another word's stroke by stacking can still get past the critic.** `orderFault`
  covers stacking itself (`c786fae`, `7380a89`).
- [ ] **The pen-writing animation (`renderRoundel animate`)** has no port.
- [r] **Built options, each waiting on ratings:**
  - ruled composition (`1519791`)
  - the girift dial (`9274874`, `e06c0d0`)
  - learned stacking (`a6a785f`) and towers (`8554321`): since 1 November a single shallow stacked join is on offer
    by default at a small cost; these, `stackAt` and an explicit `stackPull` (1.6 restores the lab's reward) are the
    routes to deeper and rewarded stacking
  - hairline piercing (`e06c0d0`)
  - nesting, drawn-out tails, rising stems and `stackAt` (`d77fd76`, `1d7f561`, `8727be9`)
  - mark `clearance`, `markDensity` and `fathaGap` (`8271e6f`)
- [r] **The Timurid band (Kufic over jali thuluth)** becomes a preset only once it rates well (`bd147de`). It is not
  in round 2, so it stays a showpiece until a later round.

## Kufic engine

- [~] **A full Fatimid letter set**, as vector stroke skeletons with an editor. There is a cell-based `fatimid` set
  (`ae2d8bd`), but the letter editor is still cell-based (docs/letters.md; COMPOSITION_ENGINE.md 6.6). Rana Kufi may
  be used for proportions only.
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

- [r] **Thuluth is never bred at random** (prior 0) until taste or a lock asks for it (`src/evolve/genes.ts`).

## Evolution, critic and ratings

- [~] **The critic's accuracy on the current engine is below target:** dense 78%, mirrored 75%, single 87%, against
  85%. Dislikes flatter it (`844ad32`, `10f7d0f`).
- [r] **The reported checks** (word space, stray marks and dots, doubled ink, clashes, crossings, alignment, and
  since 31 October the reading order of the letters' bodies) are
  candidates in the round 2 refit, not promoted before it (`src/evolve/critic.ts:130`, `844ad32`).
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

## Fabrication and export

- [ ] **A true relief render** to go with the relief map and STL (see Material rendering).

## Docs and process

- [~] **Finish the istif write-up** (see Next up).
- [ ] **Bring CLAUDE.md up to date.** Its migration plan is finished, and it still names retired paths such as
      `src/ui`.
- [~] **Chronogram Hijri/CE conversion uses the lab's approximations** (`src/studio/chronogram.ts`).

## Decisions

Taken with the owner on 30 October 2026:

- **Final and isolated seen:** keep the construction (teeth, then the final nun's bowl). Replace it if a master
  example turns up.
- **The route `calliar3` (the sharp V)** is out of the defaults (`path: 'auto'` and the sweep), and stays selectable
  by name.
- **Mirrored work** refuses الله only.
- **Rana Kufi** is for proportions only. No outlines are copied, and the licence stays as it is.
- **The Timurid band** is rated before it becomes a preset (not in round 2).
- **The reported checks** wait for the round 2 refit.
- **The rating page** stays a published page, linked from the Studio's Trainer tab.
- **Print files** stay as they are, at full detail.
- **Solid heads** (mim, waw, initial heh and initial ta at the roundel pen) are accepted as the jali convention, not a
  defect.
- **PLAN-2** is not needed in the repo; the commits record it.

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
