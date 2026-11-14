// What the studio takes in from outside (a pasted or stored letter set) and hands out (file names, printable solids).
import { afterEach, describe, expect, it } from 'vitest';
import { downloadName } from '../src/app/export';
import type { EditorState } from '../src/app/letterEditor';
import { loadOverrides, sanitizeOverrides, STORAGE_KEY } from '../src/app/letterEditor';
import { getRows, setOverrides } from '../src/engine';
import { heightmapToMesh, MIN_BASE_MM } from '../src/fabricate/mesh';
import type { Heightmap, Mesh } from '../src/fabricate/mesh';
import { terraceMesh } from '../src/fabricate/terrace';

describe('letter sets from outside', () => {
  afterEach(() => {
    setOverrides({});
    delete (globalThis as { localStorage?: unknown }).localStorage;
  });
  const good = ['#..', '###'];
  it('keeps rectangles of # and . under known letter forms', () => {
    const r = sanitizeOverrides({ 'BEH.iso': good, 'ALEF.fin': ['#', '#', '#'] });
    expect(r).toEqual({ ovr: { 'BEH.iso': good, 'ALEF.fin': ['#', '#', '#'] }, dropped: 0 });
  });
  it('drops everything else, and counts it', () => {
    const r = sanitizeOverrides({
      'BEH.iso': [],
      'BEH.ini': ['##', '#'],
      'BEH.med': ['#x'],
      'BEH.fin': 'no',
      'HAH.iso': [''],
      'HAH.ini': [1, 2],
      'HAH.med': null,
      'NOPE.iso': good,
      'BEH.top': good,
      'BEH.iso.x': good,
      BEH: good,
      'DAL.iso': good,
    });
    expect(r.ovr).toEqual({ 'DAL.iso': good });
    expect(r.dropped).toBe(11);
  });
  it('keeps a { rows, base } entry with its baseline', () => {
    const r = sanitizeOverrides({
      'REH.iso': { rows: good, base: 1 },
      'REH.fin': { rows: good },
      'WAW.iso': { rows: [], base: 0 },
      'WAW.fin': { rows: good, base: -1 },
      'YEH.iso': { base: 1 },
    });
    expect(r.ovr).toEqual({ 'REH.iso': { rows: good, base: 1 }, 'REH.fin': good });
    expect(r.dropped).toBe(3);
  });
  it('takes nothing from what is not a set', () => {
    for (const v of [[], 'x', 3, true]) expect(sanitizeOverrides(v)).toEqual({ ovr: {}, dropped: 1 });
    expect(sanitizeOverrides(null)).toEqual({ ovr: {}, dropped: 0 });
  });

  const store = (v: string) => {
    const data = new Map([[STORAGE_KEY, v]]);
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, s: string) => void data.set(k, s),
    };
    return data;
  };
  const state = () => ({ edKey: 'BEH', edForm: 'iso', ra: 'desc', ayn: 'cup', la: 'plain', ovr: {} }) as EditorState;
  it('loads a stored set that would have broken the editor, without the broken entries', () => {
    const data = store(JSON.stringify({ 'BEH.iso': [], 'DAL.iso': good })),
      s = state();
    expect(loadOverrides(s)).toBe(1);
    expect(s.ovr).toEqual({ 'DAL.iso': good });
    expect(JSON.parse(data.get(STORAGE_KEY)!)).toEqual({ 'DAL.iso': good });
    // the letter the bad entry named still has rows to draw
    expect(getRows('BEH', 'iso')[0].length).toBeGreaterThan(0);
    expect(getRows('DAL', 'iso')).toEqual(good);
  });
  it('loads nothing from a store that is not JSON', () => {
    store('{oops');
    const s = state();
    expect(loadOverrides(s)).toBe(1);
    expect(s.ovr).toEqual({});
  });
});

describe('file names', () => {
  it('names a file after the preset, or the first words of the text', () => {
    expect(downloadName('بسم الله', 'Fatimid medallion')).toBe('fatimid-medallion');
    expect(downloadName('بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ')).toBe('بسم-الله-الرحمن-الرحيم');
    expect(downloadName('محمد علي\nفاطمة')).toBe('محمد-علي');
    expect(downloadName('Ali & Fatima / 2026')).toBe('Ali-Fatima-2026');
  });
  it('keeps nothing a file system would refuse, and stays short', () => {
    expect(downloadName('../..\\a:b*c?"<>|')).toBe('a-b-c');
    const long = downloadName('كلمة '.repeat(40));
    expect(long.length).toBeLessThanOrEqual(40);
    expect(long.endsWith('-')).toBe(false);
    expect(downloadName('x'.repeat(100)).length).toBe(40);
  });
  it('falls back to kufic', () => {
    expect(downloadName('')).toBe('kufic');
    expect(downloadName('  \n ')).toBe('kufic');
    expect(downloadName('!!! ---')).toBe('kufic');
  });
});

describe('solids with no base asked for', () => {
  // a step: the left half low (0), the right half high (1)
  const W = 24,
    H = 16,
    hm: Heightmap = {
      width: W,
      height: H,
      h: Float32Array.from({ length: W * H }, (_, i) => (i % W < W / 2 ? 0 : 1)),
      mask: new Uint8Array(W * H).fill(1),
    };
  /** Every edge is shared by exactly two triangles, in opposite directions. */
  const closed = (m: Mesh) => {
    const e = new Map<string, number>();
    for (let t = 0; t < m.triangles.length; t += 3)
      for (let k = 0; k < 3; k++) {
        const a = m.triangles[t + k],
          b = m.triangles[t + ((k + 1) % 3)];
        e.set(a + '>' + b, (e.get(a + '>' + b) ?? 0) + 1);
      }
    return [...e].every(([k, n]) => n === 1 && e.get(k.split('>').reverse().join('>')) === 1);
  };
  const minTop = (m: Mesh) => {
    // the lowest height above the floor
    let lo = Infinity;
    for (let i = 2; i < m.positions.length; i += 3) if (m.positions[i] > 0) lo = Math.min(lo, m.positions[i]);
    return lo;
  };
  it('gives the shaded surface a thin base', () => {
    const m = heightmapToMesh(hm, { widthMM: 40, baseMM: 0, reliefMM: 2, resolution: 32 });
    expect(closed(m)).toBe(true);
    expect(minTop(m)).toBeCloseTo(MIN_BASE_MM, 5);
  });
  it('gives the terraces a thin base', () => {
    const m = terraceMesh(hm, { widthMM: 40, baseMM: 0, reliefMM: 2, levels: 2 });
    expect(m.failedFaces).toBe(0);
    expect(closed(m)).toBe(true);
    expect(minTop(m)).toBeCloseTo(MIN_BASE_MM, 5);
  });
  it('keeps many levels apart', () => {
    // twenty plateaus: more than a packed vertex key had room for
    const ramp: Heightmap = {
        ...hm,
        h: Float32Array.from({ length: W * H }, (_, i) => Math.floor(((i % W) / W) * 20) / 19),
      },
      m = terraceMesh(ramp, { widthMM: 40, levels: 20 });
    expect(m.failedFaces).toBe(0);
    expect(closed(m)).toBe(true);
  });
});
