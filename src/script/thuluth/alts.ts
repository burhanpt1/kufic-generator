// Drafted alternative letterforms (ThuluthStyle.alts), for the owner to judge beside the current ones. Nothing here is
// drawn unless a style asks for it: the letter table and the ligatures are as before when `alts` is unset.
import { ALLAH_HEH, ALLAH_LAM, ALLAH_LAM_INI } from './fixes';
import type { Family, Form, GlyphDef, SkelPt, StrokeDef, ThuluthAlts } from './types';

type LetterForm = GlyphDef & { src?: string };

/** The set recommended to the owner (see the comparison sheets, tests/letters.test.ts): the tarwis stems, the letters
 *  of محمد redrawn with the name as its ligature, and the audit's corrections. */
export const RECOMMENDED: ThuluthAlts = { stems: 'a', muhammad: 'c', fixes: true };

type Forms = Partial<Record<Family, Partial<Record<Form, LetterForm>>>>;
type Head = NonNullable<ThuluthAlts['stems']>;

// ---- Part 1: the tall stems ----
// What was wrong (seen at the roundel pen): the hand-drawn stems lead in along a line at 37°, the very angle of
// their nib (38°), so the lead-in draws nothing but a whisker, and the widths 0.2 → 0.8 → 1 of the first three points
// step the left edge: a notched top. The learned alif is a hook, up to the left and back down, written with the
// line's steep nib (69°), so its upstroke is as heavy as the shaft beside it: two bumps and a notch; and at 69° its
// shaft is half the weight of the lam's. Where a stem at 38° hands over to the baseline at the line's angle, the next
// stroke's first nib position hangs below the thinner foot: the spur at the foot.
//
// Each alternative draws every tall stem with one nib (38°), one height and one head:
//   a  the tarwis: a short pointed serif on the right of the top, written from its tip up-left into the stem
//   b  a plain top, cut by the nib's slant, no serif
//   c  a fuller head, as jali work has it: a heavier, rounder serif and a top that swells before the shaft narrows
// and a foot where the stem tapers into a bend drawn at the line's angle (two strokes overlapping, as a pen that
// turns), so the baseline leaves at its full weight with no spur. With any alternative on, the pen also leaves its
// minimum-thickness pass off the ends of strokes and sharp turns (pen.ts nibPolys `cleanEnds`): that pass's square
// end stood proud of the nib's slanted cut, the flat tab on every stem top.
const STEM_ANG = 38;

/** Half the roundel nib along its edge at STEM_ANG: the serifs are drawn for that pen (a lighter pen rounds them). */
const HX = 0.8 * Math.cos((STEM_ANG * Math.PI) / 180),
  HY = 0.8 * Math.sin((STEM_ANG * Math.PI) / 180);
/** A serif written from its tip (dx, dy from the top's right corner) into the stem's top: the nib's upper end runs
 *  straight from the tip to that corner while it opens from nothing to `w` (as t^p: 1 a wedge, more a hollow beak). */
function serif(x: number, top: number, tip: [number, number], w: number, p: number): SkelPt[] {
  // the top's right corner: the upper end of the nib where it stands at the head of the shaft
  const cx = x + HX * w,
    cy = top;
  return [0, 0.18, 0.36, 0.54, 0.72, 0.88, 1].map(t => {
    const k = Math.max(0.02, w * t ** p);
    return [cx + tip[0] * (1 - t) - HX * k, cy + tip[1] * (1 - t) - HY * k, k, t === 1 ? 1 : undefined] as SkelPt;
  });
}
/** The head of a stem standing at x with its top at `top` (the ink's top, not the skeleton's), down to where the
 *  shaft begins. */
function head(alt: Head, x: number, top: number): SkelPt[] {
  if (alt === 'a') return [...serif(x, top, [0.58, -1.05], 1, 2), [x, top - 2, 1]];
  if (alt === 'b') return [[x, top - HY, 1], [x, top - 2, 1]]; // prettier-ignore
  return [...serif(x, top, [0.8, -1.55], 1.16, 1.15), [x, top - 2.1, 1.08], [x, top - 3.8, 1]];
}
const stemStroke = (pts: SkelPt[], lean = true): StrokeDef => ({ ang: STEM_ANG, lean, pts });

/** A stem that joins onwards: the shaft tapering into the bend, and the bend at the line's own angle out to `exit`. */
function joiningStem(alt: Head, x: number, top: number, exit: number): StrokeDef[] {
  return [
    stemStroke([...head(alt, x, top), [x, 5.2, 1], [x - 0.02, 1.9, 1], [x - 0.08, 1.0, 0.92], [x - 0.3, 0.42, 0.55], [x - 0.6, 0.18, 0.15]]), // prettier-ignore
    { lean: true, pts: [[x - 0.02, 2.4, 0.5], [x - 0.05, 1.3, 0.85], [x - 0.3, 0.42, 1], [x - 0.95, 0.03, 1], [exit, 0, 1]] }, // prettier-ignore
  ];
}

/** The rebuilt kaf (fixes.ts KAF_END: join, shoulder, upright and base, sign) with its upright written as a stem. */
function kafEnd(f: LetterForm, joined: boolean): LetterForm {
  if (f.s.length !== 4) return f;
  const base = f.s[2].pts.slice(3);
  return {
    ...f,
    s: [
      // the isolated kaf has nothing to join: no stub at its foot
      ...(joined ? [f.s[0]] : []),
      f.s[1],
      stemStroke([[-0.5, 6.7, 1], [-0.47, 3.6, 1], [-0.44, 1.5, 1], [-0.5, 0.85, 0.85], [-0.72, 0.4, 0.5], [-1.0, 0.18, 0.15]], false), // prettier-ignore
      { pts: [[-0.44, 2.3, 0.5], [-0.46, 1.3, 0.85], [-0.7, 0.4, 1], ...base] },
      f.s[3],
    ],
  };
}

const reHead = (alt: Head, st: StrokeDef, keepFrom: number, x: number, top: number): StrokeDef => ({
  ...st,
  pts: [...head(alt, x, top), ...st.pts.slice(keepFrom)],
});

function stemForms(alt: Head, base: Forms): Forms {
  const lamBowl = (dx: number): SkelPt[] => [[dx, 5.2, 1], [-0.05 + dx, 1.4, 0.95], [-0.25 + dx, -0.4], [-0.9 + dx, -1.55], [-2.2 + dx, -2.05], [-3.3 + dx, -1.5], [-3.65 + dx, -0.4], [-3.45 + dx, 0.55, 0.4], [-3.15 + dx, 1.1, 0.12]]; // prettier-ignore
  const ta = base.ta!,
    la = base.lamalif!;
  const taStem = (f: LetterForm, x: number): LetterForm => ({
    ...f,
    s: f.s.map(s => (s.ang === 38 ? stemStroke([...head(alt, x, 8.9), [x, 4, 1], [x, 1.6, 0.9]], false) : s)),
  });
  return {
    alif: {
      // the alif at the lam's height, its foot thinning to a point that turns a little to the left
      iso: { src: 'hand', exit: null, s: [stemStroke([...head(alt, 0, 10), [0, 5.2, 1], [-0.03, 2.6, 0.9], [-0.12, 1.0, 0.6], [-0.28, 0.1, 0.2]])] }, // prettier-ignore
      // joined from the right: up from the line with no serif, as a joined alif is written
      fin: { src: 'hand', exit: null, s: [{ lean: true, pts: [[0, 0], [-0.5, 0.02], [-0.84, 0.36, 0.95], [-0.9, 1.3, 0.75], [-0.9, 2.4, 0.5]] }, stemStroke([[-0.88, 9.5, 0.8], [-0.9, 8.6, 0.95], [-0.9, 5.2, 1], [-0.9, 1.9, 1], [-0.86, 1.0, 0.9], [-0.66, 0.42, 0.5], [-0.4, 0.2, 0.15]])] }, // prettier-ignore
    },
    lam: {
      ini: { src: 'hand', exit: -1.9, s: joiningStem(alt, 0, 10, -1.9) },
      med: {
        src: 'hand',
        exit: -2.7,
        s: [
          {
            pts: [
              [0, 0],
              [-2.7, 0],
            ],
          },
          ...joiningStem(alt, -1.0, 10, -2.2),
        ],
      },
      fin: { src: 'hand', exit: null, s: [{ pts: [[0, 0], [-0.8, 0]] }, stemStroke([...head(alt, -0.9, 10), ...lamBowl(-0.9)])] }, // prettier-ignore
      iso: { src: 'hand', exit: null, s: [stemStroke([...head(alt, 0, 10), ...lamBowl(0)])] },
    },
    ta: { ini: taStem(ta.ini!, -1.5), iso: taStem(ta.iso!, -1.5), med: taStem(ta.med!, -1.9), fin: taStem(ta.fin!, -1.9) }, // prettier-ignore
    // final and isolated kaf: its upright at the stems' weight (it was a hairline beside a heavy base), turning
    // into the base as the lams do
    kaf: { fin: kafEnd(base.kaf!.fin!, true), iso: kafEnd(base.kaf!.iso!, false) },
    lamalif: {
      iso: { ...la.iso!, s: [reHead(alt, la.iso!.s[0], 3, 0.6, 9.7), la.iso!.s[1]] },
      fin: { ...la.fin!, s: [la.fin!.s[0], reHead(alt, la.fin!.s[1], 3, -0.4, 9.7), la.fin!.s[2]] },
    },
  };
}

/** The lams and heh of the name of God, with the alternative's head on the lams. */
export function allahForms(alts: ThuluthAlts | undefined): { ini: LetterForm; lam: LetterForm; heh: LetterForm } {
  const alt = alts?.stems;
  if (!alt) return { ini: ALLAH_LAM_INI, lam: ALLAH_LAM, heh: ALLAH_HEH };
  const re = (f: LetterForm): LetterForm => ({ ...f, s: [reHead(alt, f.s[0], 3, 0, 7.85)] });
  return { ini: re(ALLAH_LAM_INI), lam: re(ALLAH_LAM), heh: ALLAH_HEH };
}

/** The letter forms a style's alternatives replace, given the table they are laid over. */
export function altForms(alts: ThuluthAlts, base: Forms): Forms {
  const out: Forms = {};
  const add = (f: Forms) => {
    for (const [fam, fs] of Object.entries(f) as [Family, Partial<Record<Form, LetterForm>>][])
      out[fam] = { ...out[fam], ...fs };
  };

  if (alts.stems) add(stemForms(alts.stems, base));
  return out;
}
