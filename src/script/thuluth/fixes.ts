// Letters redrawn after the lab, where its forms fail a legibility rule (tests/thuluth-legibility.test.ts). They sit
// over the generated table (letters.data.ts), which stays as the lab left it.
import { LETTERS } from './letters.data';
import type { Family, Form, LetterForm, SkelPt } from './types';

/** Final and isolated kaf, in the thuluth construction: an upright from the shoulder stroke at the top down to a long
 *  flat base that turns up at its end, with the small kaf sign inside. The lab's form was a leaning shaft over a
 *  short foot: no shoulder, no sign, so بارك read as بارد (HANDOVER §11). */
const KAF_END: LetterForm = {
  src: 'hand',
  exit: null,
  s: [
    { pts: [[0, 0], [-0.4, 0]] },
    // the shoulder: a short oblique stroke written down into the top of the upright
    { pts: [[-2.7, 7.5, 0.25], [-1.5, 7.0, 0.9], [-0.5, 6.55, 1]] },
    // the upright, a sharp turn at the baseline, the long base, and the lift at its end
    { pts: [[-0.5, 6.55, 0.9], [-0.4, 3.6], [-0.3, 0.75, 1, 1], [-1.2, 0.0], [-3.8, -0.05], [-5.3, 0.1], [-6.0, 0.6, 0.7], [-6.2, 1.35, 0.2]] },
    // the small kaf sign in the opening above the base
    { pts: [[-2.4, 3.55, 0.25], [-3.05, 3.2, 0.5], [-2.6, 2.75, 0.5, 1], [-3.35, 2.3, 0.4]] },
  ],
}; // prettier-ignore

/** The lab's hand-drawn lam stem (engine3.js LAM_STEM): the alif's height and lean, nib turned to 38°, curving into
 *  the join at the foot. The learned initial lam rose only a quarter of that (it read as a tooth) and the learned
 *  medial one rose and retraced its way down (lab session of 17 October). */
const LAM_STEM = (dx: number, exitX: number) =>
  ({
    ang: 38,
    lean: true,
    pts: [[0.65 + dx, 10.0, 0.2], [0.25 + dx, 9.7, 0.8], [0.0 + dx, 9.05, 1], [0.0 + dx, 5.5, 1], [-0.05 + dx, 1.6, 0.95], [-0.2 + dx, 0.45, 0.9], [-0.75 + dx, 0.05, 1], [exitX, 0.0, 1]], // prettier-ignore
  }) as LetterForm['s'][number];
const LAM_INI: LetterForm = { src: 'hand', exit: -1.8, s: [LAM_STEM(0, -1.8)] };
const LAM_MED: LetterForm = {
  src: 'hand',
  exit: -2.6,
  s: [
    {
      pts: [
        [0, 0],
        [-1.0, 0],
      ],
    },
    LAM_STEM(-1.0, -2.6),
  ],
};

/** The name of God as one ligature (style.allah), after the classic form (owner, 30 October): the two lams shorter
 *  than the alif, each rounding at its foot into a bowl, the first up into the second and the second up into the heh;
 *  the heh a tall arch as high as the lams; the shadda sitting on the second lam, its top level with the alif's. */
const ALLAH_TOP = 7.5;
export const ALLAH_LAM_INI: LetterForm = {
  src: 'hand',
  exit: -3.9,
  // down the stem, round the bowl and up into the second lam's stem (which stands at the exit)
  s: [{ ang: 38, lean: true, pts: [[0.6, ALLAH_TOP, 0.2], [0.22, ALLAH_TOP - 0.3, 0.8], [0.0, ALLAH_TOP - 0.9, 1], [0.0, 4.6, 1], [-0.05, 2.6, 0.95], [-0.3, 1.0], [-1.0, 0.1], [-1.95, -0.05], [-2.9, 0.1], [-3.55, 0.7], [-3.85, 1.8], [-3.9, 2.6, 0.8]] }],
}; // prettier-ignore
export const ALLAH_LAM: LetterForm = {
  src: 'hand',
  exit: -2.9,
  s: [{ ang: 38, lean: true, pts: [[0.6, ALLAH_TOP, 0.2], [0.22, ALLAH_TOP - 0.3, 0.8], [0.0, ALLAH_TOP - 0.9, 1], [0.0, 4.6, 1], [-0.05, 2.6, 0.95], [-0.3, 1.0], [-1.0, 0.1], [-1.95, -0.05], [-2.9, 0.0]] }],
}; // prettier-ignore
/** Its heh, scaled with the body like any heh: up from the second lam's bowl, over the arch and down to a small foot;
 *  its top as high as the lams at the roundel body (1.45). */
const H = ALLAH_TOP / 1.45 / 4.25;
export const ALLAH_HEH: LetterForm = {
  src: 'hand',
  exit: null,
  s: [{ ang: 38, pts: ([[0, 0], [-0.5, 0.35], [-0.85, 1.1], [-1.05, 2.3], [-1.25, 3.4], [-1.65, 4.1], [-2.25, 4.25], [-2.85, 3.8], [-3.15, 2.8], [-3.25, 1.5], [-3.35, 0.45], [-3.65, 0.0, 0.6], [-4.0, 0.1, 0.25]] as SkelPt[]).map(([x, y, w]) => [x, y * H, w] as SkelPt) }],
}; // prettier-ignore

/** Isolated ba, ta, tha: the lab's hand-drawn long flat boat on the baseline. The learned form, a final misfiled in
 *  the dataset, dropped below the line like a ra. */
const TOOTH_ISO: LetterForm = {
  src: 'hand',
  exit: null,
  dotX: -2.2,
  s: [{ pts: [[0.3, 1.0, 0.3], [0.1, 0.35, 0.8], [-0.4, -0.15], [-1.6, -0.3], [-3.3, -0.2], [-4.2, 0.1], [-4.6, 0.65, 0.45], [-4.7, 1.3, 0.12]] }], // prettier-ignore
};

/** Medial kaf: the (learned) initial kaf, its hook, long shoulder slanting down to the left and diagonal back to the
 *  base, after a joining stroke, everything 0.6 to the left. The hand-drawn one was a near-upright over a short base,
 *  so لكما read as للما. */
const KAF_MED: LetterForm = {
  src: 'hand',
  exit: -5.36,
  s: [
    {
      pts: [
        [0, 0, 1],
        [-0.6, 0, 1],
      ],
    },
    { pts: [[-1.51, 4.99, 0.55], [-0.6, 6.91, 1], [-0.66, 7.18, 1], [-1.19, 7.33, 1], [-3.09, 6.37, 1], [-5.68, 4.5, 1], [-5.81, 4.25, 1], [-5.67, 3.78, 1], [-3.7, 1.94, 1], [-3.3, 1.02, 1], [-3.43, 0.46, 1], [-3.84, 0.02, 1], [-4.82, -0.18, 1], [-5.36, 0.0, 1]] }, // prettier-ignore
  ],
};

/** Initial heh, the split heh of the thuluth masters (traced from tasmeemme.com's construction): from the head, down
 *  the left wall and back up the inner diagonal, closing the upper eye; then from the head a small flag, round the
 *  outer crescent and back along the line into the join, leaving a slanted sliver of a lower eye. Written with the
 *  nib at 40°, so the walls and the crescent are heavy and the diagonal light; the pen turns back to the line's angle
 *  where the next letter begins. The long join keeps the eyes clear of a following stem. */
const HEH_INI: LetterForm = {
  src: 'hand',
  exit: -3.62,
  s: [
    { ang: 40, pts: [[-1.94, 2.32, 0.46], [-2.09, 1.91, 0.59], [-2.33, 1.41, 0.66], [-2.41, 0.96, 0.66], [-2.33, 0.53, 0.66], [-1.89, 0.36, 0.66], [-1.33, 0.48, 0.59], [-1.03, 0.91, 0.53], [-1.02, 1.4, 0.53], [-1.26, 1.77, 0.53], [-1.57, 2.05, 0.46]] }, // prettier-ignore
    { ang: 40, pts: [[-1.96, 2.44, 0.33], [-1.18, 2.04, 0.4, 1], [-0.64, 1.73, 0.59], [-0.26, 1.29, 0.66], [-0.07, 0.73, 0.66], [-0.15, 0.22, 0.66], [-0.46, -0.02, 0.66], [-1.12, -0.01, 0.66], [-1.98, 0, 0.66], [-2.8, 0, 0.66], [-3.62, 0, 0.66]] }, // prettier-ignore
  ],
};

/** Final and isolated seen, which neither the lab nor its data had (the initial teeth stood in, with no tail, so
 *  الناس read as الناسـ): the seen's teeth, then the final nun's bowl from where they leave the baseline, as the
 *  letter is built. The dots of shin stay over the teeth. Reviewed and kept by the owner (30 October 2026); replace it
 *  if a master example turns up. */
const sinEnd = (teeth: LetterForm): LetterForm => {
  const bowl = LETTERS.nun.fin!,
    dx = teeth.exit!;
  return {
    src: 'hand',
    exit: null,
    dotX: teeth.dotX,
    s: [...teeth.s, ...bowl.s.map(st => ({ ...st, pts: st.pts.map(([x, y, w, c]) => [x + dx, y, w, c] as SkelPt) }))],
  };
};
const SIN_FIN = sinEnd(LETTERS.sin.med!),
  SIN_ISO = sinEnd(LETTERS.sin.ini!);

/** A form drawn smaller about its entry (0, 0), the pen's widths kept. */
const scaled = (g: LetterForm, sx: number, sy: number): LetterForm => ({
  src: g.src,
  exit: g.exit == null ? null : g.exit * sx,
  dotX: g.dotX == null ? g.dotX : g.dotX * sx,
  s: g.s.map(st => ({ ...st, pts: st.pts.map(([x, y, w, c]) => [x * sx, y * sy, w, c] as SkelPt) })),
});

/** Initial and medial hah, jim, khah: the master's head (gold panel), drawn smaller. At its own size the head stood
 *  three teeth tall and as wide as a word, and every word with a hah turned on it; the masters' line hah has a head
 *  about two and a half dots tall, about as high as ain's and sad's. */
const HAH_SX = 0.8,
  HAH_SY = 0.72;
const HAH_INI = scaled(LETTERS.hah.ini!, HAH_SX, HAH_SY),
  HAH_MED = scaled(LETTERS.hah.med!, HAH_SX, HAH_SY);

export const LETTER_FIXES: Partial<Record<Family, Partial<Record<Form, LetterForm>>>> = {
  kaf: { med: KAF_MED, fin: KAF_END, iso: KAF_END },
  lam: { ini: LAM_INI, med: LAM_MED },
  tooth: { iso: TOOTH_ISO },
  ha: { ini: HEH_INI },
  hah: { ini: HAH_INI, med: HAH_MED },
  sin: { fin: SIN_FIN, iso: SIN_ISO },
};
