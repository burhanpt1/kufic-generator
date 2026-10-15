// A short text in a tall line fill keeps whole words on the middle lines instead of breaking words to fill every
// line (held-out composition review: العلم نور in the mihrab came out as ا / لعلم / نور).
import { describe, expect, it } from 'vitest';
import { resolve } from '../src/compose';
import { preset } from '../src/model/presets';
import type { PlacedItem } from '../src/compose/placed';

const mihrab = (fillText: string) => {
  const c = structuredClone(preset('mihrab-ayat-al-kursi'));
  const fill = (c.root.child as { fill: { text: string } }).fill;
  c.texts[fill.text].text = fillText;
  return resolve(c);
};

describe('line fill with a short text', () => {
  it.each([
    ['العلم نور', 2],
    ['خدا حافظ', 2],
  ])('keeps whole words: %s on %i lines', (text, words) => {
    const p = mihrab(text);
    expect(p.meta.fill?.ok).toBe(true);
    expect(p.meta.fill?.note).toBe(`${words} lines`);
    // the fill's strips are its last ring: one per word
    const strips = p.items.filter((i): i is Extract<PlacedItem, { type: 'strip' }> => i.type === 'strip'),
      ring = Math.max(...strips.map(s => s.ring));
    expect(strips.filter(s => s.ring === ring)).toHaveLength(words);
  });
});
