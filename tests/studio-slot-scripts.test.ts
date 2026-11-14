// Which script writes each text slot, so the editor's "not drawn" list is only shown where its shaper is the one used.
import { describe, expect, it } from 'vitest';
import { preset } from '../src/model/presets';
import { slotScripts } from '../src/studio/tree';

describe('the scripts a text slot is written in', () => {
  const scripts = (c: Parameters<typeof slotScripts>[0]) =>
    Object.fromEntries([...slotScripts(c)].map(([k, v]) => [k, [...v].sort()]));
  it('is the style’s script for borders and fills', () => {
    const c = preset('fatimid-medallion');
    for (const s of Object.values(scripts(c))) expect(s).toEqual(['kufi']);
    const t = structuredClone(c);
    t.style.script = 'thuluth';
    for (const s of Object.values(scripts(t))) expect(s).toEqual(['thuluth']);
  });
  it('is thuluth for a roundel, whatever writes the rings round it', () => {
    const c = preset('ahl-al-bayt'),
      fill = c.root.child.fill as { type: string; text: string },
      ring = c.root.child.borders.find(b => b.type === 'textBorder') as { text: string };
    expect(fill.type).toBe('roundel');
    expect(scripts(c)[fill.text]).toEqual(['thuluth']);
    expect(scripts(c)[ring.text]).toEqual(['kufi']);
  });
  it('follows a region’s own script, and lists both for a slot two scripts write', () => {
    const c = structuredClone(preset('fatimid-medallion')),
      slot = (c.root.child.borders.find(b => b.type === 'textBorder') as { text: string }).text;
    c.root.child.fill = {
      type: 'region',
      node: {
        type: 'region',
        outline: { kind: 'circle' },
        borders: [{ type: 'textBorder', text: slot }],
        style: { script: 'thuluth' },
      },
    };
    expect(scripts(c)[slot]).toEqual(['kufi', 'thuluth']);
  });
  it('leaves out a slot nothing writes', () => {
    const c = structuredClone(preset('fatimid-medallion'));
    c.texts.spare = { text: 'x', repeat: 'fill', wordGap: 2 };
    expect(slotScripts(c).has('spare')).toBe(false);
  });
});
