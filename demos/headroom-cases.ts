// Cases for demos/headroom.html: the tallest ascender setting with braid and pearl separators and leaf and palmette
// endings, on a circle, an octagon and a mihrab.
import { preset } from '../src/model/presets';
import type { Composition, Outline } from '../src/model/schema';

const OUTLINES: [string, Outline][] = [
  ['circle', { kind: 'circle' }],
  ['octagon', { kind: 'polygon', sides: 8 }],
  ['mihrab', { kind: 'preset', name: 'mihrab' }],
];
const STYLES = [
  ['braid', 'leaf'],
  ['pearls', 'palmette'],
] as const;

export const HEADROOM_CASES: { id: string; name: string; comp: Composition }[] = OUTLINES.flatMap(([o, outline]) =>
  STYLES.map(([sep, term]) => {
    const c = structuredClone(preset('octagon-panel'));
    c.style.letter.ascenders = 13;
    c.style.terminals = { kind: term, reach: 'tails' };
    c.root.child.outline = outline;
    // plain grounds and centre, so the pictures are about the bands
    c.root.child.borders = c.root.child.borders.map(b =>
      b.type === 'textBorder' ? { ...b, separator: { kind: sep, width: 3 }, ground: undefined } : b,
    );
    c.root.child.fill = { type: 'solid' };
    c.root.child.features = { tips: 'none', corners: 'none' };
    delete c.root.spandrels;
    return { id: `${o}-${sep}-${term}`, name: `${o}, ${sep}, ${term} endings`, comp: c };
  }),
);
