// Per-browser persistence: learned taste and favourite compositions. Storage can be missing or throw (private
// windows, blocked site data); everything falls back to defaults.
import type { Taste } from '../evolve/taste';
import { newTaste } from '../evolve/taste';
import { capRatings } from '../evolve/trainer';
import type { Rating } from '../evolve/trainer';
import type { Composition } from '../model/schema';
import { readComposition } from '../model/schema';

const TASTE = 'kufi-taste',
  FAVS = 'kufi-favourites',
  CATS = 'kufi-chrono-cats',
  RATINGS = 'kufi-ratings';

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
/** A stored list, or [] when what is stored is not a list. */
const list = (key: string): unknown[] => {
  const v = get<unknown>(key, []);
  return Array.isArray(v) ? v : [];
};
const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object';
/** A stored favourite as the current model reads it (older ones are migrated), or null if it can't be read. */
function readFavourite(f: unknown): Favourite | null {
  if (!isRecord(f) || typeof f.name !== 'string') return null;
  const comp = readComposition(f.comp);
  return comp ? { name: f.name, comp, at: typeof f.at === 'number' ? f.at : 0 } : null;
}
/** Stored favourites this version cannot read (saved by another version of the model, or damaged). They stay in
 *  storage, so a version that can read them finds them again; only what was never a favourite is let go. */
const unreadable = (): unknown[] => list(FAVS).filter(f => isRecord(f) && 'comp' in f && !readFavourite(f));

export const loadFavourites = (): Favourite[] =>
  list(FAVS)
    .map(readFavourite)
    .filter((f): f is Favourite => !!f);
/** Names of the stored favourites left out of loadFavourites because they could not be read. */
export const skippedFavourites = (): string[] =>
  unreadable().map(f => (isRecord(f) && typeof f.name === 'string' ? f.name : '(unnamed)'));
/** Save the favourites; those in storage that could not be read are kept after them, untouched. */
export const saveFavourites = (fs: Favourite[]) => set(FAVS, [...fs, ...unreadable()]);

export const loadCategories = (fallback: string[]): string[] => {
  const v = get<unknown>(CATS, fallback);
  return Array.isArray(v) ? v.filter((c): c is string => typeof c === 'string') : fallback;
};
export const saveCategories = (cs: string[]) => set(CATS, cs);

/** Trainer ratings (the newest 600). Records that no longer validate are dropped. */
export const loadRatings = (): Rating[] =>
  (list(RATINGS) as Rating[]).flatMap(r => {
    if (!r || !(r.r === 0 || r.r === 0.5 || r.r === 1) || typeof r.m !== 'object') return [];
    const comp = readComposition(r.comp);
    return comp ? [{ ...r, comp }] : [];
  });
export const saveRatings = (rs: Rating[]) => set(RATINGS, capRatings(rs));
