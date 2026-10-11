// Built-in silhouettes for outlines (COMPOSITION_ENGINE.md §9 Phase 6.1): SVG path data in their own coordinates,
// y down. Any outline kind 'svg' works the same way; these are starting points next to uploaded shapes.
export const SILHOUETTES = {
  mosque:
    'M0 200 L0 120 L10 120 L10 40 L14 30 L18 40 L18 120 L40 120 L40 100 Q40 50 100 40 Q160 50 160 100 L160 120 L182 120 L182 40 L186 30 L190 40 L190 120 L200 120 L200 200 Z',
  dome: 'M10 160 L10 110 C10 60 50 30 100 10 C150 30 190 60 190 110 L190 160 Z',
  lamp: 'M50 0 L60 20 L58 30 Q95 45 90 90 Q85 120 60 130 L65 145 L35 145 L40 130 Q15 120 10 90 Q5 45 42 30 L40 20 Z',
  onion: 'M100 0 C110 30 170 50 170 110 C170 150 140 170 100 170 C60 170 30 150 30 110 C30 50 90 30 100 0 Z',
} as const;
export type SilhouetteName = keyof typeof SILHOUETTES;
export const SILHOUETTE_NAMES: Record<SilhouetteName, string> = {
  mosque: 'Mosque',
  dome: 'Dome',
  lamp: 'Mosque lamp',
  onion: 'Onion dome',
};
