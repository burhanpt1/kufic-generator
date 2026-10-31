// Builds a rating round that sets one engine against another (round 3: the old engine against the new). Each side is a
// sweep directory from `npm run sweep` (manifest.json and a PNG per candidate), made with the same SWEEP_TEXTS (same
// order), SWEEP_FAMILIES and SWEEP_N, and its own SWEEP_PREFIX (r3o for the old engine, r3n for the new) so that no id
// repeats across rounds.
//   node scripts/round3.mjs --old <dir> --new <dir> --out <dir> --round <name> [--page <url>] [--fits <fits.data.ts>]
//                           [--old-prefix r3o] [--new-prefix r3n]
// Candidates are matched by text and family, first those with the same seed, then the rest in order; the surplus on
// either side is dropped. <out> gets img/<id>.png and items.json, in the shape the rating page loads
// (tests/ratings/page/index.html): the sweep's fields, `option: 'engine'`, `variant` ('off' is the old engine, 'on'
// the new), `pairOf`, and `pairs` as [old id, new id]. The page also reads each item's `url` and the critic's `fits`
// (the fitted taste, from src/script/thuluth/roundel/fits.data.ts), which the round files kept in tests/ratings/rounds
// leave out; without them it shows no images and fails at the first vote.
// pairs.json is not written: in tests/ratings/rounds it is the input of `SWEEP_PAIRS`, option toggles within one
// engine, and an old-against-new pair is not one.
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..'),
  ratings = join(root, 'tests/ratings'),
  { values: arg } = parseArgs({
    options: {
      old: { type: 'string' },
      new: { type: 'string' },
      out: { type: 'string' },
      round: { type: 'string' },
      page: { type: 'string', default: 'https://claude.ai/artifact/UcCKG5Zx84ZZEvmoTWSHuj' },
      fits: { type: 'string', default: join(root, 'src/script/thuluth/roundel/fits.data.ts') },
      'old-prefix': { type: 'string', default: 'r3o' },
      'new-prefix': { type: 'string', default: 'r3n' },
    },
  }),
  fail = msg => {
    console.error(`round3: ${msg}`);
    process.exit(1);
  };
for (const k of ['old', 'new', 'out', 'round']) if (!arg[k]) fail(`--${k} is required`);
if (arg['old-prefix'] === arg['new-prefix']) fail('the two prefixes must differ');
const out = resolve(arg.out);

/** A sweep directory's candidates, each checked for its prefix, its PNG, and not being from a SWEEP_PAIRS sweep. */
function readSide(dir, prefix) {
  const file = join(dir, 'manifest.json');
  if (!existsSync(file)) fail(`${file} not found`);
  const items = JSON.parse(readFileSync(file, 'utf8'));
  if (!items.length) fail(`${file} is empty`);
  for (const m of items) {
    if (!m.id.startsWith(prefix))
      fail(`${m.id} in ${dir} lacks the prefix ${prefix}: sweep with SWEEP_PREFIX=${prefix}`);
    if (m.option) fail(`${m.id} in ${dir} comes from a SWEEP_PAIRS sweep; each side must be a plain sweep`);
    if (!existsSync(join(dir, `${m.id}.png`))) fail(`${m.id}.png is missing from ${dir}`);
  }
  return items.map(m => ({ ...m, dir }));
}

/** Ids already used by the lab set and earlier rounds (the page's store keeps their votes), except this round's own. */
function earlierIds() {
  const rounds = existsSync(join(ratings, 'rounds')) ? readdirSync(join(ratings, 'rounds')) : [],
    files = [join(ratings, 'items.json'), ...rounds.map(r => join(ratings, 'rounds', r, 'items.json'))],
    ids = new Set();
  for (const f of files.filter(f => existsSync(f) && dirname(f) !== out)) {
    const j = JSON.parse(readFileSync(f, 'utf8'));
    for (const m of j.items ?? j) ids.add(m.id);
  }
  return ids;
}

/** The critic's fits: the object literal in fits.data.ts, which is plain JSON. */
function readFits(file) {
  const m = /export const FITS[^=]*=\s*(\{.*\});/s.exec(readFileSync(file, 'utf8'));
  if (!m) fail(`no FITS in ${file}`);
  const fits = JSON.parse(m[1]);
  for (const g of ['dense', 'single', 'mirror']) if (!fits[g]) fail(`${file} has no fit for ${g}`);
  return fits;
}

/** Match two candidate lists: equal seeds first, then in order. Returns [old, new] pairs in the old list's order. */
function match(olds, news) {
  const rest = [...news],
    pairs = [],
    left = olds.filter(o => {
      const i = rest.findIndex(n => n.seed === o.seed);
      if (i >= 0) pairs.push([o, rest.splice(i, 1)[0]]);
      return i < 0;
    });
  left.forEach((o, i) => i < rest.length && pairs.push([o, rest[i]]));
  return pairs.sort((p, q) => olds.indexOf(p[0]) - olds.indexOf(q[0]));
}

const olds = readSide(resolve(arg.old), arg['old-prefix']),
  news = readSide(resolve(arg.new), arg['new-prefix']),
  taken = earlierIds(),
  fits = readFits(arg.fits),
  ids = [...olds, ...news].map(m => m.id);
if (new Set(ids).size !== ids.length) fail('an id occurs twice across the two sides');
for (const id of ids) if (taken.has(id)) fail(`${id} was used in an earlier round`);

// group by text and family, in the old side's order; a group present on one side only has nothing to be paired with
const groups = new Map(),
  group = m => {
    const k = `${m.text}\n${m.family}`;
    if (!groups.has(k)) groups.set(k, { olds: [], news: [] });
    return groups.get(k);
  };
for (const m of olds) group(m).olds.push(m);
for (const m of news) group(m).news.push(m);
const pairs = [...groups.values()].flatMap(g => match(g.olds, g.news)),
  KEYS = ['id', 'text', 'family', 'genre', 'features', 'checks', 'recipe', 'seed', 'score'],
  item = (m, variant, pairOf) => ({
    ...Object.fromEntries(KEYS.map(k => [k, m[k]])),
    option: 'engine',
    variant,
    pairOf,
    url: `img/${m.id}.png`,
  });

mkdirSync(join(out, 'img'), { recursive: true });
const items = [];
for (const [o, n] of pairs) {
  items.push(item(o, 'off', n.id), item(n, 'on', o.id));
  for (const m of [o, n]) copyFileSync(join(m.dir, `${m.id}.png`), join(out, 'img', `${m.id}.png`));
}
writeFileSync(
  join(out, 'items.json'),
  JSON.stringify({ round: arg.round, page: arg.page, fits, items, pairs: pairs.map(([o, n]) => [o.id, n.id]) }, null, 1), // prettier-ignore
);

// what was paired, and what was left out or differs beyond the engine
const dropped = olds.length + news.length - 2 * pairs.length,
  differ = new Set(),
  seeds = pairs.filter(([o, n]) => o.seed !== n.seed).length;
for (const [o, n] of pairs) for (const k of new Set([...Object.keys(o.recipe), ...Object.keys(n.recipe)])) if (JSON.stringify(o.recipe[k]) !== JSON.stringify(n.recipe[k])) differ.add(k); // prettier-ignore
console.log(`${pairs.length} pairs (${items.length} images) in ${out}; ${dropped} candidates left out (${olds.length} old, ${news.length} new)`); // prettier-ignore
for (const g of groups.values()) {
  const m = g.olds[0] ?? g.news[0];
  if (!g.olds.length || !g.news.length) console.warn(`${m.text} (${m.family}) has candidates on one side only`);
}
if (seeds)
  console.warn(
    `${seeds} of the pairs have different seeds (a near-duplicate was dropped on one side, or the texts came in another order)`,
  );
if (differ.size) console.warn(`recipes differ between sides in: ${[...differ].join(', ')}`);
