// Letters redrawn after the lab, where its forms fail a legibility rule (tests/thuluth-legibility.test.ts). They sit
// over the generated table (letters.data.ts), which stays as the lab left it.
import { LETTERS } from './letters.data';
import type { Family, Form, GlyphDef, LetterForm, SkelPt, ThuluthStyle } from './types';

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

/** The hamza written on the line (ء in شيء, ماء, جزء), which the lab had no letter for: the hamza of the marks
 *  (marks.ts MARK_SHAPES.hamza, the same points) at a letter's size, its foot a little above the baseline. It joins
 *  nothing on either side. */
const HAMZA_K = 2.3;
export const HAMZA: LetterForm = {
  src: 'hand',
  exit: null,
  s: [{ pts: ([[0.45, 0.55, 0.4], [-0.15, 0.7], [-0.45, 0.25], [0.05, -0.05], [0.55, 0.05, 0.8], [-0.5, -0.55, 0.3]] as SkelPt[]).map(([x, y, w]) => [(x - 0.55) * HAMZA_K, (y + 0.55) * HAMZA_K + 0.3, w] as SkelPt) }],
}; // prettier-ignore

export const LETTER_FIXES: Partial<Record<Family, Partial<Record<Form, LetterForm>>>> = {
  kaf: { med: KAF_MED, fin: KAF_END, iso: KAF_END },
  lam: { ini: LAM_INI, med: LAM_MED },
  tooth: { iso: TOOTH_ISO },
  ha: { ini: HEH_INI },
  sin: { fin: SIN_FIN, iso: SIN_ISO },
};

// ---- The letters redrawn at the roundel pen on 31 October 2026 (ThuluthAlts.redrawn), off unless a style asks ----
// Drawn for the dense roundels (the basmala, the salawat), where the master-fitted heads of hah, mim and the hehs
// stood as tall as a word and the learned seen was a ripple: for the owner to judge on sheets (tests/letters.test.ts,
// LETTERS=redrawn) beside the current letters and the drafted stems.

/** A form drawn smaller about its entry (0, 0), the pen's widths kept. */
const scaled = (g: LetterForm, sx: number, sy: number): LetterForm => ({
  src: g.src,
  exit: g.exit == null ? null : g.exit * sx,
  dotX: g.dotX == null ? g.dotX : g.dotX * sx,
  s: g.s.map(st => ({ ...st, pts: st.pts.map(([x, y, w, c]) => [x * sx, y * sy, w, c] as SkelPt) })),
});

/** The seen's three teeth, each a short upstroke to a pointed top about a dot high, the pen turning sharply there and
 *  dropping into a shallow cup to the next; the learned teeth were ripples a third as high, and medial seen dipped
 *  below the line, so بسم and رسول read as a wavy stroke. The medial form rises from the join into its first tooth;
 *  the initial one starts at that tooth's top, as the tooth letters do. Shin's dots stand over the middle tooth. */
const SIN_TEETH: SkelPt[] = [[-0.55, 0.3], [-0.9, -0.15], [-1.35, -0.1], [-1.55, 0.4], [-1.6, 1.0, 0.8, 1], [-1.7, 0.3], [-2.05, -0.15], [-2.5, -0.1], [-2.7, 0.4], [-2.75, 0.95, 0.8, 1], [-2.85, 0.3], [-3.2, -0.1], [-4.0, 0]]; // prettier-ignore
const SIN_MED_R: LetterForm = {
  src: 'hand',
  exit: -4.0,
  dotX: -1.5,
  s: [{ pts: [[0, 0], [-0.3, 0.55], [-0.45, 1.1, 0.8, 1], ...SIN_TEETH] }],
};
const SIN_INI_R: LetterForm = {
  src: 'hand',
  exit: -3.6,
  dotX: -1.1,
  s: [{ pts: ([[-0.45, 1.15, 0.55], ...SIN_TEETH] as SkelPt[]).map(([x, y, w, c]) => [x + 0.4, y, w, c] as SkelPt) }],
};

/** Initial and medial hah, jim, khah: the master's head (gold panel), drawn smaller. At its own size the head stood
 *  three teeth tall and as wide as a word, and every word with a hah turned on it; the masters' line hah has a head
 *  about two and a half dots tall, about as high as ain's and sad's. */
const HAH_INI_R = scaled(LETTERS.hah.ini!, 0.8, 0.72),
  HAH_MED_R = scaled(LETTERS.hah.med!, 0.8, 0.72);

/** Initial mim: the lab's loop, drawn smaller (0.85) about its start, the run to the join kept. Its loop stood five pen
 *  units high, as tall as the hah after it, and محمد began with a dome. */
const MIM_INI_R: LetterForm = (() => {
  const g = scaled(LETTERS.mim.ini!, 0.85, 0.85),
    pts = g.s[0].pts;
  return { ...g, exit: -2.9, s: [{ ...g.s[0], pts: [...pts.slice(0, -1), [-2.9, 0, 1]] }] };
})();
/** Medial mim: a small round loop sitting on the line, its foot just below it. From the join the pen rises over the
 *  loop's top to the left, comes down its left side, back along its foot to the right, and turns to leave along the
 *  foot. The master's fit hung the loop half below the line and ran the exit through it, so at the roundel pen it
 *  closed into a blob. Wider than it is tall, so it stays apart from the taller, necked loop of medial fa and qaf. */
const MIM_MED_R: LetterForm = {
  src: 'hand',
  exit: -3.3,
  s: [{ pts: [[0, 0], [-0.55, 0.35], [-1.25, 1.2], [-2.0, 1.4], [-2.65, 0.95], [-2.75, 0.2], [-2.25, -0.35], [-1.35, -0.4], [-0.75, -0.15, 1, 1], [-1.6, -0.3], [-2.6, -0.15], [-3.3, 0]] }], // prettier-ignore
};

/** Medial heh: the lab's ear above the line and small loop below it, drawn a quarter larger. At its own size it sat
 *  lower than the teeth beside it and closed into a dark knot at the roundel pen (اللهم). */
const HEH_MED_R: LetterForm = {
  src: 'hand',
  exit: -3.125,
  s: [{ pts: [[0, 0], [-0.5, 0.6], [-0.44, 1.98, 0.8], [-1.31, 2.4, 0.8], [-1.69, 1.38], [-1.0, 0.42], [-1.19, -0.66], [-2.0, -0.84], [-2.06, -0.06], [-3.125, 0]] }], // prettier-ignore
};

/** Final heh and ta marbuta after a join (the round design, style.heh): the same crossed loop, rising from the join,
 *  over the top and down across its own upstroke to a short tail, drawn a sixth lower and a little wider. The lab's
 *  stood 5.75 pen units high at the roundel pen, a tall teardrop on a stalk over the letters around it; this one's eye
 *  stays open. */
export const REDRAWN_HEH_FIN: Partial<Record<ThuluthStyle['heh'], GlyphDef>> = {
  round: { exit: null, s: [{ pts: [[0, 0], [-0.7, 0.45], [-1.45, 1.35], [-1.7, 2.25], [-1.35, 2.8], [-0.65, 2.85], [-0.15, 2.35], [-0.25, 1.45], [-0.85, 0.6], [-1.5, 0.2, 0.75], [-2.0, 0.12, 0.4]] }] }, // prettier-ignore
};

/** The redrawn letters, laid over the table by alts.ts altForms when a style asks for `redrawn`. */
export const REDRAWN_FIXES: Partial<Record<Family, Partial<Record<Form, LetterForm>>>> = {
  ha: { med: HEH_MED_R },
  hah: { ini: HAH_INI_R, med: HAH_MED_R },
  mim: { ini: MIM_INI_R, med: MIM_MED_R },
  sin: { ini: SIN_INI_R, med: SIN_MED_R, fin: sinEnd(SIN_MED_R), iso: sinEnd(SIN_INI_R) },
};

/** The name of God in the classic thuluth form, with the redrawn set: two tall lams standing close, a little shorter
 *  than the alif, each written down to a short foot that runs into the next letter; then a small round heh leaning on
 *  the second lam's foot. The shadda sits on the second lam, its top level with the alif's. (The design above joins the
 *  lams in bowls and makes the heh a tall arch as high as them; at the roundel pen that read as اللم.) */
const ALLAH_TOP_R = 7.7;
const allahStemR = (exitX: number) =>
  ({
    ang: 38,
    lean: true,
    pts: [[0.6, ALLAH_TOP_R, 0.2], [0.22, ALLAH_TOP_R - 0.3, 0.8], [0.0, ALLAH_TOP_R - 0.9, 1], [0.0, 4.6, 1], [-0.05, 1.6, 0.95], [-0.2, 0.45, 0.9], [-0.75, 0.05, 1], [exitX, 0.0, 1]], // prettier-ignore
  }) as LetterForm['s'][number];
export const ALLAH_REDRAWN: { ini: LetterForm; lam: LetterForm; heh: LetterForm } = {
  // the first lam's foot runs on to the second lam's stem, which stands at its origin (the shadda is set over it)
  ini: { src: 'hand', exit: -3.1, s: [allahStemR(-3.1)] },
  lam: { src: 'hand', exit: -1.6, s: [allahStemR(-1.6)] },
  // its heh: from the second lam's foot up and round to the left, down and back along the line to close against the
  // foot; about two and a half dots tall at the roundel pen
  heh: { src: 'hand', exit: null, s: [{ pts: [[0, 0], [-0.9, 0.0], [-2.0, 0.08], [-2.85, 0.5], [-3.2, 1.35], [-2.9, 2.3], [-2.1, 2.75], [-1.35, 2.45], [-0.95, 1.65], [-1.05, 0.8], [-1.55, 0.25, 0.8], [-2.05, 0.12, 0.4]] }] }, // prettier-ignore
};
