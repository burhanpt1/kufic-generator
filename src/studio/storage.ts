// Per-browser persistence: learned taste and favourite compositions. Storage can be missing or throw (private
// windows, blocked site data); everything falls back to defaults.
import type { Taste } from '../evolve/taste';
import { newTaste } from '../evolve/taste';
import type { Composition } from '../model/schema';
import { isValidComposition } from '../model/schema';

const TASTE = 'kufi-taste',
  FAVS = 'kufi-favourites',
  CATS = 'kufi-chrono-cats';

function get<T>(key: string, fallback: T): T {
  try {
    const s = localStorage.getItem(key);
    return s ? (JSON.parse(s) as T) : fallback;
  } catch {
    return fallback;
  }
}
function set(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* storage unavailable */
  }
}

export function loadTaste(): Taste {
  const t = get<Partial<Taste> | null>(TASTE, null),
    d = newTaste();
  if (!t || typeof t !== 'object') return d;
  return { w: { ...d.w, ...(t.w ?? {}) }, pref: t.pref ?? {}, picks: t.picks ?? 0 };
}
export const saveTaste = (t: Taste) => set(TASTE, t);
export const resetTaste = () => set(TASTE, newTaste());

export interface Favourite {
  name: string;
  comp: Composition;
  at: number;
}
export const loadFavourites = (): Favourite[] =>
  get<Favourite[]>(FAVS, []).filter(f => f && typeof f.name === 'string' && isValidComposition(f.comp));
export const saveFavourites = (fs: Favourite[]) => set(FAVS, fs);

export const loadCategories = (fallback: string[]) => get<string[]>(CATS, fallback);
export const saveCategories = (cs: string[]) => set(CATS, cs);
