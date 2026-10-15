// Letters redrawn after the lab, where its forms fail a legibility rule (tests/thuluth-legibility.test.ts). They sit
// over the generated table (letters.data.ts), which stays as the lab left it.
import type { Family, Form, LetterForm } from './types';

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

export const LETTER_FIXES: Partial<Record<Family, Partial<Record<Form, LetterForm>>>> = {
  kaf: { fin: KAF_END, iso: KAF_END },
};
