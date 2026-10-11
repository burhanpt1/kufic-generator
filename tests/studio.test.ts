import { describe, expect, it } from 'vitest';
import { PRESETS, TEXTS } from '../src/model/presets';
import { isValidComposition } from '../src/model/schema';
import {
  abjadTable,
  ahFromCE,
  breakdown,
  combos,
  complete,
  DEFAULT_CATEGORIES,
  find,
  valueOf,
  wordBank,
} from '../src/studio/chronogram';
import { compositionFromHash, decodeComposition, encodeComposition, hashFor } from '../src/studio/state';
import { addBorder, defaultFill, getAt, layers, moveBorder, removeAt, setAt, setFill } from '../src/studio/tree';

const MASH5 = abjadTable({ system: 'mashriqi', taMarbuta: 5 });

describe('chronogram', () => {
  it('counts the basmala as 786 and لا اله الا الله as 165', () => {
    expect(valueOf(TEXTS.basmala, MASH5)).toBe(786);
    expect(valueOf('لا اله الا الله', MASH5)).toBe(165);
  });
  it('makes ة and the Maghribi values explicit settings', () => {
    expect(valueOf('فاطمة', MASH5)).toBe(135);
    expect(valueOf('فاطمة', abjadTable({ system: 'mashriqi', taMarbuta: 400 }))).toBe(530);
    const magh = abjadTable({ system: 'maghribi', taMarbuta: 5 });
    expect(magh['ص']).toBe(60);
    expect(magh['ش']).toBe(1000);
    expect(valueOf('سلام', magh)).toBe(valueOf('سلام', MASH5) + 240);
  });
  it('breaks a phrase into letter values with word gaps', () => {
    const b = breakdown('يا علي', MASH5);
    expect(b.map(x => x?.v ?? null)).toEqual([10, 1, null, 70, 30, 10]);
  });
  it('finds combinations that sum exactly, fewest words first', () => {
    const bank = wordBank(DEFAULT_CATEGORIES, '', MASH5);
    const res = combos(bank, 200, 3);
    expect(res.length).toBeGreaterThan(0);
    for (const ws of res) {
      expect(ws.reduce((a, w) => a + w.v, 0)).toBe(200);
      expect(new Set(ws.map(w => w.w)).size).toBe(ws.length);
    }
    for (let i = 1; i < res.length; i++) expect(res[i].length).toBeGreaterThanOrEqual(res[i - 1].length);
  });
  it('completes a phrase to the target by adding or swapping words', () => {
    const bank = wordBank(DEFAULT_CATEGORIES, '', MASH5),
      target = ahFromCE(2026);
    expect(target).toBe(1448);
    const sug = complete('ولد علي', target, bank, MASH5);
    expect(sug.length).toBeGreaterThan(0);
    for (const s of sug) expect(valueOf(s.phrase, MASH5)).toBe(target);
    expect(sug.some(s => s.kind === 'add')).toBe(true);
  });
  it('finds phrases around a required word', () => {
    const bank = wordBank(DEFAULT_CATEGORIES, '', MASH5);
    const res = find(1448, bank, MASH5, 4, 'علي');
    expect(res.length).toBeGreaterThan(0);
    for (const s of res) {
      expect(s.phrase.split(' ')[0]).toBe('علي');
      expect(valueOf(s.phrase, MASH5)).toBe(1448);
    }
    expect(find(10, bank, MASH5, 3, 'الرحمن')).toEqual([]);
  });
});

describe('URL state', () => {
  it('round-trips every preset through the URL', async () => {
    for (const p of PRESETS) {
      const h = await hashFor(p.comp);
      expect(h.startsWith('#c=')).toBe(true);
      expect(h.length).toBeLessThan(2000);
      expect(await compositionFromHash(h)).toEqual(p.comp);
    }
  });
  it('rejects garbage and invalid trees', async () => {
    expect(await decodeComposition('not-base64!')).toBeNull();
    const bad = await encodeComposition({ ...PRESETS[0].comp, version: 2 } as never);
    expect(await decodeComposition(bad)).toBeNull();
    expect(await compositionFromHash('#s=abc')).toBeNull();
  });
});

describe('layers', () => {
  const c = PRESETS[0].comp;
  it('lists the frame, corners, region, borders and fill', () => {
    const ls = layers(c);
    expect(ls[0].kind).toBe('frame');
    const borders = ls.filter(l => l.kind === 'border');
    expect(borders.length).toBe(c.root.child.borders.length);
    for (const l of ls) expect(getAt(c, l.path)).toBeDefined();
  });
  it('reorders, removes and adds borders, always valid', () => {
    const n = c.root.child.borders.length;
    const moved = moveBorder(c, ['root', 'child', 'borders', 0], 1)!;
    expect(moved.root.child.borders[1]).toEqual(c.root.child.borders[0]);
    expect(moveBorder(c, ['root', 'child', 'borders', 0], -1)).toBeNull();
    const removed = removeAt(c, ['root', 'child', 'borders', 0])!;
    expect(removed.root.child.borders.length).toBe(n - 1);
    for (const t of ['textBorder', 'ornamentBorder'] as const) {
      const added = addBorder(c, ['root', 'child'], t)!;
      expect(added.root.child.borders.length).toBe(n + 1);
      expect(isValidComposition(added)).toBe(true);
    }
    expect(c.root.child.borders.length).toBe(n); // inputs untouched
  });
  it('sets and removes fills; refuses edits that break the schema', () => {
    for (const t of ['lines', 'maze', 'monogram', 'abjad', 'pattern', 'rings', 'vine', 'solid', 'region'] as const) {
      const r = setFill(c, ['root', 'child', 'fill'], defaultFill(t, c));
      expect(r, t).not.toBeNull();
      expect(layers(r!).some(l => l.kind === 'fill')).toBe(true);
    }
    expect(removeAt(c, ['root', 'child', 'fill'])!.root.child.fill).toBeUndefined();
    expect(removeAt(c, ['root', 'child'])).toBeNull();
    expect(setAt(c, ['root', 'child', 'outline'], { kind: 'polygon', sides: 'x' })).toBeNull();
    expect(setAt(c, ['root', 'child', 'borders', 0, 'text'], 'nope')).toBeNull();
  });
});
