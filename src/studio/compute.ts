// The studio's heavy work, wherever it runs: on the background worker (compute.worker.ts, driven by background.ts),
// or in the page's own thread where there are no workers (tests, old browsers). The preview's resolve and render, the
// fabrication exports and the 3D print's meshing. No DOM.
import { resolve } from '../compose';
import type { Placed } from '../compose/placed';
import { collectRoundels, prepareRoundel } from '../compose/roundel';
import { laserSVG, plotterSVG, reliefSVG } from '../fabricate';
import { heightmapFromPixels, heightmapToMesh, meshToSTL } from '../fabricate/mesh';
import type { HeightmapOptions, Pixels } from '../fabricate/mesh';
import { findLevels, terraceMesh } from '../fabricate/terrace';
import { setOverrides } from '../glyphs/overrides';
import type { GlyphOverride } from '../glyphs/overrides';
import { loadKernels } from '../kernels';
import type { Composition } from '../model/schema';
import { clearMonogramCache } from '../monogram/methods';
import { renderPlaced } from '../render/composition';
import { RoundelWorkers } from '../script/thuluth/roundel/parallel';

/** The user's letter edits ('GROUP.form' → rows): module state where the letters are drawn, so they go with a job. */
export type Glyphs = Record<string, GlyphOverride | undefined>;
export type FabKind = 'plot' | 'laser' | 'relief';
export interface StlRequest {
  pixels: Pixels;
  heightmap: HeightmapOptions;
  size: { widthMM: number; baseMM: number; reliefMM: number };
  /** Flat levels: their heights, or 'find' to look for them in the image; null for a shaded surface. */
  levels: number[] | 'find' | null;
  /** Samples across the longer side of a shaded surface. */
  resolution: number;
}
export type Job =
  | { kind: 'preview'; comp: Composition; glyphs: Glyphs; label: string }
  | { kind: 'fab'; comp: Composition; glyphs: Glyphs; what: FabKind }
  | ({ kind: 'stl' } & StlRequest);
export interface Preview {
  svg: string;
  meta: Placed['meta'];
}
export interface Stl {
  stl: Uint8Array;
  triangles: number;
  /** Flat faces that could not be closed cleanly. */
  open: number;
}
/** A job's result; null for a preview that a newer one superseded while it waited for its roundels. */
export type Result = Preview | string | Stl | null;

const ready = loadKernels();

// the letters as last drawn with: set again only when a job brings others (every set empties the letter caches)
let glyphKey = '{}';
function useGlyphs(g: Glyphs) {
  const key = JSON.stringify(g);
  if (key === glyphKey) return;
  glyphKey = key;
  setOverrides(g);
  clearMonogramCache();
}

// made when a composition first has a roundel to draw
let workers: RoundelWorkers | null = null;
const roundelWorkers = () => (workers ??= new RoundelWorkers());
/** resolve, with the composition's roundels drawn first on workers (as resolveAsync does), which are only started
 *  when there is a roundel to draw. A wait for the same roundels is shared; a wait for others is cancelled (and
 *  rejects). `waiting` is told when the wait starts and ends: while it lasts this thread is free for a newer job. */
let roundelWait: { key: string; done: Promise<unknown> } | null = null;
async function resolveWithRoundels(c: Composition, waiting: (on: boolean) => void): Promise<Placed> {
  let p: Placed | undefined;
  const asked = collectRoundels(() => (p = resolve(c))),
    key = asked.length ? JSON.stringify(asked) : '';
  if (roundelWait?.key !== key) {
    workers?.cancel();
    roundelWait = asked.length ? { key, done: Promise.all(asked.map(q => prepareRoundel(q, roundelWorkers()))) } : null;
  }
  // nothing left to draw: the look through was the whole resolve
  if (!asked.length) return p ?? resolve(c);
  const wait = roundelWait!;
  waiting(true);
  try {
    await wait.done;
  } finally {
    if (roundelWait === wait) roundelWait = null;
    waiting(false);
  }
  return resolve(c);
}

// the composition last resolved, for the exports made from it
let last: { key: string; placed: Placed } | null = null;
const keyOf = (c: Composition) => glyphKey + JSON.stringify(c);
// a newer preview supersedes the ones still waiting for roundels
let previews = 0;

/** Do a job. `waiting` (optional) hears when the job starts and stops waiting on other workers. */
export async function compute(job: Job, waiting: (on: boolean) => void = () => {}): Promise<Result> {
  await ready;
  if (job.kind === 'stl') {
    const hm = heightmapFromPixels(job.pixels, job.heightmap),
      flat = job.levels
        ? terraceMesh(hm, { ...job.size, levels: job.levels === 'find' ? findLevels(hm) : job.levels })
        : null,
      mesh = flat ?? heightmapToMesh(hm, { ...job.size, resolution: job.resolution });
    return { stl: meshToSTL(mesh), triangles: mesh.triangles.length / 3, open: flat?.failedFaces ?? 0 };
  }
  useGlyphs(job.glyphs);
  const key = keyOf(job.comp);
  if (job.kind === 'fab') {
    // not told to `waiting`: an export is not superseded, so nothing may come in and cancel its roundels
    const placed = last?.key === key ? last.placed : await resolveWithRoundels(job.comp, () => {});
    return job.what === 'plot' ? plotterSVG(placed) : job.what === 'laser' ? laserSVG(placed) : reliefSVG(placed);
  }
  const run = ++previews,
    placed = await resolveWithRoundels(job.comp, waiting);
  if (run !== previews) return null;
  last = { key, placed };
  return { svg: renderPlaced(placed, { idPrefix: 'pv', label: job.label }), meta: placed.meta };
}
