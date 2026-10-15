// ================= THULUTH DAY 1 =================
// Letters are pen strokes: smooth curves through points measured in nib widths, with the baseline at y = 0, the
// connection coming in at (0, 0) from the right and leaving at `exit` on the left. Each point is [x, y, width, corner].
// A broad nib held at a fixed angle is dragged along each stroke; thick and thin come from the angle alone.
const T = {};
// ---- letter families ----
const OPT = { heh: 'round', slant: 'left' };
const LEAN = () => (typeof OPT.slant === 'number' ? OPT.slant : OPT.slant === 'left' ? -0.06 : OPT.slant === 'right' ? 0.14 : 0);
let CR_T = 0.5, LOOP_GAP = 0.9; // curve tension: 0.5 is a Catmull-Rom spline; lower is tighter, higher is rounder
const lean = pts => pts.map(([x, y, w, c]) => [x + LEAN() * y, y, w, c]);
const ALIF_STEM = (dx = 0) => ({ ang: 38, lean: true, pts: [[0.65 + dx, 10.0, 0.2], [0.25 + dx, 9.7, 0.8], [0.0 + dx, 9.05, 1], [0.0 + dx, 5.5, 0.95], [-0.05 + dx, 1.8, 0.7], [-0.1 + dx, 0.1, 0.35]] });
const LAM_STEM = (dx = 0, exitX = -1.7) => ({ ang: 38, lean: true, pts: [[0.65 + dx, 10.0, 0.2], [0.25 + dx, 9.7, 0.8], [0.0 + dx, 9.05, 1], [0.0 + dx, 5.5, 1], [-0.05 + dx, 1.6, 0.95], [-0.2 + dx, 0.45, 0.9], [-0.75 + dx, 0.05, 1], [exitX, 0.0, 1]] });
T.alif = { iso: { s: [ALIF_STEM()], exit: null }, fin: { s: [{ pts: [[0, 0], [-0.7, 0.05]] }, ALIF_STEM(-1.3)], exit: null } };
T.lam = {
  ini: { s: [LAM_STEM(0, -1.8)], exit: -1.8 },
  med: { s: [{ pts: [[0, 0], [-1.0, 0]] }, LAM_STEM(-1.0, -2.6)], exit: -2.6 },
};
T.tooth = { // ba, ta, tha, nun, ya in initial and medial position
  fin: { dotX: -2.4, s: [{ pts: [[0, 0], [-0.4, -0.15], [-1.6, -0.3], [-3.3, -0.2], [-4.2, 0.1], [-4.6, 0.65, 0.45], [-4.7, 1.3, 0.12]] }], exit: null },
  iso: { dotX: -2.2, s: [{ pts: [[0.3, 1.0, 0.3], [0.1, 0.35, 0.8], [-0.4, -0.15], [-1.6, -0.3], [-3.3, -0.2], [-4.2, 0.1], [-4.6, 0.65, 0.45], [-4.7, 1.3, 0.12]] }], exit: null },
  ini: { dotX: 0.1, s: [{ pts: [[0.45, 2.75, 0.2], [0.15, 2.0, 0.9], [0.0, 0.7, 1], [-0.45, 0.05, 1], [-1.3, 0.0, 1]] }], exit: -1.3 },
  med: { dotX: -0.52, s: [{ pts: [[0, 0], [-1.6, 0]] }, { pts: [[-0.25, 2.45, 0.2], [-0.5, 1.7, 0.9], [-0.65, 0.15, 1]] }], exit: -1.6 },
  // a long, shallow final sweep for an emphasised ba (after the curves of tughra arms)
  finLong: { dotX: -4.6, s: [{ pts: [[0, 0], [-0.9, -0.22], [-2.6, -0.58], [-5.0, -0.72], [-7.3, -0.52], [-8.7, -0.05], [-9.35, 0.6, 0.55], [-9.55, 1.25, 0.15]] }], exit: null },
};
T.sin = { // seen: three sharp teeth on a soft base
  ini: { s: [{ pts: [[0.2, 1.7, 0.5], [0.05, 1.2, 0.9], [-0.05, 0.3, 1], [-0.45, 0.05, 1], [-0.75, 0.35, 1], [-0.9, 1.5, 0.8, 1], [-1.0, 0.35, 1], [-1.4, 0.05, 1], [-1.75, 0.35, 1], [-1.9, 1.5, 0.8, 1], [-2.0, 0.35, 1], [-2.4, 0.0, 1], [-3.0, 0.0, 1]] }], exit: -3.0 },
  med: { s: [{ pts: [[0, 0], [-0.35, 0.3, 1], [-0.5, 1.5, 0.8, 1], [-0.6, 0.35, 1], [-1.0, 0.05, 1], [-1.35, 0.35, 1], [-1.5, 1.5, 0.8, 1], [-1.6, 0.35, 1], [-2.0, 0.05, 1], [-2.35, 0.35, 1], [-2.5, 1.5, 0.8, 1], [-2.6, 0.35, 1], [-3.0, 0.0, 1], [-3.6, 0.0, 1]] }], exit: -3.6 },
};
T.mim = {
  ini: { s: [{ pts: [[0.0, 0.35, 0.6], [-0.15, 1.75, 0.9], [-1.25, 2.55, 0.9], [-2.45, 1.85, 0.9], [-2.35, 0.55, 0.9], [-1.25, 0.0, 0.9], [-0.45, 0.2, 0.7], [-1.7, 0.0, 1], [-2.9, 0.0, 1]] }], exit: -2.9 },
  med: { s: [{ pts: [[0, 0], [-0.6, 0.45], [-1.5, 0.55], [-2.15, -0.3], [-1.6, -1.35], [-0.8, -0.95], [-0.95, -0.15], [-1.9, 0.0], [-2.9, 0.0]] }], exit: -2.9 },
  fin: { s: [{ pts: [[0, 0], [-0.6, 0.9], [-1.5, 1.75], [-2.45, 1.3], [-2.35, 0.3], [-1.45, -0.1], [-0.85, 0.2, 0.8]] }, { pts: [[-2.25, 0.2, 1], [-2.35, -1.4, 0.9], [-2.5, -3.0, 0.6], [-2.75, -3.75, 0.35], [-3.15, -3.75, 0.12]] }], exit: null },
};
const HEH_FIN = {
  round: { s: [{ pts: [[0, 0], [-0.75, 0.55], [-1.5, 1.7], [-1.55, 2.95], [-0.85, 3.45], [-0.25, 2.8], [-0.45, 1.6], [-1.05, 0.65], [-1.55, 0.25, 0.75], [-1.95, 0.15, 0.4]] }], exit: null },
  almond: { s: [{ pts: [[0, 0], [-0.6, 0.3], [-1.45, 1.25], [-1.9, 2.55], [-2.2, 3.65, 0.55, 1], [-1.45, 2.75], [-0.95, 1.55], [-1.15, 0.6], [-1.75, 0.3, 0.6], [-1.45, 0.6, 0.2]] }], exit: null },
  eye: { s: [{ pts: [[0, 0], [-0.75, 0.85], [-1.95, 1.45], [-3.0, 1.1], [-3.15, 0.3], [-2.2, -0.05], [-1.2, 0.15], [-0.85, 0.5, 0.45]] }], exit: null },
};
T.ha = { // final heh after a connection: a rising loop
  fin: { s: [{ pts: [[0, 0], [-0.75, 0.55], [-1.5, 1.7], [-1.55, 2.95], [-0.85, 3.45], [-0.25, 2.8], [-0.45, 1.6], [-1.05, 0.65], [-1.55, 0.25, 0.75], [-1.95, 0.15, 0.4]] }], exit: null },
  iso: { s: [{ pts: [[0, 1.2], [-0.8, 2.4], [-1.9, 1.9], [-1.8, 0.4], [-0.6, 0.2], [-0.2, 1.1]] }], exit: null },
};
T.ha.ini = { s: [{ pts: [[0.05, 0.3, 0.6], [0.05, 1.6, 0.9], [-0.75, 2.5, 0.9], [-1.55, 1.75, 0.9], [-1.2, 0.75, 0.9], [-0.45, 0.45, 0.7, 1], [-0.65, 0.05, 1], [-1.7, 0.0, 1]] }], exit: -1.7 };
T.ha.med = { s: [{ pts: [[0, 0], [-0.4, 0.5], [-0.35, 1.65, 0.8], [-1.05, 2.0, 0.8], [-1.35, 1.15], [-0.8, 0.35], [-0.95, -0.55], [-1.6, -0.7], [-1.65, -0.05], [-2.5, 0.0]] }], exit: -2.5 };
Object.defineProperty(T.ha, 'fin', { get: () => HEH_FIN[OPT.heh] || HEH_FIN.round, configurable: true });
T.ra = {
  fin: { s: [{ pts: [[0, 0], [-0.5, 0.15], [-0.95, -0.3], [-1.7, -1.6, 0.9], [-2.9, -2.6, 0.55], [-3.95, -2.9, 0.3], [-4.45, -2.65, 0.12]] }], exit: null },
  iso: { s: [{ pts: [[0.1, 0.8, 0.7], [-0.15, 0.2], [-0.7, -0.6], [-1.5, -1.6, 0.85], [-2.5, -2.35, 0.55], [-3.4, -2.65, 0.2]] }], exit: null },
};
T.hah = { // hah, jim, khah: a broad head stroke folding back to the baseline
  ini: { s: [{ pts: [[0.45, 2.3, 0.15], [0.1, 2.2, 0.6], [-0.4, 2.1, 0.75], [-0.75, 1.85, 0.7], [-0.45, 1.35, 0.75], [0.05, 0.8, 0.8], [-0.1, 0.2, 0.9], [-0.8, 0.0, 1], [-1.6, 0.0, 1]] }], exit: -1.6 },
  med: { s: [{ pts: [[0, 0], [-0.25, 0.25, 0.9], [0.05, 1.3, 0.6], [0.45, 2.15, 0.3]] }, { pts: [[0.3, 2.4, 0.15], [-0.15, 2.3, 0.65], [-0.8, 2.15, 0.8], [-1.15, 1.9, 0.7], [-0.8, 1.35, 0.75], [-0.3, 0.8, 0.8], [-0.45, 0.2, 0.9], [-1.1, 0.0, 1], [-2.0, 0.0, 1]] }], exit: -2.0 },
};
T.nun = {
  fin: { s: [{ pts: [[0, 0], [-0.4, -0.5], [-1.1, -1.9], [-2.6, -2.75], [-4.1, -2.2], [-4.75, -0.8], [-4.6, 0.6, 0.45], [-4.25, 1.3, 0.15]] }], exit: null },
};
T.dal = { // elbow at the lower right: the head comes down into it, the base runs off to the left
  fin: { s: [{ pts: [[0, 0], [-0.35, 0.12]] }, { pts: [[-1.05, 2.25, 0.5], [-0.75, 1.6, 0.85], [-0.35, 0.35, 1, 1], [-1.2, 0.02, 1], [-2.1, 0.0, 0.85], [-2.6, 0.2, 0.4]] }], exit: null },
  iso: { s: [{ pts: [[-0.55, 2.25, 0.5], [-0.25, 1.6, 0.85], [0.15, 0.35, 1, 1], [-0.7, 0.02, 1], [-1.6, 0.0, 0.85], [-2.1, 0.2, 0.4]] }], exit: null },
};
const LAM_BOWL = (dx = 0) => ({ ang: 38, lean: false, pts: [[0.65 + dx, 10.0, 0.2], [0.25 + dx, 9.7, 0.8], [0.0 + dx, 9.05, 1], [0.0 + dx, 5.5, 1], [-0.05 + dx, 1.4, 0.95], [-0.25 + dx, -0.4], [-0.9 + dx, -1.55], [-2.2 + dx, -2.05], [-3.3 + dx, -1.5], [-3.65 + dx, -0.4], [-3.45 + dx, 0.55, 0.4], [-3.15 + dx, 1.1, 0.12]] });
T.lam.fin = { s: [{ pts: [[0, 0], [-0.8, 0]] }, LAM_BOWL(-0.9)], exit: null };
T.lam.iso = { s: [LAM_BOWL(0)], exit: null };
T.nun.iso = { s: [{ pts: [[0.1, 0.8, 0.5], [-0.1, 0.2], [-0.6, -0.75], [-1.4, -1.95], [-2.7, -2.5], [-3.9, -1.95], [-4.4, -0.75], [-4.2, 0.55, 0.4], [-3.85, 1.2, 0.12]] }], exit: null };
T.waw = { // a round head and a falling tail
  fin: { s: [{ pts: [[0, 0], [-0.55, 0.65], [-1.25, 1.35], [-1.95, 1.0], [-1.85, 0.3], [-1.15, 0.1], [-0.95, 0.45, 0.85]] }, { pts: [[-1.15, 0.2, 1], [-1.4, -0.6], [-2.1, -1.6, 0.85], [-3.1, -2.4, 0.5], [-3.9, -2.6, 0.25], [-4.3, -2.4, 0.1]] }], exit: null },
  iso: { s: [{ pts: [[-0.3, 0.55, 0.7], [-0.6, 1.35], [-1.35, 1.45], [-1.7, 0.75], [-1.2, 0.15], [-0.7, 0.35, 0.8]] }, { pts: [[-0.9, 0.2, 1], [-1.2, -0.6], [-1.9, -1.6, 0.85], [-2.9, -2.4, 0.5], [-3.7, -2.6, 0.25], [-4.1, -2.4, 0.1]] }], exit: null },
};
T.kaf = { // a long stroke leaning up to the left over a flat base
  ini: { s: [{ pts: [[-1.9, 6.2, 0.15], [-1.55, 5.7, 0.8], [-0.6, 3.0], [0.15, 0.6, 1, 1], [-0.5, 0.05], [-1.9, 0.0]] }], exit: -1.9 },
  med: { s: [{ pts: [[0, 0], [-0.6, 0]] }, { pts: [[-2.4, 6.2, 0.15], [-2.05, 5.7, 0.8], [-1.1, 3.0], [-0.4, 0.6, 1, 1], [-1.0, 0.05], [-2.4, 0.0]] }], exit: -2.4 },
  fin: { s: [{ pts: [[0, 0], [-0.4, 0]] }, { pts: [[-2.2, 6.2, 0.15], [-1.85, 5.7, 0.8], [-0.9, 3.0], [-0.25, 0.6, 1, 1], [-1.0, 0.0], [-3.0, 0.0], [-3.6, 0.45, 0.6], [-3.75, 1.2, 0.15]] }], exit: null },
};
T.kaf.iso = T.kaf.fin;
T.ain = {
  ini: { s: [{ pts: [[0.6, 2.9, 0.15], [-0.45, 3.25, 0.8], [-1.35, 2.7], [-1.15, 1.6], [-0.25, 1.0], [-0.4, 0.25], [-1.1, 0.0], [-1.9, 0.0]] }], exit: -1.9 },
  med: { s: [{ pts: [[0, 0], [-0.4, 0.5], [-0.2, 1.9], [-1.2, 2.2], [-1.6, 1.15], [-0.85, 0.4], [-1.25, 0.0], [-2.3, 0.0]] }], exit: -2.3 },
  fin: { s: [{ pts: [[0, 0], [-0.35, 0.45], [-0.15, 1.5], [-0.95, 1.75], [-1.25, 0.95], [-0.75, 0.4]] }, { pts: [[-0.75, 0.4, 1], [-1.4, -0.4], [-1.75, -1.9], [-0.9, -3.2], [0.6, -3.35, 0.5], [1.4, -2.9, 0.15]] }], exit: null },
  iso: { s: [{ pts: [[0.45, 2.3, 0.15], [-0.35, 2.55, 0.8], [-1.0, 2.1], [-0.85, 1.25], [-0.25, 0.85], [-0.7, 0.4]] }, { pts: [[-0.7, 0.4, 1], [-1.35, -0.4], [-1.7, -1.9], [-0.85, -3.2], [0.65, -3.35, 0.5], [1.45, -2.9, 0.15]] }], exit: null },
};
T.fa = { // a round head on the baseline: fa, qaf
  ini: { s: [{ pts: [[0.05, 0.55, 0.7], [-0.05, 1.55], [-0.85, 2.0], [-1.45, 1.35], [-0.95, 0.75], [-0.3, 0.6, 0.8, 1], [-0.45, 0.08], [-1.5, 0.0]] }], exit: -1.5 },
  med: { s: [{ pts: [[0, 0], [-0.3, 0.3], [-0.35, 1.45], [-1.1, 1.95], [-1.7, 1.35], [-1.2, 0.75], [-0.6, 0.6, 0.8, 1], [-0.75, 0.08], [-1.9, 0.0]] }], exit: -1.9 },
  fin: { s: [{ pts: [[0, 0], [-0.3, 0.3], [-0.35, 1.45], [-1.1, 1.95], [-1.7, 1.35], [-1.2, 0.75], [-0.6, 0.6, 0.8, 1], [-0.85, 0.05], [-2.4, 0.0], [-4.0, 0.05], [-4.6, 0.55, 0.45], [-4.7, 1.2, 0.12]] }], exit: null },
};
T.fa.iso = { s: [{ pts: [[0.1, 0.6, 0.7], [0.0, 1.55], [-0.8, 2.0], [-1.4, 1.35], [-0.9, 0.75], [-0.25, 0.6, 0.8, 1], [-0.5, 0.05], [-2.1, 0.0], [-3.7, 0.05], [-4.3, 0.55, 0.45], [-4.4, 1.2, 0.12]] }], exit: null };
T.qaf = { ini: T.fa.ini, med: T.fa.med,
  fin: { s: [{ pts: [[0, 0], [-0.3, 0.3], [-0.35, 1.45], [-1.1, 1.95], [-1.7, 1.35], [-1.2, 0.75], [-0.6, 0.6, 0.8, 1]] }, { pts: [[-0.6, 0.6, 1], [-0.9, -0.5], [-1.6, -1.9], [-2.9, -2.45], [-4.0, -1.9], [-4.4, -0.7], [-4.2, 0.55, 0.4], [-3.9, 1.15, 0.12]] }], exit: null } };
T.qaf.iso = T.qaf.fin;
T.sad = { // a long flat loop with a small tooth at its left end
  ini: { s: [{ pts: [[0.1, 0.45, 0.6], [-0.5, 1.35], [-2.0, 1.65], [-3.05, 1.15], [-2.7, 0.3], [-1.2, 0.05], [-0.4, 0.15, 0.8]] }, { pts: [[-3.2, 1.5, 0.3], [-3.3, 0.9, 0.9], [-3.4, 0.1, 1], [-3.8, 0.0], [-4.4, 0.0]] }], exit: -4.4 },
  med: { s: [{ pts: [[0, 0], [-0.3, 0.3], [-0.9, 1.35], [-2.4, 1.65], [-3.45, 1.15], [-3.1, 0.3], [-1.6, 0.05], [-0.8, 0.15, 0.8]] }, { pts: [[-3.6, 1.5, 0.3], [-3.7, 0.9, 0.9], [-3.82, 0.12, 1], [-4.15, 0.0], [-4.5, 0.0]] }], exit: -4.5 },
  fin: { s: [{ pts: [[0, 0], [-0.3, 0.3], [-0.9, 1.35], [-2.4, 1.65], [-3.45, 1.15], [-3.1, 0.3], [-1.6, 0.05], [-0.8, 0.15, 0.8]] }, { pts: [[-3.6, 1.5, 0.3], [-3.7, 0.9, 0.9], [-3.85, -0.3], [-4.4, -1.6], [-5.6, -2.15], [-6.7, -1.6], [-7.1, -0.5], [-6.9, 0.6, 0.4], [-6.6, 1.2, 0.12]] }], exit: null },
};
T.sad.iso = { s: [{ pts: [[0.1, 0.45, 0.6], [-0.5, 1.35], [-2.0, 1.65], [-3.05, 1.15], [-2.7, 0.3], [-1.2, 0.05], [-0.4, 0.15, 0.8]] }, { pts: [[-3.2, 1.5, 0.3], [-3.3, 0.9, 0.9], [-3.45, -0.3], [-4.0, -1.6], [-5.2, -2.15], [-6.3, -1.6], [-6.7, -0.5], [-6.5, 0.6, 0.4], [-6.2, 1.2, 0.12]] }], exit: null };
T.ta = { // tah: the flat loop with a tall stem rising from it
  ini: { s: [{ pts: [[0.1, 0.45, 0.6], [-0.5, 1.35], [-2.0, 1.6], [-2.8, 1.05], [-2.45, 0.25], [-1.1, 0.05], [-0.4, 0.15, 0.8]] }, { pts: [[-2.4, 0.05], [-3.4, 0.0]] }, { ang: 38, pts: [[-0.9, 8.6, 0.2], [-1.3, 8.3, 0.8], [-1.5, 7.6], [-1.5, 4.0], [-1.5, 1.6, 0.9]] }], exit: -3.4 },
  med: { s: [{ pts: [[0, 0], [-0.3, 0.3], [-0.9, 1.35], [-2.4, 1.6], [-3.2, 1.05], [-2.85, 0.25], [-1.5, 0.05], [-0.8, 0.15, 0.8]] }, { pts: [[-2.8, 0.05], [-3.8, 0.0]] }, { ang: 38, pts: [[-1.3, 8.6, 0.2], [-1.7, 8.3, 0.8], [-1.9, 7.6], [-1.9, 4.0], [-1.9, 1.6, 0.9]] }], exit: -3.8 },
};
T.ta.fin = { s: T.ta.med.s.slice(0, 1).concat([T.ta.med.s[2]]), exit: null }; T.ta.iso = { s: T.ta.ini.s.slice(0, 1).concat([T.ta.ini.s[2]]), exit: null };
T.ya = { // final ya returns under the word to the right
  fin: { s: [{ pts: [[0, 0], [-0.65, -0.06], [-1.25, -0.42], [-1.55, -1.15], [-1.25, -1.9], [-0.15, -2.42], [1.6, -2.48], [2.85, -2.05, 0.45], [3.35, -1.4, 0.15]] }], exit: null },
  iso: { s: [{ pts: [[0.6, 1.25, 0.3], [-0.2, 1.3], [-0.9, 0.75], [-0.75, 0.05], [-1.25, -0.85], [-1.1, -1.85], [0.4, -2.4], [2.3, -2.15], [3.2, -1.55, 0.3], [3.45, -1.0, 0.1]] }], exit: null },
};
T.lamalif = { // lam and alif crossing at the foot
  iso: { s: [{ ang: 38, pts: [[1.2, 9.4, 0.2], [0.85, 8.95, 0.8], [0.6, 8.2], [0.35, 4.6], [-0.05, 1.3], [-0.6, 0.15, 0.9], [-1.3, 0.25, 0.7]] }, { ang: 38, pts: [[-1.35, 0.15, 0.5], [-1.55, 3.0, 0.9], [-2.0, 6.4], [-2.45, 8.8, 0.5], [-2.6, 9.4, 0.15]] }], exit: null },
  fin: { s: [{ pts: [[0, 0], [-0.4, 0.4], [-0.7, 1.4, 0.8]] }, { ang: 38, pts: [[0.2, 9.4, 0.2], [-0.15, 8.95, 0.8], [-0.4, 8.2], [-0.65, 4.6], [-1.05, 1.3], [-1.6, 0.15, 0.9], [-2.3, 0.25, 0.7]] }, { ang: 38, pts: [[-2.35, 0.15, 0.5], [-2.55, 3.0, 0.9], [-3.0, 6.4], [-3.45, 8.8, 0.5], [-3.6, 9.4, 0.15]] }], exit: null },
};
// letters → family, dots
const FAM = { 'ا': 'alif', 'أ': 'alif', 'إ': 'alif', 'آ': 'alif', 'ٱ': 'alif', 'ل': 'lam', 'ب': 'tooth', 'ت': 'tooth', 'ث': 'tooth', 'ي': 'tooth', 'ى': 'tooth', 'ئ': 'tooth', 'س': 'sin', 'ش': 'sin', 'م': 'mim', 'ه': 'ha', 'ة': 'ha', 'ر': 'ra', 'ز': 'ra', 'ح': 'hah', 'ج': 'hah', 'خ': 'hah', 'ن': 'nun', 'د': 'dal', 'ذ': 'dal', 'و': 'waw', 'ؤ': 'waw', 'ك': 'kaf', 'ع': 'ain', 'غ': 'ain', 'ف': 'fa', 'ق': 'qaf', 'ص': 'sad', 'ض': 'sad', 'ط': 'ta', 'ظ': 'ta', 'ﻻ': 'lamalif' };
// final and isolated ya, nun use their own families
const FORM_FAM = { 'ن|ini': 'tooth', 'ن|med': 'tooth', 'ي|fin': 'ya', 'ي|iso': 'ya', 'ى|fin': 'ya', 'ى|iso': 'ya', 'ئ|fin': 'ya', 'ئ|iso': 'ya' };
const NONJOIN = new Set([...'اأإآٱدذرزوؤةﻻ']);
const DOTS = { 'ف': [[1, 1]], 'ق': [[1, 2]], 'ض': [[1, 1]], 'ظ': [[1, 1]], 'غ': [[1, 1]], 'ب': [[-1, 1]], 'ت': [[1, 2]], 'ث': [[1, 3]], 'ن': [[1, 1]], 'ي': [[-1, 2]], 'ش': [[1, 3]], 'ج': [[-1, 1]], 'خ': [[1, 1]], 'ز': [[1, 1]], 'ذ': [[1, 1]], 'ة': [[1, 2]] };
// joining forms
function forms(word) {
  const cs = [...word.replace(/ل(?=[اأإآ])./g, 'ﻻ')], out = [];
  for (let i = 0; i < cs.length; i++) {
    const prevJ = i > 0 && !NONJOIN.has(cs[i - 1]) && FAM[cs[i - 1]], nextJ = i < cs.length - 1 && !NONJOIN.has(cs[i]) && FAM[cs[i + 1]];
    out.push({ c: cs[i], form: prevJ && nextJ ? 'med' : prevJ ? 'fin' : nextJ ? 'ini' : 'iso' });
  }
  return out;
}
let BODY = 1.25; const gcache = new Map();
const scaleG = g => ({ dotX: g.dotX == null ? null : g.dotX * BODY, exit: g.exit == null ? null : g.exit * BODY, s: g.s.map(st => ({ ...st, pts: st.pts.map(([x, y, w, c]) => [x * BODY, y * BODY, w, c]) })) });
function glyphFor(c, form) {
  const k = c + form + BODY + OPT.heh; if (!gcache.has(k)) { const g = glyphRaw(c, form); gcache.set(k, g && !['alif', 'lam', 'lamalif'].includes(FAM[c]) ? scaleG(g) : g); } return gcache.get(k);
}
function glyphRaw(c, form) {
  const f = T[FORM_FAM[c + '|' + form] || FAM[c]]; if (!f) return null;
  return f[form] || f[form === 'fin' ? 'iso' : form === 'med' ? 'ini' : form === 'ini' ? 'med' : 'fin'] || f.iso || f.ini || f.fin || f.med;
}
// ---- curves ----
function sampleStroke(pts, per = 14) {
  // Catmull-Rom through the points; a point with corner = 1 breaks the curve into separate smooth pieces
  const pieces = []; let cur = [pts[0]];
  for (let i = 1; i < pts.length; i++) { cur.push(pts[i]); if (pts[i][3] && i < pts.length - 1) { pieces.push(cur); cur = [pts[i]]; } }
  pieces.push(cur);
  const out = [];
  pieces.forEach((P, pi) => {
    const n = P.length; if (n === 1) { out.push({ x: P[0][0], y: P[0][1], w: P[0][2] ?? 1 }); return; }
    for (let i = 0; i < n - 1; i++) {
      const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(n - 1, i + 2)];
      for (let k = (i === 0 && pi > 0) ? 1 : 0; k < per; k++) {
        const t = k / per, t2 = t * t, t3 = t2 * t;
        const cr = (a, b, c, d) => { const m1 = CR_T * (c - a), m2 = CR_T * (d - b); return (2 * t3 - 3 * t2 + 1) * b + (t3 - 2 * t2 + t) * m1 + (-2 * t3 + 3 * t2) * c + (t3 - t2) * m2; };
        out.push({ x: cr(p0[0], p1[0], p2[0], p3[0]), y: cr(p0[1], p1[1], p2[1], p3[1]), w: (p1[2] ?? 1) + ((p2[2] ?? 1) - (p1[2] ?? 1)) * t });
      }
    }
    const L = P[n - 1]; out.push({ x: L[0], y: L[1], w: L[2] ?? 1 });
  });
  return out;
}
// ---- the nib ----
// The nib is a line segment of width `nib` at angle `ang` (degrees, rising to the right). Dragging it along the path
// sweeps a quadrilateral between each pair of samples; their union is the stroke.
function nibQuads(samples, nib, angDeg, X, Y) {
  const a = angDeg * Math.PI / 180, out = [];
  for (let i = 0; i + 1 < samples.length; i++) {
    const p = samples[i], q = samples[i + 1], wp = p.w, wq = q.w;
    const ap = a + (p.rot || 0), aq = a + (q.rot || 0), hpx = Math.cos(ap) * nib / 2, hpy = Math.sin(ap) * nib / 2, hqx = Math.cos(aq) * nib / 2, hqy = Math.sin(aq) * nib / 2;
    let quad = [[p.x + hpx * wp, p.y + hpy * wp], [q.x + hqx * wq, q.y + hqy * wq], [q.x - hqx * wq, q.y - hqy * wq], [p.x - hpx * wp, p.y - hpy * wp]];
    let ar = 0; for (let k = 0; k < 4; k++) { const [x1, y1] = quad[k], [x2, y2] = quad[(k + 1) % 4]; ar += x1 * y2 - x2 * y1; }
    if (ar < 0) quad = quad.reverse();
    out.push('M' + quad.map(([x, y]) => X(x).toFixed(1) + ' ' + Y(y).toFixed(1)).join('L') + 'Z');
    if (NIB_FLOOR > 0) { // a second, thin pass perpendicular to the stroke so it never gets thinner than the floor
      const dx = q.x - p.x, dy = q.y - p.y, l = Math.hypot(dx, dy) || 1, fx = -dy / l * nib * NIB_FLOOR / 2, fy = dx / l * nib * NIB_FLOOR / 2;
      let q2 = [[p.x + fx * wp, p.y + fy * wp], [q.x + fx * wq, q.y + fy * wq], [q.x - fx * wq, q.y - fy * wq], [p.x - fx * wp, p.y - fy * wp]], a2 = 0;
      for (let k = 0; k < 4; k++) { const [x1, y1] = q2[k], [x2, y2] = q2[(k + 1) % 4]; a2 += x1 * y2 - x2 * y1; } if (a2 < 0) q2 = q2.reverse();
      out.push('M' + q2.map(([x, y]) => X(x).toFixed(1) + ' ' + Y(y).toFixed(1)).join('L') + 'Z'); }
  }
  return out;
}
let NIB_FLOOR = 0;
function nibPath(samples, nib, angDeg, X, Y) { return nibQuads(samples, nib, angDeg, X, Y).join(''); }
function nibPathOld(samples, nib, angDeg, X, Y) {
  const a = angDeg * Math.PI / 180, hx = Math.cos(a) * nib / 2, hy = Math.sin(a) * nib / 2;
  let d = '';
  for (let i = 0; i + 1 < samples.length; i++) {
    const p = samples[i], q = samples[i + 1], wp = p.w, wq = q.w;
    let quad = [[p.x + hx * wp, p.y + hy * wp], [q.x + hx * wq, q.y + hy * wq], [q.x - hx * wq, q.y - hy * wq], [p.x - hx * wp, p.y - hy * wp]];
    let ar = 0; for (let k = 0; k < 4; k++) { const [x1, y1] = quad[k], [x2, y2] = quad[(k + 1) % 4]; ar += x1 * y2 - x2 * y1; }
    if (ar < 0) quad = quad.reverse();
    d += 'M' + quad.map(([x, y]) => X(x).toFixed(1) + ' ' + Y(y).toFixed(1)).join('L') + 'Z';
  }
  return d;
}
// the rhombic dot: one short stroke at right angles to the nib
function dotPath(x, y, nib, angDeg, X, Y, rot = 0) {
  const a = (angDeg + 90) * Math.PI / 180 + rot, L = nib * 0.95, s = [{ x: x - Math.cos(a) * L / 2, y: y - Math.sin(a) * L / 2, w: 1, rot }, { x: x + Math.cos(a) * L / 2, y: y + Math.sin(a) * L / 2, w: 1, rot }];
  return nibPath(s, nib, angDeg, X, Y);
}
// ---- set a line of text ----
function setLine(text, o = {}) {
  const { nib = 1.3, ang = 70, kashida = 0, gap = 0.9, wordGap = 1.6 } = o;
  const words = text.trim().split(/\s+/), placed = []; let x = 0, y = 0;
  words.forEach((w, wi) => {
    if (wi) x -= wordGap;
    const fs = forms(w); let joined = false; y = 0;
    fs.forEach((f, i) => {
      let g = glyphFor(f.c, f.form); if (!g) { x -= 2; joined = false; return; }
      if (o.longFinal && i === fs.length - 1 && FAM[f.c] === 'tooth' && f.form === 'fin') { const gl = scaleG(T.tooth.finLong); g = { ...gl, dotX: gl.dotX * o.longFinal, s: gl.s.map(st => ({ ...st, pts: st.pts.map(([x2, y2, w, c]) => [x2 * o.longFinal, y2, w, c]) })) }; }
      const connects = f.form === 'med' || f.form === 'fin';
      // a new group starts after a gap: put the glyph's right edge at the cursor
      let ox;
      if (connects && joined) ox = x;
      else { y = 0; const xs = g.s.flatMap(s => s.pts.map(p => p[0])); const right = Math.max(...xs) + nib * 0.5; ox = x - (i === 0 && wi >= 0 && !joined && x !== 0 ? 0 : 0) - right - (x !== 0 && !(connects && joined) ? gap * 0 : 0); }
      placed.push({ g, ox, oy: y, c: f.c, form: f.form, li: i, wi });
      if (g.exit != null) {
        x = ox + g.exit; joined = true;
        const stk = o.stacks && o.stacks[i + 1];
        // a stacked join: the next letter is written below and to the right, under this one, and the pen comes down to it
        if (stk && i < fs.length - 1) { placed.push({ conn: true, from: [x, y], to: [x + stk.dx, y + stk.dy] }); x += stk.dx; y += stk.dy; }
        else if (i < fs.length - 1) { let kl = o.kashMap && o.kashMap[i + 1] != null ? o.kashMap[i + 1] : kashida;
          // two loop letters joined need a short stretch of baseline between them, or their loops run together
          const LOOPY = ['fa', 'qaf', 'sad', 'mim', 'ain', 'ha', 'ta']; if (LOOPY.includes(FAM[f.c]) && LOOPY.includes(FAM[fs[i + 1].c])) kl = Math.max(kl, LOOP_GAP * BODY); if (kl > 0) { placed.push({ kash: true, ox: x, oy: y, len: kl }); x -= kl; } } // one join can be elongated on its own
      }
      else { const xs = g.s.flatMap(s => s.pts.map(p => p[0])); x = ox + Math.min(...xs) - nib * 0.5 - gap; joined = false; }
    });
  });
  return placed;
}
function buildStrokes(text, o = {}) {
  const { nib = 1.3, ang = 70 } = o;
  const placed = setLine(text, o);
  // bounds
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  const strokes = [], dots = [];
  // joins: the stroke leaving one letter and the stroke entering the next become one continuous stroke, so the pen
  // never lifts and the curve runs smoothly through the join
  const raws = []; let open = null;
  const near = (a, b2) => Math.abs(a[0] - b2[0]) < 0.06 && Math.abs(a[1] - b2[1]) < 0.06;
  let lastGlyph = -1; placed.forEach((p, pi) => { if (p.g) lastGlyph = pi; });
  placed.forEach((p, pi) => {
    if (p.kash) { const k = [[p.ox - p.len * 0.5, p.oy - (o.sag ?? 0.3) * Math.min(1, p.len / 3), 1], [p.ox - p.len, p.oy, 1]]; if (open) open.pts.push(...k); else { open = { ang, pts: [[p.ox, p.oy, 1], ...k] }; raws.push(open); } return; }
    if (p.conn) { const [ax, ay] = p.from, [bx, by] = p.to, k = bx < ax - 0.5 ? [0.2, 0.4, 0.6, 0.8, 1].map(t => [ax + (bx - ax) * t, ay + (by - ay) * (3 * t * t - 2 * t * t * t), 1]) : [[ax - 0.45, ay - 0.35, 1], [ax + (bx - ax) * 0.45 - 0.2, ay + (by - ay) * 0.55, 0.9], [bx - 0.15, by + 0.25, 1], [bx, by, 1]]; if (open) open.pts.push(...k); else { open = { ang, pts: [[ax, ay, 1], ...k] }; raws.push(open); } return; }
    const oy = p.oy || 0, exitPt = p.g.exit != null ? [p.ox + p.g.exit, oy] : null, connects = p.form === 'med' || p.form === 'fin';
    let nextOpen = null;
    p.g.s.forEach((st, si) => {
      const tl = o.tail && pi === lastGlyph && ['nun', 'ra', 'ya', 'waw', 'mim', 'sad', 'qaf', 'ain', 'lam', 'fa', 'tooth'].includes(FORM_FAM[p.c + '|' + p.form] || FAM[p.c]) ? o.tail : null;
      const tq = q => (tl ? [q[0] * (q[0] < -0.5 ? tl.sx : 1), q[1] < 0 ? q[1] * tl.sy : q[1], q[2], q[3]] : q);
      let pts = st.pts.map(q0 => { const q = tq(q0); return [q[0] + p.ox, q[1] + oy, q[2] ?? 1, q[3]]; }); if (st.lean) pts = lean(st.pts.map(q => [q[0], q[1], q[2] ?? 1, q[3]])).map(q => [q[0] + p.ox, q[1] + oy, q[2], q[3]]);
      let target;
      if (si === 0 && connects && open && near(pts[0], [p.ox, oy])) { open.pts.push(...pts.slice(1)); target = open; }
      else { target = { ang: st.ang ?? ang, pts }; raws.push(target); }
      if (exitPt && near(target.pts[target.pts.length - 1], exitPt)) nextOpen = target;
    });
    open = nextOpen;
  });
  raws.forEach(r => strokes.push({ ang: r.ang, s: sampleStroke(r.pts), raw: r.pts.map(q => [q[0], q[1]]) }));
  // the name of God: shadda and a small upright alif above the second lam
  if (!o.noAuto && (o.allah || /^ٱ?[اأ]?لله$/.test(text.trim()) || /(^|\s)الله(\s|$)/.test(text))) placed.forEach((p, i) => {
    const q = placed[i + 1], r = placed[i + 2];
    if (p.c === 'ل' && p.form === 'ini' && q && q.c === 'ل' && r && r.c === 'ه') {
      const x = q.ox - 0.9, y = 6.2 + (q.oy || 0), sm = 0.55, sh = [[0.95, 0.15], [0.65, 0.65], [0.35, 0.05, 1, 1], [0.05, 0.6], [-0.3, 0.05, 1, 1], [-0.6, 0.6], [-0.9, 0.3, 0.6]];
      strokes.push({ ang, nib: nib * 0.5, s: sampleStroke(sh.map(([a2, b2, w, c]) => [x + a2 * sm * 2, y + b2 * sm * 2, w ?? 1, c])) });
      strokes.push({ ang: 38, nib: nib * 0.55, s: sampleStroke([[x + 0.35, y + 3.0, 0.3], [x + 0.2, y + 2.6, 0.9], [x + 0.05, y + 1.5, 0.8]]) });
    }
  });
  const dotGroups = [];
  placed.forEach(p => {
    if (p.kash || p.conn) return; const dd = DOTS[p.c], oy = p.oy || 0; if (dd) dd.forEach(([side, n]) => {
      // dots centred over or under the letter body
      const xs = p.g.s.flatMap(s => s.pts.map(q => q[0])), cx = p.ox + (p.g.dotX != null ? p.g.dotX : p.g.exit != null ? p.g.exit / 2 : (Math.min(...xs) + Math.max(...xs)) / 2);
      const ys = p.g.s.flatMap(s => s.pts.map(q => q[1])), top = Math.max(...ys), bot = Math.min(...ys);
      const by = oy + (side > 0 ? Math.max(top, 1.6) + nib * 1.3 : Math.min(bot, 0) - nib * 1.5);
      for (let k = 0; k < n; k++) { const dx = (k - (n - 1) / 2) * nib * 1.15, dy = n === 3 && k === 1 ? nib * 1.0 * side : 0; dots.push([cx + dx, by + dy]); }
      // the same dots as a group, so a later step can move and regroup them
      dotGroups.push({ x: cx, y: by + (n === 3 ? nib * 0.5 * side : 0), n, side, li: p.li, wi: p.wi, x0: p.ox + Math.min(...xs), x1: p.ox + Math.max(...xs), top: oy + top, bot: oy + bot });
    });
  });
  return { strokes, dots, placed, dotGroups };
}
// draw strokes and dots (in nib units) into an SVG
function drawSVG(strokes, dots, o = {}) {
  const { nib = 1.3, ang = 70, U = 14, ink = '#1b1b1b', paper = '#f4efe3', skeleton = false, pad = 3 } = o;
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  strokes.forEach(s => s.s.forEach(q => { x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); }));
  dots.forEach(([x, y]) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); });
  x0 -= pad; x1 += pad; y0 -= pad; y1 += pad;
  const W = (x1 - x0) * U, H = (y1 - y0) * U, X = x => (x - x0) * U, Y = y => (y1 - y) * U;
  let body = '';
  strokes.forEach(s => { body += `<path d="${nibPath(s.s, s.nib || nib, s.ang, X, Y)}"/>`; });
  dots.forEach(([x, y]) => { body += `<path d="${dotPath(x, y, nib, ang, X, Y)}"/>`; });
  let skel = '';
  if (skeleton) strokes.forEach(s => { skel += `<path d="M${s.s.map(q => X(q.x).toFixed(1) + ' ' + Y(q.y).toFixed(1)).join('L')}" fill="none" stroke="#d33" stroke-width="1"/>`; if (s.raw) s.raw.forEach(([x, y]) => { skel += `<circle cx="${X(x).toFixed(1)}" cy="${Y(y).toFixed(1)}" r="2.2" fill="#d33"/>`; }); });
  const base = `<line x1="0" x2="${W.toFixed(1)}" y1="${Y(0).toFixed(1)}" y2="${Y(0).toFixed(1)}" stroke="#c9bfa8" stroke-width="1" stroke-dasharray="4 4"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W.toFixed(0)} ${H.toFixed(0)}" width="${W.toFixed(0)}" height="${H.toFixed(0)}"><rect width="100%" height="100%" fill="${paper}"/>${o.baseline ? base : ''}<g fill="${ink}" fill-rule="nonzero">${body}</g>${skel}</svg>`;
}
function renderLine(text, o = {}) { const b = buildStrokes(text, o); return drawSVG(b.strokes, b.dots, o); }


