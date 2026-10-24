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

The page's source is `page/index.html` (published with each round's `items.json` and `img/`). A new round: run `npm run sweep` with `SWEEP_PREFIX` set (ids must not repeat across rounds), build the page's
`items.json` from the manifests with the fits in force, and publish the page with the new images.
