// Thuluth behind ScriptEngine (src/script/thuluth/adapter.ts): VectorStrips of exactly the asked width, segments the
// shared solvers can partition, thuluth kashida, vowels in the band.
import { describe, expect, it } from 'vitest';
import { partition, repeatSegs } from '../src/layout/solvers';
import { DEFAULT_STYLE } from '../src/model/style';
import type { ThuluthSegment } from '../src/script/thuluth/adapter';
import { kashidaJoin, parsePolys, thuluthScript } from '../src/script/thuluth/adapter';
import { ROUNDEL_PEN, TILE_PEN } from '../src/script/thuluth/engine';
import type { LayoutOptions, Segments, VectorStrip } from '../src/script/types';
import type { Segs } from '../src/types';

const letter = DEFAULT_STYLE.letter,
  vowelled = { ...letter, marks: 'all' as const },
  opts: LayoutOptions = { wrap: false, rhythm: true, wordGap: 2, terminals: 'none' };
// neutral words and names
const LINES = ['محمد علي فاطمة', 'الحسن الحسين', 'مودة ورحمة', 'زينب وقصي', 'سبحان الله'];

const inkBox = (st: VectorStrip) => {
  const pts = st.paths.flatMap(p => parsePolys(p.d)).flat();
  return {
    x0: Math.min(...pts.map(p => p[0])),
    x1: Math.max(...pts.map(p => p[0])),
    y0: Math.min(...pts.map(p => p[1])),
    y1: Math.max(...pts.map(p => p[1])),
  };
};

describe('thuluth ScriptEngine', () => {
  const eng = thuluthScript(TILE_PEN);
  it('lays a line out at exactly the width asked, or not at all below its natural width', () => {
    for (const t of LINES) {
      const p = eng.prepare(eng.shape(t, letter), letter),
        segs = eng.segments(p, 'words', 2) as Segments<ThuluthSegment>,
        natural = segs.reduce((a, s, i) => a + s.minW + (i < segs.length - 1 ? 2 : 0), 0);
      for (const W of [natural, natural + 3, natural + 11, natural + 40]) {
        const st = eng.layout(segs, p, W, opts) as VectorStrip;
        expect(st.kind, t).toBe('vector');
        expect(st.W, t).toBe(W);
        const b = inkBox(st);
        expect(b.x0, t).toBeGreaterThanOrEqual(-0.01);
        expect(b.x1, t).toBeLessThanOrEqual(W + 0.01);
        expect(b.y0, t).toBeGreaterThanOrEqual(-0.01);
        expect(b.y1, t).toBeLessThanOrEqual(st.Hb + 0.01);
      }
      expect(eng.layout(segs, p, natural - 3, opts), t).toBeNull();
    }
  });
  it('fills the width: a wider line spreads its ink across it', () => {
    const p = eng.prepare(eng.shape('مودة ورحمة', letter), letter),
      segs = eng.segments(p, 'words', 2),
      st = eng.layout(segs, p, 60, opts) as VectorStrip,
      b = inkBox(st);
    expect(b.x1 - b.x0).toBeGreaterThan(58);
  });
  it('gives the shared solvers segments they can partition, by words or at the breaks', () => {
    const p = eng.prepare(eng.shape('بسم الله الرحمن الرحيم', letter), letter),
      words = eng.segments(p, 'words', 2),
      breaks = eng.segments(p, 'breaks', 2);
    expect(words).toHaveLength(4);
    expect(breaks.length).toBeGreaterThan(4);
    expect(breaks.filter(s => s.endsWord)).toHaveLength(4);
    for (const s of words as ThuluthSegment[]) expect(s.minW).toBeGreaterThanOrEqual(s.w);
    const rep = repeatSegs(words as unknown as Segs, 3),
      total = rep.reduce((a, s, i) => a + s.minW + (i < rep.length - 1 ? 2 : 0), 0),
      part = partition(rep, [Math.ceil(total / 3) + 4, Math.ceil(total / 3) + 4, Math.ceil(total / 3) + 4]);
    expect(part).not.toBeNull();
    // every group lays out at its capacity, and repeats keep their tags
    const tags = new Set<number>();
    for (const g of part!.groups) {
      const st = eng.layout(g as unknown as Segments, p, Math.ceil(total / 3) + 4, opts) as VectorStrip;
      expect(st.W).toBe(Math.ceil(total / 3) + 4);
      st.paths.forEach(q => tags.add(q.tag));
    }
    expect([...tags].sort()).toEqual([1, 2, 3]);
  });
  it('elongates one join per word, after a tooth letter where it can', () => {
    expect(kashidaJoin('بسم')).toBe(2); // after the seen, as the basmala is written (بســم)
    expect(kashidaJoin('بلد')).toBe(1); // after the ba
    expect(kashidaJoin('محمد')).not.toBeNull();
    expect(kashidaJoin('ورد')).toBeNull(); // nothing joins
    expect(kashidaJoin('الله')).toBeNull(); // the name of God keeps its form
    expect(kashidaJoin('لله')).toBeNull();
    const p = eng.prepare(eng.shape('بسم', letter), letter),
      segs = eng.segments(p, 'words', 2) as Segments<ThuluthSegment>,
      tight = inkBox(eng.layout(segs, p, segs[0].minW, opts) as VectorStrip),
      wide = inkBox(eng.layout(segs, p, segs[0].minW + 12, opts) as VectorStrip);
    // a single word cannot spread into gaps: its kashida takes the room
    expect(wide.x1 - wide.x0).toBeGreaterThan(tight.x1 - tight.x0 + 5);
  });
  it('writes vowels when the letter style shows all marks, inside the band', () => {
    const v = eng.prepare(eng.shape('زَيْنَب وَقُصَيّ', vowelled), vowelled),
      plain = eng.prepare(eng.shape('زَيْنَب وَقُصَيّ', letter), letter);
    expect(v.Hb).toBeGreaterThan(plain.Hb);
    const st = eng.layout(eng.segments(v, 'words', 2), v, null, opts) as VectorStrip;
    expect(st.paths.some(p => p.role === 'vowel')).toBe(true);
    const b = inkBox(st);
    expect(b.y1).toBeLessThanOrEqual(st.Hb + 0.01);
    const st2 = eng.layout(eng.segments(plain, 'words', 2), plain, null, opts) as VectorStrip;
    expect(st2.paths.every(p => p.role === 'letter')).toBe(true);
  });
  it('shares one band height across the lines of a text', () => {
    const ps = eng.prepareLines(['الحسن', 'محمد علي'], letter);
    expect(ps[0].Hb).toBe(ps[1].Hb);
    expect(ps[0].base).toBeGreaterThan(2); // the bowls go below the baseline
  });
  it('is deterministic, reports no grid abilities, and counts abjad as Kufi does', () => {
    const a = thuluthScript(ROUNDEL_PEN),
      b = thuluthScript(ROUNDEL_PEN),
      run = (e: typeof a) => {
        const p = e.prepare(e.shape('مودة ورحمة', letter), letter);
        return JSON.stringify(e.layout(e.segments(p, 'words', 2), p, 50, opts));
      };
    expect(run(a)).toBe(run(b));
    expect(a.capabilities).toEqual({ grid: false, seals: false, mazes: false });
    expect(a.abjad('بسم الله الرحمن الرحيم')).toBe(786);
    expect(a.id).toBe('thuluth');
  });
});
