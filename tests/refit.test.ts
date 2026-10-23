// Refit the critic to the owner's votes (PLAN-2 §1). The rated compositions are kept as ink and field masks
// (tests/ratings/masks, cut from the lab's rating page) with their votes; each round rated on the published page keeps
// its candidates' features in tests/ratings/rounds/<round>/items.json and, once read back, its votes.json
// (tests/ratings/README.md; REFIT_EXTRA adds another such folder). `npm run refit` fits each genre and writes src/script/thuluth/roundel/fits.data.ts, reporting the
// leave-one-out accuracy, and whether each reported check would improve it if promoted into the score. Without REFIT,
// the test checks that the committed fits are what the votes give.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import type { Vote } from '../src/evolve/ratings';
import { fitPairwise } from '../src/evolve/ratings';
import type { DecoFeatures, Genre } from '../src/script/thuluth/roundel';
import { decoMetrics, FEATURES, noiseOf } from '../src/script/thuluth/roundel';
import { FITS } from '../src/script/thuluth/roundel/fits.data';

const dir = join(import.meta.dirname, 'ratings');

/** The lab's rated compositions: features from their masks, genre from their tags. */
function labSet() {
  const items: { id: string; tag: string }[] = JSON.parse(readFileSync(join(dir, 'items.json'), 'utf8')),
    votes: Vote[] = JSON.parse(readFileSync(join(dir, 'votes.json'), 'utf8')),
    feats: Record<string, DecoFeatures> = {},
    genre: Record<string, Genre> = {};
  for (const it of items) {
    const p = PNG.sync.read(readFileSync(join(dir, 'masks', `${it.id}.png`))),
      n = p.width * p.height,
      ink = new Uint8Array(n),
      field = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      ink[i] = p.data[i * 4] > 127 ? 1 : 0;
      field[i] = p.data[i * 4 + 1] > 127 ? 1 : 0;
    }
    const m = decoMetrics(ink, field, p.width, p.height);
    feats[it.id] = { texture: m.uniformity, knots: m.knots, looseTop: m.looseTop, unity: m.unity, span: m.span, fill: m.fill, noise: noiseOf(ink, field, p.width, p.height) }; // prettier-ignore
    // the mirrored names (Ali, Muhammad, Hu) against the dense phrases; no single unmirrored name was rated
    genre[it.id] = /musenna|COMBINED|hu |lamp|knot|cup hairline/.test(it.tag) ? 'mirror' : 'dense';
  }
  return { votes, feats, genre, checks: {} as Record<string, Record<string, number>> };
}
/** A newer round from the published rating page: its candidates (items.json: features, checks, genre, from the
 *  sweep) and the votes read back from the page's store (votes.json). */
function roundSet(d: string) {
  const man: { id: string; features: DecoFeatures; checks: Record<string, number> | null; genre: Genre }[] = JSON.parse(readFileSync(join(d, 'items.json'), 'utf8')).items, // prettier-ignore
    votes: Vote[] = JSON.parse(readFileSync(join(d, 'votes.json'), 'utf8'));
  return {
    votes,
    feats: Object.fromEntries(man.map(m => [m.id, m.features])),
    genre: Object.fromEntries(man.map(m => [m.id, m.genre])) as Record<string, Genre>,
    checks: Object.fromEntries(man.filter(m => m.checks).map(m => [m.id, m.checks!])),
  };
}
/** Every round in tests/ratings/rounds that has its votes, and REFIT_EXTRA if given. */
const rounds = () =>
  [
    ...(existsSync(join(dir, 'rounds')) ? readdirSync(join(dir, 'rounds')).map(r => join(dir, 'rounds', r)) : []),
    ...(process.env.REFIT_EXTRA ? [process.env.REFIT_EXTRA] : []),
  ].filter(d => existsSync(join(d, 'items.json')) && existsSync(join(d, 'votes.json')));

function refit() {
  const sets = [labSet(), ...rounds().map(roundSet)];
  const votes = sets.flatMap(s => s.votes),
    feats = Object.assign({}, ...sets.map(s => s.feats)) as Record<string, DecoFeatures>,
    genre = Object.assign({}, ...sets.map(s => s.genre)) as Record<string, Genre>,
    checks = Object.assign({}, ...sets.map(s => s.checks)) as Record<string, Record<string, number>>;
  const fitOf = (ids: string[], extra: string[] = []) => {
    const keep = new Set(ids),
      vs = votes.filter(v => keep.has(v.a) && keep.has(v.b)),
      fs = Object.fromEntries(ids.map(id => [id, [...FEATURES.map(k => feats[id][k]), ...extra.map(c => checks[id]?.[c] ?? 0)]])); // prettier-ignore
    return { vs, ...fitPairwise(vs, fs, { looTest: true }) };
  };
  const all = Object.keys(feats),
    out: Record<string, unknown> = {},
    report: string[] = [];
  for (const g of ['dense', 'mirror', 'single'] as Genre[]) {
    let ids = all.filter(id => genre[id] === g),
      from: string = g;
    // a genre with too few votes of its own borrows the fit over every genre until it has them
    if (fitOf(ids).vs.length < 20) {
      ids = all;
      from = 'all';
    }
    const f = fitOf(ids);
    out[g] = { features: FEATURES, w: f.w, mean: f.mean, sd: f.sd, votes: f.vs.length, loo: f.loo, from };
    report.push(`${g}: ${f.vs.length} votes (${from}), leave-one-out ${(100 * f.loo!).toFixed(1)}%`);
    // a reported check is promoted only if it predicts the votes: compare the fit with it
    const withChecks = ids.filter(id => checks[id]);
    for (const c of ['wordSpace', 'strayMarks', 'strayDots', 'doubled'])
      if (withChecks.length >= 10) {
        const a = fitOf(withChecks),
          b = fitOf(withChecks, [c]);
        report.push(`  ${c}: ${(100 * a.loo!).toFixed(1)}% → ${(100 * b.loo!).toFixed(1)}% with it`);
      }
  }
  return { out, report };
}

const fmt = (o: Record<string, unknown>) =>
  `// Generated by \`npm run refit\` (tests/refit.test.ts): do not edit.
import type { DecoFeatures } from './deco';
export interface Fit {
  features: (keyof DecoFeatures)[];
  w: number[];
  mean: number[];
  sd: number[];
  /** Votes fitted, and the share of them a fit without each one predicts. */
  votes: number;
  loo: number;
  /** The genre whose votes made the fit ('all' while a genre has too few of its own). */
  from: string;
}
// prettier-ignore
export const FITS: Record<'dense' | 'single' | 'mirror', Fit> = ${JSON.stringify(o)};
`;

describe('the critic fitted to the owner’s votes', () => {
  it.runIf(!process.env.REFIT)(
    'is what the votes give, and predicts most of them',
    () => {
      const { out } = refit();
      for (const g of ['dense', 'mirror', 'single'] as Genre[]) {
        const a = out[g] as (typeof FITS)['dense'];
        a.w.forEach((w, j) => expect(FITS[g].w[j]).toBeCloseTo(w, 6));
        expect(FITS[g].loo).toBeGreaterThan(0.6);
      }
    },
    600_000,
  );
  it.runIf(!!process.env.REFIT)(
    'refits',
    () => {
      const { out, report } = refit();
      writeFileSync(join(import.meta.dirname, '../src/script/thuluth/roundel/fits.data.ts'), fmt(out));
      console.log(report.join('\n'));
    },
    3_600_000,
  );
});
