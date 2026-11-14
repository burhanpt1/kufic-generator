// Drafted alternative letterforms (ThuluthStyle.alts), for the owner to judge beside the current ones. Nothing here is
// drawn unless a style asks for it: the letter table and the ligatures are as before when `alts` is unset.
import { ALLAH_HEH, ALLAH_LAM, ALLAH_LAM_INI } from './fixes';
import type { Family, Form, GlyphDef, SkelPt, StrokeDef, ThuluthAlts } from './types';

type LetterForm = GlyphDef & { src?: string };

/** The set recommended to the owner (see the comparison sheets, tests/letters.test.ts): the tarwis stems, the letters
 *  of محمد redrawn with the name as its ligature, and the audit's corrections. */
export const RECOMMENDED: ThuluthAlts = { stems: 'a', muhammad: 'c', fixes: true };

/** The set the owner chose from the comparison sheets (14 November 2026): the fuller jali head on the stems, the
 *  letters of محمد redrawn with the name as its ligature, and the audit's corrections. */
export const CHOSEN: ThuluthAlts = { stems: 'c', muhammad: 'c', fixes: true };

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

/** Half the roundel nib along its edge at STEM_ANG: the serifs of a and b are drawn for that pen (a lighter pen
 *  rounds them); c's are drawn for the pen that writes them (headC). */
const HX = 0.8 * Math.cos((STEM_ANG * Math.PI) / 180),
  HY = 0.8 * Math.sin((STEM_ANG * Math.PI) / 180);
/** A serif written from its tip (dx, dy from the top's right corner) into the stem's top: the nib's upper end runs
 *  from the tip to that corner (straight, or bowed outwards by `bow`) while it opens from nothing to `w` (as t^p: 1 a
 *  wedge, more a hollow beak). `hx`, `hy`: half the nib along its edge. */
function serif(
  x: number,
  top: number,
  tip: [number, number],
  w: number,
  p: number,
  hx = HX,
  hy = HY,
  bow = 0,
): SkelPt[] {
  // prettier-ignore
  // the top's right corner: the upper end of the nib where it stands at the head of the shaft
  const cx = x + hx * w,
    cy = top,
    l = Math.hypot(tip[0], tip[1]),
    nx = -tip[1] / l,
    ny = tip[0] / l;
  return [0, 0.18, 0.36, 0.54, 0.72, 0.88, 1].map(t => {
    const k = Math.max(0.02, w * t ** p),
      b = bow * Math.sin(Math.PI * t);
    return [cx + tip[0] * (1 - t) + nx * b - hx * k, cy + tip[1] * (1 - t) + ny * b - hy * k, k, t === 1 ? 1 : undefined] as SkelPt; // prettier-ignore
  });
}
/** Which head a stem of alternative c carries: the full one; the lesser one of a lam that follows another stem in
 *  its word (ال, لل: in a run of stems the first carries the full head and the next a smaller one, or the heads
 *  crowd each other); none, the top cut by the nib, on the second lam of the name of God. */
type Rank = 0 | 1 | 2;
/** How a stem is drawn: the alternative, the pen's nib (c's head keeps its proportion to the shaft at every pen),
 *  and the head's rank. */
interface Pen {
  alt: Head;
  nib: number;
  rank: Rank;
}
/** The head of alternative c for a nib: the serif, the swell below it and the taper to the shaft's weight. */
function headC(x: number, top: number, nib: number, rank: Rank): SkelPt[] {
  const s = nib / 1.6,
    hx = HX * s,
    hy = HY * s;
  if (rank === 2) return [[x, top - hy * 0.94, 0.94], [x, top - 1.3, 1], [x, top - 2, 1]]; // prettier-ignore
  const m = rank ? 0.66 : 1,
    w = rank ? 1.05 : 1.14;
  return [
    ...serif(x, top, [0.78 * s * m, -1.5 * s * m], w, 1.45, hx, hy, 0.1 * s * m),
    ...(rank ? ([[x, top - 2, 1]] as SkelPt[]) : ([[x, top - 1.9, 1.1], [x, top - 3.8, 1]] as SkelPt[])), // prettier-ignore
  ];
}
/** The head of a stem standing at x with its top at `top` (the ink's top, not the skeleton's), down to where the
 *  shaft begins. */
function head(pen: Pen, x: number, top: number): SkelPt[] {
  if (pen.alt === 'a') return [...serif(x, top, [0.58, -1.05], 1, 2), [x, top - 2, 1]];
  if (pen.alt === 'b') return [[x, top - HY, 1], [x, top - 2, 1]]; // prettier-ignore
  return headC(x, top, pen.nib, pen.rank);
}
const stemStroke = (pts: SkelPt[], lean = true): StrokeDef => ({ ang: STEM_ANG, lean, pts });

/** A stem that joins onwards: the shaft tapering into the bend, and the bend at the line's own angle out to `exit`. */
function joiningStem(pen: Pen, x: number, top: number, exit: number): StrokeDef[] {
  // c: the same foot with a longer taper and a rounder bend, so the two strokes' outlines run into one curve
  if (pen.alt === 'c')
    return [
      stemStroke([...head(pen, x, top), [x, 5.2, 1], [x - 0.02, 2.2, 1], [x - 0.08, 1.25, 0.93], [x - 0.3, 0.6, 0.66], [x - 0.62, 0.22, 0.34], [x - 0.9, 0.08, 0.12]]), // prettier-ignore
      { lean: true, pts: [[x - 0.02, 2.6, 0.4], [x - 0.04, 1.6, 0.75], [x - 0.22, 0.62, 0.97], [x - 0.62, 0.14, 1], [x - 1.15, 0.01, 1], [exit, 0, 1]] }, // prettier-ignore
    ];
  return [
    stemStroke([...head(pen, x, top), [x, 5.2, 1], [x - 0.02, 1.9, 1], [x - 0.08, 1.0, 0.92], [x - 0.3, 0.42, 0.55], [x - 0.6, 0.18, 0.15]]), // prettier-ignore
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

const reHead = (pen: Pen, st: StrokeDef, keepFrom: number, x: number, top: number): StrokeDef => ({
  ...st,
  pts: [...head(pen, x, top), ...st.pts.slice(keepFrom)],
});

/** The lams (and the lam-alif) with a head: every form, for a full head or a lesser one. */
function lamForms(pen: Pen, la: Partial<Record<Form, LetterForm>>): Forms {
  const lamBowl = (dx: number): SkelPt[] => [[dx, 5.2, 1], [-0.05 + dx, 1.4, 0.95], [-0.25 + dx, -0.4], [-0.9 + dx, -1.55], [-2.2 + dx, -2.05], [-3.3 + dx, -1.5], [-3.65 + dx, -0.4], [-3.45 + dx, 0.55, 0.4], [-3.15 + dx, 1.1, 0.12]]; // prettier-ignore
  return {
    lam: {
      ini: { src: 'hand', exit: -1.9, s: joiningStem(pen, 0, 10, -1.9) },
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
          ...joiningStem(pen, -1.0, 10, -2.2),
        ],
      },
      fin: { src: 'hand', exit: null, s: [{ pts: [[0, 0], [-0.8, 0]] }, stemStroke([...head(pen, -0.9, 10), ...lamBowl(-0.9)])] }, // prettier-ignore
      iso: { src: 'hand', exit: null, s: [stemStroke([...head(pen, 0, 10), ...lamBowl(0)])] },
    },
    lamalif: {
      iso: { ...la.iso!, s: [reHead(pen, la.iso!.s[0], 3, 0.6, 9.7), la.iso!.s[1]] },
      fin: { ...la.fin!, s: [la.fin!.s[0], reHead(pen, la.fin!.s[1], 3, -0.4, 9.7), la.fin!.s[2]] },
    },
  };
}

/** The height of c's alif: a little under the lams' 10, as the masters set the two. */
const ALIF_TOP_C = 9.7;

function stemForms(alt: Head, base: Forms, nib: number, body: number): Forms {
  const pen: Pen = { alt, nib, rank: 0 },
    c = alt === 'c',
    ta = base.ta!;
  // the ta is drawn at the body's scale: with c its stem stands as high as the lam and its head is the lam's (a and
  // b leave both to grow with the body)
  const taPen: Pen = { ...pen, nib: nib / body },
    taTop = c ? 10 / body : 8.9,
    taStem = (f: LetterForm, x: number): LetterForm => ({
      ...f,
      s: f.s.map(s =>
        s.ang === 38 ? stemStroke([...head(taPen, x, taTop), [x, c ? 2.6 : 4, 1], [x, 1.6, 0.9]], false) : s,
      ),
    });
  // the alif's foot thins to a point that turns a little to the left
  const alifTop = c ? ALIF_TOP_C : 10,
    foot: SkelPt[] = c
      ? [[0, 5.6, 1], [-0.02, 3.3, 0.9], [-0.1, 1.5, 0.66], [-0.24, 0.5, 0.36], [-0.36, 0.05, 0.14]] // prettier-ignore
      : [[0, 5.2, 1], [-0.03, 2.6, 0.9], [-0.12, 1.0, 0.6], [-0.28, 0.1, 0.2]]; // prettier-ignore
  return {
    alif: {
      iso: { src: 'hand', exit: null, s: [stemStroke([...head(pen, 0, alifTop), ...foot])] },
      // joined from the right: up from the line with no serif, as a joined alif is written
      fin: { src: 'hand', exit: null, s: [{ lean: true, pts: [[0, 0], [-0.5, 0.02], [-0.84, 0.36, 0.95], [-0.9, 1.3, 0.75], [-0.9, 2.4, 0.5]] }, stemStroke([[-0.88, 9.5, 0.8], [-0.9, 8.6, 0.95], [-0.9, 5.2, 1], [-0.9, 1.9, 1], [-0.86, 1.0, 0.9], [-0.66, 0.42, 0.5], [-0.4, 0.2, 0.15]])] }, // prettier-ignore
    },
    ...lamForms(pen, base.lamalif!),
    ta: { ini: taStem(ta.ini!, -1.5), iso: taStem(ta.iso!, -1.5), med: taStem(ta.med!, -1.9), fin: taStem(ta.fin!, -1.9) }, // prettier-ignore
    // final and isolated kaf: its upright at the stems' weight (it was a hairline beside a heavy base), turning
    // into the base as the lams do
    kaf: { fin: kafEnd(base.kaf!.fin!, true), iso: kafEnd(base.kaf!.iso!, false) },
  };
}

/** With c, the forms of a lam (or lam-alif) that follows another tall stem in its word: the lesser head. Null for
 *  the other alternatives, whose stems are all alike. */
export function ledForms(alts: ThuluthAlts | undefined, base: Forms, nib: number): Forms | null {
  return alts?.stems === 'c' ? lamForms({ alt: 'c', nib, rank: 1 }, base.lamalif!) : null;
}

/** The lams and heh of the name of God, with the alternative's head on the lams (c: the lesser head on the first,
 *  which stands beside the alif's full one, and none on the second, under the shadda). */
export function allahForms(
  alts: ThuluthAlts | undefined,
  nib = 1.6,
): { ini: LetterForm; lam: LetterForm; heh: LetterForm } {
  const alt = alts?.stems;
  if (!alt) return { ini: ALLAH_LAM_INI, lam: ALLAH_LAM, heh: ALLAH_HEH };
  const c = alt === 'c',
    re = (f: LetterForm, rank: Rank): LetterForm => ({ ...f, s: [reHead({ alt, nib, rank }, f.s[0], 3, 0, 7.85)] });
  return { ini: re(ALLAH_LAM_INI, c ? 1 : 0), lam: re(ALLAH_LAM, c ? 2 : 0), heh: ALLAH_HEH };
}

// ---- Part 2: محمد ----
/** Initial mim: a closed, open-eyed head standing on the line, an egg a little taller than wide, written from its
 *  foot round to the right, over the top and down the left side into the join. (Taller than wide on purpose: a round
 *  or a low head came within 0.3 of the initial heh and fa in the confusion matrix.) */
const MIM_INI_A: LetterForm = {
  src: 'hand',
  exit: -3.4,
  s: [{ pts: [[-2.2, 0.1, 1], [-1.2, -0.1, 1], [-0.25, 0.4, 1], [0.2, 1.4, 1], [0.0, 2.3, 1], [-0.7, 2.8, 1], [-1.6, 2.5, 1], [-2.1, 1.6, 1], [-2.2, 0.1, 1], [-2.8, 0, 1], [-3.4, 0, 1]] }], // prettier-ignore
};
/** Medial hah: the join rises to the head's point on the right and turns back in one sweep down to the line; the
 *  roof is a second stroke from its free left end, a short hook, to that point. Open on the left, as ح must be. */
const HAH_MED_A: LetterForm = {
  src: 'hand',
  exit: -6.0,
  dotX: -2.6,
  s: [
    { pts: [[0, 0, 1], [-0.45, 0.25, 1], [-0.7, 1.0, 0.8], [-0.75, 2.0, 0.45, 1], [-1.6, 1.65, 1], [-3.0, 0.85, 1], [-4.3, 0.2, 1], [-5.2, 0.0, 1], [-6.0, 0, 1]] },
    { pts: [[-4.35, 2.5, 0.4], [-4.1, 2.95, 0.85], [-3.5, 3.2, 1], [-2.3, 3.0, 1], [-1.2, 2.55, 1], [-0.55, 2.1, 0.6]] },
  ], // prettier-ignore
};
/** Medial mim: a round bead hanging under the line, solid at the jali pen. */
const MIM_MED_A: LetterForm = {
  src: 'hand',
  exit: -3.1,
  s: [{ pts: [[0, 0, 1], [-0.8, -0.05, 1], [-1.6, -0.5, 1], [-1.95, -1.35, 1], [-1.55, -2.1, 1], [-0.85, -1.85, 1], [-0.7, -1.05, 1], [-1.25, -0.3, 1], [-2.2, 0, 1], [-3.1, 0, 1]] }], // prettier-ignore
};
/** Final dal at a letter's size: three dots tall, its base as long, the angle between them open. */
const DAL_FIN_A: LetterForm = {
  src: 'hand',
  exit: null,
  s: [{ pts: [[0, 0], [-1.3, 0]] }, { pts: [[-1.5, 2.85, 0.5], [-1.15, 2.1, 0.85], [-0.5, 0.25, 1, 1], [-1.5, 0.0, 1], [-2.9, -0.05, 0.9], [-3.6, 0.25, 0.4]] }], // prettier-ignore
};
/** The name written as the jali ligature: the mim raised, its tail coming down to where the hah's roof begins; the
 *  roof sweeping back to the right under the mim to the head's point, and from there the long stroke down to the
 *  line, a storey below, where the second mim and the dal stand. `drop` is how far the line falls after the hah. */
const NAME_MIM: LetterForm = {
  src: 'hand',
  exit: -3.4,
  s: [{ pts: [[-2.05, 2.0, 1], [-1.0, 1.5, 1], [-0.2, 1.85, 1], [0.1, 2.55, 1], [-0.35, 3.2, 1], [-1.15, 3.4, 1], [-1.8, 3.0, 1], [-2.0, 2.5, 1], [-2.05, 2.0, 1], [-2.45, 1.15, 1], [-3.0, 0.4, 0.82], [-3.4, 0, 0.42, 1]] }], // prettier-ignore
};
const NAME_DROP = 2.7;
const NAME_HAH: LetterForm = {
  src: 'hand',
  exit: -2.3,
  dotX: 1.2,
  // (the roof begins and ends in a point: the pen opens out of the mim's tail, and closes into the head's point)
  s: [{ pts: [[0, 0, 0.42], [0.55, -0.16, 0.78], [1.3, -0.27, 1], [2.6, -0.3, 1], [3.35, -0.14, 0.8], [3.75, 0.0, 0.3, 1], [3.3, -0.33, 0.72], [2.6, -0.75, 1], [1.0, -1.7, 1], [-0.4, -2.4, 1], [-1.5, -NAME_DROP, 1], [-2.7, -NAME_DROP, 1]] }], // prettier-ignore
};
/** The ligature's letters for a style, or null when the name is written letter by letter. */
export function nameForms(alts: ThuluthAlts | undefined): { letters: LetterForm[]; drop: number } | null {
  return alts?.muhammad === 'b' || alts?.muhammad === 'c'
    ? { letters: [NAME_MIM, NAME_HAH, MIM_MED_A, DAL_FIN_A], drop: NAME_DROP }
    : null;
}

function muhammadForms(alt: NonNullable<ThuluthAlts['muhammad']>): Forms {
  // a: the letters redrawn, in every word; b: the ligature alone, in the name; c: both
  if (alt === 'b') return {};
  return { mim: { ini: MIM_INI_A, med: MIM_MED_A }, hah: { med: HAH_MED_A }, dal: { fin: DAL_FIN_A } };
}

// ---- Part 3: corrections from the audit ----
// Each is a drawing error, not a matter of taste: a join that does not reach, a stub with nothing to join, a spur
// where two strokes meet, dots that land on the next letter.
export const ALT_FIXES = ['kaf-med', 'kaf-iso', 'dal-fin', 'qaf-end', 'fa-qaf-room'] as const;
const move = (pts: readonly SkelPt[], dx: number): SkelPt[] => pts.map(([x, y, w, c]) => [x + dx, y, w, c] as SkelPt);
const FIXES: Record<(typeof ALT_FIXES)[number], (base: Forms) => Forms> = {
  // medial kaf: its joining stroke stopped 0.6 from the letter before, three units short of the kaf's foot, so the
  // kaf stood apart from its word (لكم). The join now runs along the line to the foot.
  'kaf-med': base => {
    const f = base.kaf!.med!;
    return {
      kaf: {
        med: {
          ...f,
          s: [
            {
              pts: [
                [0, 0, 1],
                [-2.0, 0.02, 1],
                [-3.9, 0.0, 1],
              ],
            },
            ...f.s.slice(1),
          ],
        },
      },
    };
  },
  // isolated kaf: drawn with the final's joining stub, which stuck out at its foot with nothing to join
  'kaf-iso': base => {
    const f = base.kaf!.iso!;
    return f.s.length === 4 ? { kaf: { iso: { ...f, s: f.s.slice(1) } } } : {};
  },
  // final dal: the joining stub ran under the corner and out the other side, a spur below the letter. The join now
  // runs into the base, and the upright comes down onto it.
  'dal-fin': () => ({
    dal: { fin: { src: 'hand', exit: null, s: [{ pts: [[0, 0], [-0.9, 0]] }, { pts: [[-1.05, 2.25, 0.5], [-0.75, 1.6, 0.85], [-0.4, 0.22, 1, 1], [-1.2, 0.02, 1], [-2.1, 0, 0.85], [-2.6, 0.2, 0.4]] }] } }, // prettier-ignore
  }),
  // final and isolated qaf: the bowl began at full width outside the head, a blunt end crossing the head's own
  // close (a star of spurs on its right). It now leaves from inside the head's right wall, as a waw's does; and the
  // isolated qaf has no joining stub.
  'qaf-end': base => {
    const head = base.qaf!.fin!.s[0],
      bowl: StrokeDef = { pts: [[-0.13, 1.1, 0.7], [-0.12, 0.3, 0.95], [-0.55, -0.75, 1], [-1.6, -1.9, 1], [-2.9, -2.45, 1], [-4, -1.9, 1], [-4.4, -0.7, 1], [-4.65, 0.47, 0.4], [-4.25, 1.28, 0.12]] }; // prettier-ignore
    return {
      qaf: {
        fin: { ...base.qaf!.fin!, s: [head, bowl] },
        iso: { ...base.qaf!.iso!, s: [{ ...head, pts: head.pts.slice(1) }, bowl] },
      },
    };
  },
  // initial and medial fa and qaf: the dots, set over the middle of the join, landed on a stem that followed (قلب),
  // and the join was so short that the stem stood against the head. The dots now sit over the head, and the initial
  // letter's join is a little longer (no more: a long join brings the letter towards the initial heh).
  'fa-qaf-room': base => {
    const room = (f: LetterForm, head: number, more: number): LetterForm => ({
      ...f,
      exit: f.exit! - more,
      dotX: head,
      s: f.s.map((st, i) => (i === f.s.length - 1 ? { ...st, pts: [...st.pts.slice(0, -1), ...move(st.pts.slice(-1), -more)] } : st)), // prettier-ignore
    });
    return {
      fa: { ini: room(base.fa!.ini!, -0.55, 0.3), med: room(base.fa!.med!, -0.8, 0) },
      qaf: { ini: room(base.qaf!.ini!, -0.55, 0.3), med: room(base.qaf!.med!, -0.8, 0) },
    };
  },
};

/** The letter forms a style's alternatives replace, given the table they are laid over. */
export function altForms(alts: ThuluthAlts, base: Forms, nib = 1.6, body = 1.45): Forms {
  const out: Forms = {};
  const add = (f: Forms) => {
    for (const [fam, fs] of Object.entries(f) as [Family, Partial<Record<Form, LetterForm>>][])
      out[fam] = { ...out[fam], ...fs };
  };
  // the corrections first, so that an alternative which redraws the same letter is laid over its correction
  const fixes = alts.fixes === true ? ALT_FIXES : alts.fixes || [];
  for (const k of fixes) if (k in FIXES) add(FIXES[k as (typeof ALT_FIXES)[number]](base));
  const fixed = { ...base };
  for (const [fam, fs] of Object.entries(out) as [Family, Partial<Record<Form, LetterForm>>][])
    fixed[fam] = { ...base[fam], ...fs };
  if (alts.stems) add(stemForms(alts.stems, fixed, nib, body));
  if (alts.muhammad) add(muhammadForms(alts.muhammad));
  return out;
}
