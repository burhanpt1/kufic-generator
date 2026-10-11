// Phase 6.9: the optional visual critic (requests and replies are mocked; nothing is sent).
import { describe, expect, it, vi } from 'vitest';
import { API_URL, applySuggestions, askCritic, critiqueRequest, parseCritique } from '../src/critic/visual';
import { traitsOf } from '../src/evolve/genes';
import { preset } from '../src/model/presets';
import { isValidComposition } from '../src/model/schema';

const comp = preset('octagon-panel');

describe('request', () => {
  it('sends the image and a prompt that lists the allowed traits', () => {
    const r = critiqueRequest(comp, 'AAAA');
    const [img, txt] = r.messages[0].content as [
      { type: string; source: { data: string; media_type: string } },
      { type: string; text: string },
    ];
    expect(img.type).toBe('image');
    expect(img.source).toMatchObject({ media_type: 'image/png', data: 'AAAA' });
    expect(txt.text).toContain('outline (Shape');
    expect(txt.text).toContain('JSON only');
    expect(txt.text).toContain(comp.texts[Object.keys(comp.texts)[0]].text.split('\n')[0]);
  });
});

describe('parsing', () => {
  it('reads JSON wrapped in prose or code fences', () => {
    const c = parseCritique(
      'Here you go:\n```json\n{"critique":"Stems crowd the corners.","suggestions":[{"trait":"separatorWidth","value":3,"reason":"more air"}]}\n```',
    );
    expect(c.critique).toBe('Stems crowd the corners.');
    expect(c.suggestions).toEqual([{ trait: 'separatorWidth', value: 3, reason: 'more air' }]);
  });
  it('drops unknown traits, values outside the menu and duplicates; matches values loosely', () => {
    const c = parseCritique(
      JSON.stringify({
        critique: 'x',
        suggestions: [
          { trait: 'fontSize', value: 12 },
          { trait: 'outline', value: 'hexagram' },
          { trait: 'banded', value: 'true', reason: 'r' },
          { trait: 'banded', value: false },
          { trait: 'sides', value: '8' },
        ],
      }),
    );
    expect(c.suggestions.map(s => [s.trait, s.value])).toEqual([
      ['banded', true],
      ['sides', 8],
    ]);
  });
  it('keeps a non-JSON reply as the critique', () => {
    expect(parseCritique('Lovely work.')).toEqual({ critique: 'Lovely work.', suggestions: [] });
  });
});

describe('hints', () => {
  it('applies suggestions as trait changes and stays valid', () => {
    const n = applySuggestions(comp, [
      { trait: 'banded', value: true, reason: '' },
      { trait: 'palette', value: 4, reason: '' },
    ]);
    expect(isValidComposition(n)).toBe(true);
    expect(traitsOf(n).banded).toBe(true);
    expect(traitsOf(n).palette).toBe(4);
    expect(comp).toEqual(preset('octagon-panel')); // input untouched
  });
});

describe('askCritic', () => {
  it('posts to the Messages API with the user key and parses the reply', async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({
        content: [{ type: 'text', text: '{"critique":"ok","suggestions":[{"trait":"weight","value":0.8}]}' }],
      }),
    );
    const c = await askCritic(comp, 'AAAA', { apiKey: 'sk-test', model: 'claude-haiku-5-5', fetchImpl });
    expect(c.suggestions[0]).toMatchObject({ trait: 'weight', value: 0.8 });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(API_URL);
    const headers = init.headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('sk-test');
    expect(headers['anthropic-version']).toBe('2023-06-01');
    expect(JSON.parse(init.body as string).model).toBe('claude-haiku-5-5');
  });
  it('surfaces API errors', async () => {
    const fetchImpl = vi.fn(async () => Response.json({ error: { message: 'invalid x-api-key' } }, { status: 401 }));
    await expect(askCritic(comp, 'AAAA', { apiKey: 'bad', fetchImpl })).rejects.toThrow('invalid x-api-key');
  });
});
