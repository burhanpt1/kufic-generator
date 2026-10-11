// Visual critic (COMPOSITION_ENGINE.md §9 Phase 6.9): send a rendered thumbnail to the Claude API for a
// calligraphy-teacher critique and use its suggestions as mutation hints. Off by default: nothing is sent unless the
// user supplies their own API key and asks. Suggestions are validated against the evolvable traits, so a reply can
// only ever change what the user could change with the guided controls.
import { TRAITS, traitsOf } from '../evolve/genes';
import type { Trait } from '../evolve/genes';
import { applyTrait } from '../evolve/operators';
import { Rng } from '../evolve/rng';
import type { Composition } from '../model/schema';
import { isValidComposition } from '../model/schema';

export const CRITIC_MODELS = ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'] as const;
export const API_URL = 'https://api.anthropic.com/v1/messages';

export interface Suggestion {
  trait: Trait;
  value: string | number | boolean;
  reason: string;
}
export interface Critique {
  critique: string;
  suggestions: Suggestion[];
}

/** The traits and values the critic may suggest, as a compact list for the prompt. */
function traitMenu(c: Composition): string {
  const cur = traitsOf(c);
  return (Object.keys(TRAITS) as Trait[])
    .map(k => `${k} (${TRAITS[k].label}; now ${JSON.stringify(cur[k] ?? null)}): ${JSON.stringify(TRAITS[k].values)}`)
    .join('\n');
}

export function critiquePrompt(c: Composition): string {
  const texts = Object.values(c.texts)
    .map(t => t.text.replace(/\n/g, ' / '))
    .join(' | ');
  return `You are a teacher of Kufic calligraphy and Islamic geometric design, reviewing a student's generated composition (the image). The text is: ${texts}

Critique it the way a master would: legibility and rhythm of the letters (stem spacing, kashida balance), proportion between borders and the centre, density and balance, how ornament supports or crowds the text, and fidelity to square and Fatimid Kufic traditions. Be specific and brief (at most 120 words).

Then suggest up to 4 changes, each one trait set to one of its allowed values:
${traitMenu(c)}

Reply with JSON only, no other text:
{"critique": "...", "suggestions": [{"trait": "...", "value": ..., "reason": "..."}]}`;
}

/** The Messages API request body for one critique. */
export function critiqueRequest(c: Composition, pngBase64: string, model: string = CRITIC_MODELS[0]) {
  return {
    model,
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data: pngBase64 } },
          { type: 'text', text: critiquePrompt(c) },
        ],
      },
    ],
  };
}

/** The critique from a reply's text, keeping only suggestions that name a real trait and one of its values. */
export function parseCritique(text: string): Critique {
  const m = text.match(/\{[\s\S]*\}/);
  let raw: { critique?: unknown; suggestions?: unknown };
  if (!m) return { critique: text.trim().slice(0, 2000), suggestions: [] };
  try {
    raw = JSON.parse(m[0]);
  } catch {
    return { critique: text.trim(), suggestions: [] };
  }
  const suggestions: Suggestion[] = [];
  for (const s of Array.isArray(raw.suggestions) ? raw.suggestions : []) {
    const t = (s as { trait?: unknown })?.trait,
      v = (s as { value?: unknown })?.value;
    if (typeof t !== 'string' || !(t in TRAITS)) continue;
    const vals = TRAITS[t as Trait].values as readonly (string | number | boolean)[],
      hit = vals.find(x => x === v || String(x) === String(v));
    if (hit === undefined || suggestions.some(x => x.trait === t)) continue;
    const reason = (s as { reason?: unknown }).reason;
    suggestions.push({ trait: t as Trait, value: hit, reason: typeof reason === 'string' ? reason.slice(0, 300) : '' });
  }
  return {
    critique: typeof raw.critique === 'string' ? raw.critique.slice(0, 2000) : '',
    suggestions: suggestions.slice(0, 4),
  };
}

/** A composition with suggestions applied (all of them, or the given subset); the input is not changed. */
export function applySuggestions(c: Composition, s: Suggestion[]): Composition {
  const n = structuredClone(c),
    rng = new Rng(c.seed || 1);
  for (const x of s) applyTrait(n, x.trait, x.value, rng);
  return isValidComposition(n) ? n : structuredClone(c);
}

/** Ask the critic. Throws with the API's message on failure. `fetchImpl` is for tests. */
export async function askCritic(
  c: Composition,
  pngBase64: string,
  o: { apiKey: string; model?: string; fetchImpl?: typeof fetch; signal?: AbortSignal },
): Promise<Critique> {
  const res = await (o.fetchImpl ?? fetch)(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': o.apiKey,
      'anthropic-version': '2023-06-01',
      // the key is the user's own, used from their browser
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify(critiqueRequest(c, pngBase64, o.model)),
    signal: o.signal,
  });
  const body = (await res.json().catch(() => null)) as {
    content?: { type: string; text?: string }[];
    error?: { message?: string };
  } | null;
  if (!res.ok) throw new Error(body?.error?.message ?? `the API answered ${res.status}`);
  const text = (body?.content ?? [])
    .filter(b => b.type === 'text')
    .map(b => b.text ?? '')
    .join('');
  return parseCritique(text);
}
