// Writes golden snapshots of the prototype (legacy/index.html) into tests/golden/, or with --check verifies them.
//   node scripts/golden.mjs            regenerate all snapshots
//   node scripts/golden.mjs --check    regenerate in memory and fail on any difference
//   node scripts/golden.mjs <filter>   only cases whose id contains <filter>
import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CASES } from '../tests/golden/cases.mjs';
import { runCase } from '../tests/golden/harness.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = join(root, 'legacy/index.html');
const OUT = join(root, 'tests/golden');
const args = process.argv.slice(2),
  check = args.includes('--check'),
  filter = args.find(a => !a.startsWith('--'));
const cases = filter ? CASES.filter(c => c.id.includes(filter)) : CASES;

const files = new Map(); // relative path -> contents
const manifest = [];
for (const c of cases) {
  const r = runCase(SOURCE, c);
  files.set(`svg/${c.id}.svg`, r.svg + '\n');
  if (r.engine) files.set(`engine/${c.id}.json`, JSON.stringify(r.engine) + '\n');
  manifest.push({ id: c.id, ui: c.ui, engine: r.engine && r.engine.fn, render: r.render, meta: r.meta, warn: r.warn });
}
if (!filter) files.set('manifest.json', JSON.stringify(manifest, null, 1) + '\n');

let bad = 0;
if (check) {
  for (const [rel, s] of files) {
    const p = join(OUT, rel);
    if (!existsSync(p)) {
      console.error(`missing  ${rel}`);
      bad++;
    } else if (readFileSync(p, 'utf8') !== s) {
      console.error(`differs  ${rel}`);
      bad++;
    }
  }
  if (!filter)
    for (const dir of ['svg', 'engine'])
      for (const f of readdirSync(join(OUT, dir))) {
        if (!files.has(`${dir}/${f}`)) {
          console.error(`stale    ${dir}/${f}`);
          bad++;
        }
      }
  console.log(`${files.size} files checked, ${bad} problem${bad === 1 ? '' : 's'}`);
  process.exit(bad ? 1 : 0);
}
if (!filter) for (const dir of ['svg', 'engine']) rmSync(join(OUT, dir), { recursive: true, force: true });
for (const [rel, s] of files) {
  const p = join(OUT, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, s);
}
console.log(`wrote ${files.size} files for ${cases.length} cases`);
