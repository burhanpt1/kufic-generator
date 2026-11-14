// The studio's background thread (src/studio/background.ts): the preview it composes is the one the page's own thread
// would draw, with the user's letters; only the newest preview is ever answered; a worker that hangs or cannot start
// does not take the preview with it.
import { afterAll, describe, expect, it } from 'vitest';
import { resolve } from '../src/compose';
import { setOverrides } from '../src/engine';
import { reliefSVG } from '../src/fabricate';
import { preset } from '../src/model/presets';
import type { Composition } from '../src/model/schema';
import { renderPlaced } from '../src/render/composition';
import { Background } from '../src/studio/background';
import { compute } from '../src/studio/compute';
import type { Glyphs, Job, Preview } from '../src/studio/compute';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms)),
  within = <T>(p: Promise<T>, ms = 2000) =>
    Promise.race([p, sleep(ms).then(() => Promise.reject(new Error('still waiting')))]);
const direct = (id: string, label: string) => renderPlaced(resolve(preset(id)), { idPrefix: 'pv', label });
const GLYPHS: Glyphs = {
  'ALEF.iso': ['###', '#..', '#..', '#..', '#..', '#..', '###'],
  'LAM.ini': { rows: ['#.#', '###', '#..', '#..', '#..', '#..', '###'], base: 0 },
};

describe('background work in this thread (no workers)', () => {
  const bg = new Background(null);
  // the letters are module state: leave them as they were found
  afterAll(async () => {
    await compute({ kind: 'preview', comp: preset('basmala-seal'), glyphs: {}, label: '' });
    setOverrides({});
  });

  it('is not threaded', () => expect(bg.threaded).toBe(false));
  it('draws the preview the page would draw, roundel and all', async () => {
    for (const id of ['fatimid-medallion', 'mihrab-ayat-al-kursi', 'basmala-seal', 'names-cartouche']) {
      const p = await bg.preview(preset(id), {}, 'a ' + id);
      expect(p!.svg, id).toBe(direct(id, 'a ' + id));
      expect(p!.meta, id).toEqual(resolve(preset(id)).meta);
      expect(p!.svg).toContain('aria-label="a ' + id + '"');
    }
  });
  it("draws with the user's letters, and without them again", async () => {
    const plain = direct('fatimid-medallion', 'x'),
      seal = direct('basmala-seal', 'x');
    const edited = await bg.preview(preset('fatimid-medallion'), GLYPHS, 'x'),
      sealEdited = await bg.preview(preset('basmala-seal'), GLYPHS, 'x');
    setOverrides(GLYPHS);
    expect(edited!.svg).toBe(direct('fatimid-medallion', 'x'));
    expect(edited!.svg).not.toBe(plain);
    // a monogram is remembered by its letters: the edit reaches it too
    expect(sealEdited!.svg).not.toBe(seal);
    expect((await bg.preview(preset('fatimid-medallion'), {}, 'x'))!.svg).toBe(plain);
    expect((await bg.preview(preset('basmala-seal'), {}, 'x'))!.svg).toBe(seal);
  });
  it('answers only the newest of several previews', async () => {
    const a = bg.preview(preset('octagon-panel'), {}, 'a'),
      b = bg.preview(preset('hexagon-lapis'), {}, 'b'),
      c = bg.preview(preset('teardrop-gold'), {}, 'c');
    expect(await a).toBeNull();
    expect(await b).toBeNull();
    expect((await c)!.svg).toBe(direct('teardrop-gold', 'c'));
  });
  it('reports a composition that cannot be laid out', async () => {
    const bad = { ...preset('octagon-panel'), root: null } as unknown as Composition;
    let why = '';
    try {
      resolve(bad);
    } catch (e) {
      why = (e as Error).message;
    }
    expect(why).not.toBe('');
    await expect(bg.preview(bad, {}, '')).rejects.toThrow(why);
  });
  it('makes the fabrication exports and a printable solid', async () => {
    const comp = preset('hexagon-lapis');
    expect(await bg.fab(comp, {}, 'relief')).toBe(reliefSVG(resolve(comp)));
    expect(await bg.fab(comp, {}, 'plot')).toContain('<svg');
    // an 8 × 8 image, white square on black
    const data = new Uint8ClampedArray(8 * 8 * 4);
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 8; x++) data.set(x > 1 && x < 6 && y > 1 && y < 6 ? [255, 255, 255, 255] : [0, 0, 0, 255], (y * 8 + x) * 4); // prettier-ignore
    const size = { widthMM: 40, baseMM: 1, reliefMM: 2 },
      req = { pixels: { width: 8, height: 8, data }, heightmap: { cutBelow: -1 }, size, resolution: 8 },
      flat = await bg.stl({ ...req, levels: 'find' }),
      surface = await bg.stl({ ...req, levels: null });
    for (const s of [flat, surface]) {
      expect(s.triangles).toBeGreaterThan(0);
      expect(s.stl.length).toBe(84 + 50 * s.triangles);
    }
  });
});

/** A stand-in worker under the test's hand: what was posted to it, and answers when the test says. */
function standIn() {
  const made: {
    posted: { id: number; job: Job }[];
    dead: boolean;
    say: (m: unknown) => void;
    error: () => void;
  }[] = [];
  const factory = () => {
    const w = {
        onmessage: null as ((e: MessageEvent) => void) | null,
        onerror: null as ((e: ErrorEvent) => void) | null,
        postMessage: (m: { id: number; job: Job }) => void s.posted.push(structuredClone(m)),
        terminate: () => void (s.dead = true),
      },
      s = {
        posted: [] as { id: number; job: Job }[],
        dead: false,
        say: (m: unknown) => void (!s.dead && w.onmessage?.({ data: m } as MessageEvent)),
        error: () => void w.onerror?.({} as ErrorEvent),
      };
    made.push(s);
    return w as unknown as Worker;
  };
  return { factory, made };
}
const drawing = (svg: string): Preview => ({ svg, meta: {} as Preview['meta'] });
const [A, B, C] = ['octagon-panel', 'hexagon-lapis', 'teardrop-gold'].map(preset);

describe('background work on a worker', () => {
  it('sends one preview at a time, and never answers with a superseded drawing', async () => {
    const s = standIn(),
      bg = new Background(s.factory),
      w = s.made[0];
    expect(bg.threaded).toBe(true);
    const a = bg.preview(A, {}, 'a'),
      b = bg.preview(B, {}, 'b'),
      c = bg.preview(C, GLYPHS, 'c');
    // b was never sent; a is with the worker, c waits for it
    expect(await within(b)).toBeNull();
    expect(w.posted.map(m => (m.job as { label: string }).label)).toEqual(['a']);
    w.say({ id: w.posted[0].id, ok: true, result: drawing('A') });
    expect(await within(a)).toBeNull();
    expect(w.posted.map(m => (m.job as { label: string }).label)).toEqual(['a', 'c']);
    expect((w.posted[1].job as { glyphs: Glyphs }).glyphs).toEqual(GLYPHS);
    w.say({ id: w.posted[1].id, ok: true, result: drawing('C') });
    expect((await within(c))!.svg).toBe('C');
    bg.terminate();
  });
  it('sends a newer preview at once while the worker waits for roundels', async () => {
    const s = standIn(),
      bg = new Background(s.factory),
      w = s.made[0],
      a = bg.preview(A, {}, 'a');
    w.say({ id: w.posted[0].id, waiting: true });
    const b = bg.preview(B, {}, 'b');
    expect(w.posted.length).toBe(2);
    // the worker cancels the wait: the old preview fails there, and is answered here as superseded
    w.say({ id: w.posted[0].id, waiting: false });
    w.say({ id: w.posted[0].id, ok: false, error: 'cancelled' });
    expect(await within(a)).toBeNull();
    w.say({ id: w.posted[1].id, ok: true, result: drawing('B') });
    expect((await within(b))!.svg).toBe('B');
    expect(s.made.length).toBe(1);
    bg.terminate();
  });
  it('replaces a worker that a superseded preview keeps for too long', async () => {
    const s = standIn(),
      bg = new Background(s.factory, { staleGraceMs: 30 }),
      a = bg.preview(A, {}, 'a'),
      b = bg.preview(B, {}, 'b');
    expect(await within(a)).toBeNull();
    expect(s.made.length).toBe(2);
    expect(s.made[0].dead).toBe(true);
    expect((s.made[1].posted[0].job as { label: string }).label).toBe('b');
    s.made[1].say({ id: s.made[1].posted[0].id, ok: true, result: drawing('B') });
    expect((await within(b))!.svg).toBe('B');
    bg.terminate();
  });
  it('fails a preview that hangs, with a fresh worker for the next', async () => {
    const s = standIn(),
      bg = new Background(s.factory, { jobTimeoutMs: 30 });
    await expect(within(bg.preview(A, {}, 'a'))).rejects.toThrow('timed out');
    expect(s.made.length).toBe(2);
    const b = bg.preview(B, {}, 'b');
    s.made[1].say({ id: s.made[1].posted[0].id, ok: true, result: drawing('B') });
    expect((await within(b))!.svg).toBe('B');
    bg.terminate();
  });
  it('does not time a preview while it waits for its roundels', async () => {
    const s = standIn(),
      bg = new Background(s.factory, { jobTimeoutMs: 30 }),
      w = s.made[0],
      a = bg.preview(A, {}, 'a');
    w.say({ id: w.posted[0].id, waiting: true });
    await sleep(80);
    w.say({ id: w.posted[0].id, waiting: false });
    w.say({ id: w.posted[0].id, ok: true, result: drawing('A') });
    expect((await within(a))!.svg).toBe('A');
    expect(s.made.length).toBe(1);
    bg.terminate();
  });
  it('passes on what the worker could not do, and keeps exports in turn behind the preview', async () => {
    const s = standIn(),
      bg = new Background(s.factory),
      w = s.made[0],
      fab = bg.fab(A, {}, 'laser'),
      a = bg.preview(A, {}, 'a');
    // the export went first (nothing was running); the preview follows it
    expect(w.posted.map(m => m.job.kind)).toEqual(['fab']);
    w.say({ id: w.posted[0].id, ok: true, result: '<svg/>' });
    expect(await within(fab)).toBe('<svg/>');
    expect(w.posted.map(m => m.job.kind)).toEqual(['fab', 'preview']);
    w.say({ id: w.posted[1].id, ok: false, error: 'no room for the text' });
    await expect(within(a)).rejects.toThrow('no room for the text');
    bg.terminate();
  });
  it('composes in this thread when the worker cannot start', async () => {
    const s = standIn(),
      bg = new Background(s.factory),
      a = bg.preview(preset('hexagon-lapis'), {}, 'a');
    s.made[0].error();
    expect((await within(a, 20_000))!.svg).toBe(direct('hexagon-lapis', 'a'));
    expect(bg.threaded).toBe(false);
    expect(s.made.length).toBe(1);
    expect((await bg.preview(preset('hexagon-lapis'), {}, 'b'))!.svg).toBe(direct('hexagon-lapis', 'b'));
  });
});
