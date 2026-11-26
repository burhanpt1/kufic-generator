# The owner's ratings

What the critic is fitted to (`npm run refit`, tests/refit.test.ts, writing `src/script/thuluth/roundel/fits.data.ts`).

- `items.json`, `votes.json`, `masks/`: the lab's 81 rated compositions and 148 votes. The images were cut from the
  lab's rating page (prototypes/thuluth-lab/refresh/tools/rating-page.html): each one's field, found inside its
  gilded rim, resampled to 480 pixels across, gold ink in red and the field in green.
- `rounds/<date>/items.json`: a round rated on the published rating page
  (https://claude.ai/artifact/UcCKG5Zx84ZZEvmoTWSHuj): each candidate's critic features, checks, genre and recipe,
  from `npm run sweep`. The page keeps its votes in its own store, collection `votes` ({a, b, w: 'a' | 'b' | 'tie',
  t, by}).

To refit after a batch of votes: read the page's `votes` collection back (Claude: ArtifactData list on the page's URL),
save it as `rounds/<date>/votes.json` (an array of {a, b, w, t}); save the `dislikes` collection's ids as
`rounds/<date>/dislikes.json` (each disliked composition counts as losing to up to five of its genre that won a vote);
and run `npm run refit`. A tie means both weak but not bad enough to set aside: each tied composition that never won
counts as losing to up to two of its genre that did. It reports each genre's
leave-one-out accuracy, and for each reported check whether adding it would raise that accuracy: a check is promoted
into the score only when it does.

## How good the fit is: which number to quote

`npm run refit` ends with a table per genre (`evalPairwise`, src/evolve/ratings.ts; it measures the fit and does not
change it). Quote the first line, with its interval, and nothing else:

- **Real votes, both compositions held out.** Each vote the owner cast is predicted by a fit that saw no row with
  either of its two compositions, and took its mean and spread without them. This is what the critic can be expected
  to do on a composition it has never seen. The 95% interval beside it (Wilson's) says how little that many votes pin
  down: with 17 votes it is some forty points wide.
- **One feature's sign alone, chosen inside the same folds.** The bar to clear: pick the single feature, and whether
  more or less of it is better, that gets most of the training rows right, and use only that. A fit that does not beat
  this has learnt one thing.
- **One feature's sign alone, chosen on the votes it is scored on.** The same, but picked knowing the answers, so it
  flatters itself; it names the feature. Not comparable with the first line.
- **Real votes, plain leave-one-out.** Only the one vote is left out; other votes on the same compositions stay.
- **Every row, plain leave-one-out (the old figure).** What `fits.data.ts` keeps as `loo`, and what was quoted before.
  It counts the rows made up from dislikes and ties as if they were votes: a disliked composition loses to up to five
  winners, so leaving one such row out leaves its four twins in, and the fit is marked on what it was just told. Do
  not quote it as accuracy. (`votes` in `fits.data.ts` also counts ties, which the fit skips.)

With the votes of 2026-10-24 (lab and round 1):

| genre  | real votes | made-up rows | to quote (95% interval)     | one feature, in fold | real, plain | old figure |
| ------ | ---------- | ------------ | --------------------------- | -------------------- | ----------- | ---------- |
| dense  | 79         | 68           | 60.8% (49.7% to 70.8%)      | 55.7%                | 64.6%       | 78.2%      |
| mirror | 42         | 2            | 69.0% (54.0% to 80.9%)      | 61.9%                | 78.6%       | 75.0%      |
| single | 17         | 22           | 76.5% (52.7% to 90.4%)      | 52.9%                | 70.6%       | 87.2%      |

So: dense is not yet shown to be better than chance by much (its interval starts at a half), and fewer knots alone
gets 67.1% of its real votes when picked knowing them. More real votes, not more made-up rows, is what narrows this.

A round can also hold designed pairs: one option off and on, with the same text, seed and recipe
(`rounds/<date>/pairs.json`, swept with `SWEEP_PAIRS=<that file> npm run sweep`; SWEEP_OPTIONS keeps some of its
options). Each side's item carries `option`, `variant` ('off' | 'on') and `pairOf`, and the round's `items.json` lists
the pairs as `pairs` ([off id, on id]); the page offers those, in random order, before any pair it chooses itself.
A vote on a pair counts towards the refit like any other; read per option, it says whether the option helps.

Round 2 (`rounds/2026-10-30`): the ruled mode against free and lanes on the three dense texts (ids `r…`), and on/off
pairs for girift, learned stacking, towers, nesting and mark spacing (`clearance` 0.5 with `fathaGap`, on vocalised
texts) (ids `pa…` to `pd…`). Its votes are kept as `votes.held.json` and `dislikes.held.json`, which the refit does not
read: the owner holds the refit until the legibility work lands (an outside judge could read none of the dense texts),
and then they are renamed back.

The 1 November round (`rounds/2026-11-01`, ids `r3o…` and `r3n…`; on the main rating page, which calls it round 3
there): the old engine against the new, 28 pairs. Each pair is the same text, family (lanes or ruled) and seed, drawn
by main at `cdf47a1` (`variant: 'off'`, ids `r3o…`) and by the branch of the overnight legibility work of 31 October
(`variant: 'on'`, ids `r3n…`; the reading-order energy term, ruled lines by default, stacking at a cost): the basmala,
the salawat, الحمد لله رب العالمين, the shahada and the opening of Ayat al-Kursi, with the basmala and salawat
vocalised too. `scripts/round3.mjs` built it from the two sweeps (`SWEEP_N=2 SWEEP_FAMILIES=lanes,ruled`, the same
`SWEEP_TEXTS` order on both sides); its `items.json` is the published file, with each item's `url` and the fits in
force. Its votes (`votes.held.json`, `dislikes.held.json`, read back from the page's `votes` and `dislikes` by the `r3`
ids) are held like round 2's. After 15 votes on 1 November the vote went 7 for the new engine, 8 for the old, no tie, and 16 of
the 28 pairs were disliked on both sides: the new engine was no better by the owner's eye, and that composition work
was set aside for the letters-first basis (ROADMAP, Next up). What was kept of it is the reading-order check, the
ornament pockets, and the letter redraws as a draft to judge (`alts.redrawn`).

The page's source is `page/index.html` (published with each round's `items.json` and `img/`). A new round: run `npm run sweep` with `SWEEP_PREFIX` set (ids must not repeat across rounds), build the page's
`items.json` from the manifests with the fits in force, and publish the page with the new images.

Round 3 (`rounds/2026-11-15`, ids `q…`): 31 on/off pairs (ids keep the sweep's numbering; q014 and q015, a pair
whose off side came out as a scatter, were dropped) on the legibility work, each on fitted
lanes and on ruled lines. `wordGap` (2.4 in lanes, 1.6 ruled) against none; `innerGap` 0.7 on top of wordGap; and, on
top of both, the drafted letters: `stems` c, `muhammad` c, and the two together (`letters`). A pair on the letters
names its alternatives on the side that has them (`alts` in `pairs.json` and on the item); the sweep writes that side
with them on the same pen.

Round 3 is voted on its own page (https://claude.ai/artifact/3xqoZGMAQc4BVbtqKwsAPe; source `rounds/2026-11-15/vote.html`,
published with the round's 62 pictures as `img/<id>.png`). It shows one pair at a time with the sides shuffled, and
keeps one document per pair in its collection `votes`, named by the pair's off side: `{a, b, w: 'a' | 'b' | 'tie',
bad, option, t}`, where `a` is the off side, `b` the on side, and `bad` marks "both poor". Beside the pair it reads
the votes per option: "clear" when the split of decided pairs passes a sign test at 5%, "leaning" at three in four.
To read the round back (Claude: ArtifactData list on the page's URL, collection `votes`): save the documents as
`rounds/2026-11-15/votes.json` ({a, b, w, t}, as for the other rounds) and the ids of both sides of every `bad` pair
as `dislikes.json`. An option whose reading is clear is promoted or dropped on that; the votes also go to the refit.

Round 3 was voted on 15 November (31 pairs): 18 pairs "both poor", 7 for the option on, 6 for it off. No option is
clear or even leaning (wordGap 2–1, innerGap 2–1, stems c 1–2, muhammad c 1–1, both letters 1–1), so none is promoted
or dropped on this round. Its votes are kept as `votes.held.json` and `dislikes.held.json`, like round 2's: a refit
with them takes dense from 147 rows to 340, of which 248 are made up from the 36 set-aside roundels, and moves the
dense weights a long way on those rows (real votes held out: 64.1%, 59 of 92, interval 53.9% to 73.2%; one feature
alone 60.9%). The round's finding is the 18: at the sweep's effort the roundels themselves are judged poor whatever
the option, and none of the critic's features tells the 36 set aside from the 13 chosen.
