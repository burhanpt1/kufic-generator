// The basmala being tuned by hand (demos/tune.html): its text and the one recipe every start and every saved layout
// shares, so a layout's variant numbers always mean the same shapes.
import type { RoundelOptions } from '../script/thuluth/roundel';

export const TUNE_TEXT = 'بسم الله الرحمن الرحيم';
/** The same text with its vowels (the pieces are the same; the marks are drawn from it). */
export const TUNE_VOWELLED = 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ';
// stackPull keeps the stacked variants on offer (they are off by default now), so recorded variant numbers hold
export const TUNE_RECIPE: RoundelOptions = { elongate: true, cross: true, kern: true, oval: 1, fillTarget: 0.45, stack: true, stackPull: 1.6 }; // prettier-ignore
