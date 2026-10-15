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



// ================= STACKING (TARKIB) =================
// The phrase is cut into its connected letter groups. Each group is drawn as ink at a few stretch lengths and turned
// into a small bitmap. A placement search then moves the groups in two dimensions: groups may sit above, below or
// inside one another (on a tail, in a bowl), as long as the right-to-left reading order holds and no ink touches.
// The search pushes towards a compact, balanced block of the chosen proportions.
function splitGroups(text) {
  const out = [];
  text.trim().split(/\s+/).forEach((w, wi) => {
    const allahWord = /^[اأٱ]?لله$/.test(w);
    const cs = [...w.replace(/ل(?=[اأإآ])./g, 'ﻻ')]; let cur = '';
    cs.forEach((c, i) => { cur += c; if (NONJOIN.has(c) || !FAM[c] || i === cs.length - 1) { out.push({ s: cur, word: wi, allah: allahWord && cur.startsWith('ل') }); cur = ''; } });
  });
  return out;
}
const LEVELS = [0, 2, 4];
const STACK_OFFSETS = [{ dx: 0.9, dy: -3.4 }, { dx: 2.1, dy: -3.4 }, { dx: 1.2, dy: -4.6 }, { dx: 2.4, dy: -4.6 }];
const DEEP_OFFSETS = [{ dx: 0.6, dy: -3.6 }, { dx: 1.6, dy: -4.8 }, { dx: 0.4, dy: -6.0 }, { dx: 1.8, dy: -6.2 }];
// joins where the next letter may be written underneath the one before it
function stackable(s) {
  const fs = forms(s), out = [];
  for (let i = 1; i < fs.length; i++) { const f = fs[i], fam = FAM[f.c]; if ((f.form === 'med' || f.form === 'fin') && (fam === 'hah' || fam === 'mim') && fs[i - 1].form !== 'iso') out.push(i); }
  return out;
}
function groupVariants(g, o, K) {
  const out0 = [];
  if (o.emph && !g.sc) { const cs = [...g.s], fs = forms(g.s), j = cs.length - 1;
    if (j >= 1 && cs[j] === o.emph && fs[j].form === 'fin') {
      [{ dx: -1.2, dy: -1.6 }, { dx: -2.2, dy: -2.2 }, { dx: -1.6, dy: -2.9 }].forEach(off => [1.0, 1.25].forEach(lf => {
        const st = { [j]: { dx: off.dx * BODY / 1.25, dy: off.dy * BODY / 1.25 } };
        const v = groupShape(g, 0, { ...o, longFinal: lf, margin: 2 }, K, st, j); if (v) { v.cost = -3.2; v.emph = true; v.stacked = true; out0.push(v); } }));
      [1.0, 1.25].forEach(lf => { const flat = groupShape(g, 0, { ...o, longFinal: lf, margin: 2 }, K, null); if (flat) { flat.cost = -1.6; flat.emph = true; out0.push(flat); } }); } }
  const n = [...g.s].length, out = out0, levels = g.sc ? [0, 2] : n > 1 ? (o.levels || LEVELS) : [0], joins = g.sc ? [] : stackable(g.s);
  const tails = o.tails && n >= 1 && !g.sc ? [{ sx: 1.4, sy: 1.3 }, { sx: 1.8, sy: 1.6 }] : [];
  tails.forEach(tl => { const v = groupShape(g, 0, { ...o, tail: tl }, K, null); if (v) { v.cost = 0.4; out.push(v); } });
  if (o.elongate && !g.sc && n > 1) { const fs = forms(g.s); for (let j = 1; j < fs.length; j++) { if (fs[j].form !== 'med' && fs[j].form !== 'fin') continue;
      [6, 9, 13].forEach(L => { const v = groupShape(g, 0, { ...o, kashMap: { [j]: L } }, K, null); if (v) { v.cost = 0.08 * L; v.elong = L; out.push(v); } }); } }
  levels.forEach(L => {
    const v = groupShape(g, L, o, K, null); if (v) { v.cost = 0.3 * L; out.push(v); }
    if (o.stackPull === 0) return;
    const pairOffs = o.deep ? DEEP_OFFSETS : STACK_OFFSETS.slice(0, 2);
    if (joins.length >= 2) for (let a = 0; a < joins.length; a++) for (let c = a + 1; c < joins.length; c++) for (const oa of pairOffs) for (const oc of pairOffs) {
      if (!o.deep && (oa !== pairOffs[0] || oc !== pairOffs[1])) continue;
      const st = { [joins[a]]: { dx: oa.dx * BODY / 1.25, dy: oa.dy * BODY / 1.25 }, [joins[c]]: { dx: oc.dx * BODY / 1.25, dy: oc.dy * BODY / 1.25 } };
      const v3 = groupShape(g, L, o, K, st, joins[c]); if (v3 && groupShapeOk(g, L, o, st, joins[a])) { v3.cost = 0.3 * L - 1.8 * (o.stackPull ?? 1.6); v3.stacked = true; out.push(v3); }
    }
    joins.forEach(j => (o.deep ? STACK_OFFSETS.concat(DEEP_OFFSETS) : STACK_OFFSETS).forEach(off => {
      const v2 = groupShape(g, L, o, K, { [j]: { dx: off.dx * BODY / 1.25, dy: off.dy * BODY / 1.25 } }, j);
      if (v2) { v2.cost = 0.3 * L - (o.stackPull ?? 1.6); v2.stacked = true; out.push(v2); }
    }));
  });
  return out;
}
function groupShapeOk(g, level, o, stacks, sj) { return !!groupShape(g, level, o, 1, stacks, sj, true); }
function groupShape(g, level, o, K, stacks, sj, checkOnly) {
  const b = buildStrokes(g.s, { ...o, kashida: level, allah: g.allah && !(g.marks && g.marks.length), noAuto: !!(g.marks && g.marks.length), gap: 0, wordGap: 0, stacks });
  if (g.sc && g.sc !== 1) { const sc = g.sc, nb = o.nib || 1.3; b.strokes.forEach(s => { s.s = s.s.map(q => ({ x: q.x * sc, y: q.y * sc, w: q.w })); s.nib = (s.nib || nb) * sc; }); b.dots = b.dots.map(([x, y]) => [x * sc, y * sc, sc]); (b.dotGroups || []).forEach(d => { ['x', 'y', 'x0', 'x1', 'top', 'bot'].forEach(f => { d[f] *= sc; }); d.sc = sc; }); b.placed.forEach(p => { if (p.g) { p.ox *= sc; p.oy = (p.oy || 0) * sc; p.sc = sc; } }); }
  if (stacks) { // the letters lifted above must not collide with the ones written beneath
    const nib = o.nib || 1.3, pts = idx => b.placed.filter(p => p.g && (idx ? p.li >= sj : p.li < sj)).flatMap(p => p.g.s.flatMap(st => sampleStroke(st.pts.map(q => [q[0] + p.ox, q[1] + (p.oy || 0), 1, q[3]]), 6)));
    const A = pts(false), B2 = pts(true), cn = b.placed.find(p => p.conn), ends = cn ? [cn.from, cn.to] : [];
    const farFromJoin = q => ends.every(([ex, ey]) => Math.hypot(q.x - ex, q.y - ey) > 1.4);
    for (const a of A) { if (!farFromJoin(a)) continue; for (const c of B2) { if (!farFromJoin(c)) continue; if (Math.hypot(a.x - c.x, a.y - c.y) < nib * 1.15) return null; } }
    if (checkOnly) return true;
  }
  const nib = o.nib || 1.3; let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  b.strokes.forEach(s => s.s.forEach(q => { x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); }));
  b.dots.forEach(([x, y]) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); });
  x0 -= nib; x1 += nib; y0 -= nib; y1 += nib;
  const W = Math.ceil((x1 - x0) * K) + 2, H = Math.ceil((y1 - y0) * K) + 2;
  const X = x => (x - x0) * K + 1, Y = y => (y1 - y) * K + 1;
  // three layers: tall stems (alif, lam, tah strokes running upright), horizontals (any segment within 22° of level), the rest
  const layers = [1, 2, 3].map(() => { const c = document.createElement('canvas'); c.width = W; c.height = H; const x2 = c.getContext('2d'); x2.fillStyle = '#000'; return x2; });
  b.strokes.forEach(s => { const qs = nibQuads(s.s, s.nib || nib, s.ang, X, Y), per = qs.length > s.s.length - 1 ? 2 : 1; qs.forEach((q, qj) => { const qi = Math.floor(qj / per); // a pen segment may be drawn as two shapes (the minimum-thickness pass)
    const p = s.s[qi], p2 = s.s[qi + 1], a = Math.abs(Math.atan2(p2.y - p.y, p2.x - p.x)), horiz = a < 0.38 || a > Math.PI - 0.38, upright = Math.abs(a - Math.PI / 2) < 0.45;
    const layer = s.ang === 38 && upright ? 0 : horiz ? 1 : 2; layers[layer].fill(new Path2D(q)); }); });
  b.dots.forEach(([x, y, s2]) => layers[2].fill(new Path2D(dotPath(x, y, nib * (s2 || 1), o.ang || 70, X, Y))));
  const data = layers.map(l => l.getImageData(0, 0, W, H).data), mask = new Uint8Array(W * H), dil = new Uint8Array(W * H); let ink = 0;
  // type per pixel: 3 other wins over 1 stem, which wins over 2 horizontal
  for (let i = 0; i < W * H; i++) { const st = data[0][i * 4 + 3] > 100, hz = data[1][i * 4 + 3] > 100, ot = data[2][i * 4 + 3] > 100; const t = ot ? 3 : st ? 1 : hz ? 2 : 0; if (t) { mask[i] = t; ink++; } }
  const r = o.margin || 1; // a margin keeps groups from touching (wider round an emphasised letter)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const t = mask[y * W + x]; if (!t) continue; for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const X2 = x + dx, Y2 = y + dy; if (X2 >= 0 && Y2 >= 0 && X2 < W && Y2 < H) { const k2 = Y2 * W + X2; if (dil[k2] !== 3) dil[k2] = dil[k2] ? (t === 3 || dil[k2] === 3 ? 3 : Math.min(dil[k2], t)) : t; } } }
  let sx = 0, sy = 0; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (mask[y * W + x]) { sx += x; sy += y; }
  const cxm = x0 + (sx / Math.max(1, ink) - 1) / K, cym = y1 - (sy / Math.max(1, ink) - 1) / K;
  const hull = []; b.strokes.forEach(s => s.s.forEach((q, i) => { if (i % 4 === 0) hull.push([q.x, q.y]); })); b.dots.forEach(([x, y]) => hull.push([x, y]));
  const stemTops = b.strokes.filter(s => s.ang === 38).map(s => { let t = s.s[0]; s.s.forEach(q => { if (q.y > t.y) t = q; }); return [t.x, t.y]; }); // tops of the tall stems
  const shelves = b.placed.filter(p => p.kash && p.len >= 5).map(p => ({ x0: p.ox - p.len, x1: p.ox, y: p.oy || 0 }));
  { // a great final bowl is a cradle: another word can sit inside its curve
    const last = b.placed.filter(p => p.g).pop(); if (last) { const ps = last.g.s.flatMap(st => st.pts.map(q => [q[0] + last.ox, q[1] + (last.oy || 0)])), ys = ps.map(q => q[1]);
      if (Math.min(...ys) - (last.oy || 0) < -3.2) { const xs = ps.map(q => q[0]); shelves.push({ x0: Math.min(...xs) + 1.2, x1: Math.max(...xs) - 1.2, y: Math.min(...ys) + 1.1, cradle: true }); } } }
  if (o.longFinal) { const last = b.placed.filter(p => p.g).pop(); if (last) { const xs = last.g.s.flatMap(st => st.pts.map(q => q[0] + last.ox)); shelves.push({ x0: Math.min(...xs) + 0.8, x1: Math.max(...xs) - 0.6, y: (last.oy || 0) + 0.3 }); } }
  if (o.tail && o.tail.sx >= 2) { const last = b.placed.filter(p => p.g).pop(); if (last) { const xs = last.g.s.flatMap(st => st.pts.map(q => q[0] * (q[0] < -0.5 ? o.tail.sx : 1) + last.ox)); shelves.push({ x0: Math.min(...xs) + 0.8, x1: Math.max(...xs) - 0.6, y: (last.oy || 0) + 0.3 }); } } // a wide final bowl is a shelf too
  return { b, mask, dil, W, H, x0, x1, y0, y1, ink, level, cx: cxm, cy: cym, hull, shelves, stemTops };
}
function compose(text, o = {}) {
  const { aspect = 1.6, tries = 10, iters = 6000, K = 1.6, seed = 7 } = o;
  const groups = splitGroups(text); if (!groups.length) return [];
  const shapes = groups.map(g => groupVariants(g, o, K));
  const words = []; groups.forEach((g, i) => { (words[g.word] = words[g.word] || []).push(i); });
  const W = words.length, n = groups.length, GAP = 0.5;
  const pairOverlap = (A, ax, ay, B, bx, by) => {
    const dx = Math.round((bx + B.x0 - (ax + A.x0)) * K), dy = Math.round(((ay + A.y1) - (by + B.y1)) * K);
    const xs = Math.max(0, dx), xe = Math.min(A.W, dx + B.W), ys = Math.max(0, dy), ye = Math.min(A.H, dy + B.H); if (xs >= xe || ys >= ye) return 0;
    let c = 0; const cw = o.cross ? 0.12 : 1, mw = o.merge ? 0.25 : 1; for (let y = ys; y < ye; y++) { const ra = y * A.W, rb = (y - dy) * B.W - dx; for (let x = xs; x < xe; x++) { const ta = A.dil[ra + x], tb = B.mask[rb + x]; if (ta && tb) c += (ta === 1 && tb === 2) || (ta === 2 && tb === 1) ? cw : ta === 1 && tb === 1 ? mw : 1; } } // a stem may pass through a horizontal
    return c;
  };
  const results = [];
  for (let t = 0; t < tries; t++) {
    let sd = seed + t * 7919; const R = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    const lv = groups.map(() => 0), wp = words.map(() => ({ x: 0, y: 0 }));
    // groups inside a word sit one after another on the word's baseline; only their stretch changes
    const gpos = new Array(n);
    const layoutWord = w => { let cur = wp[w].x; words[w].forEach((gi, k) => { const S = shapes[gi][lv[gi]]; const x = k === 0 ? cur - S.x1 : cur - S.x1; gpos[gi] = { x, y: wp[w].y }; cur = x + S.x0 - GAP; }); };
    // start: words in a line
    let cur = 0; words.forEach((ws, w) => { wp[w].x = cur; wp[w].y = 0; layoutWord(w); const last = ws[ws.length - 1]; cur = gpos[last].x + shapes[last][lv[last]].x0 - 1.2; });
    const wbox = w => { let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; words[w].forEach(gi => { const S = shapes[gi][lv[gi]], p = gpos[gi]; x0 = Math.min(x0, p.x + S.x0); x1 = Math.max(x1, p.x + S.x1); y0 = Math.min(y0, p.y + S.y0); y1 = Math.max(y1, p.y + S.y1); }); return { x0, x1, y0, y1 }; };
    const ov = Array.from({ length: W }, () => new Float64Array(W));
    const wordOverlap = (a, b) => { let c = 0; words[a].forEach(i => words[b].forEach(j => { const A = shapes[i][lv[i]], B = shapes[j][lv[j]]; c += pairOverlap(A, gpos[i].x, gpos[i].y, B, gpos[j].x, gpos[j].y) + pairOverlap(B, gpos[j].x, gpos[j].y, A, gpos[i].x, gpos[i].y); })); return c; };
    const recompute = a => { for (let b = 0; b < W; b++) if (b !== a) ov[a][b] = ov[b][a] = wordOverlap(a, b); };
    for (let a = 0; a < W; a++) recompute(a);
    const energy = () => {
      let o2 = 0; for (let a = 0; a < W; a++) for (let b = a + 1; b < W; b++) o2 += ov[a][b];
      // reading order: each word starts to the left of where the previous one starts
      let order = 0; const bx = words.map((_, w) => wbox(w));
      for (let w = 0; w + 1 < W; w++) {
        const v = bx[w + 1].x1 - (bx[w].x1 - 1.5); if (v > 0) order += v * v; // each word starts clearly to the left of the previous one's start
      }
      // optionally, where two words overlap side to side, the one read first sits on top
      if (o.topFirst) for (let w = 0; w + 1 < W; w++) { const ox2 = Math.min(bx[w].x1, bx[w + 1].x1) - Math.max(bx[w].x0, bx[w + 1].x0), wm = Math.min(bx[w].x1 - bx[w].x0, bx[w + 1].x1 - bx[w + 1].x0);
        if (ox2 > 0.35 * wm) { const dv = (bx[w + 1].y0 + bx[w + 1].y1) / 2 - (bx[w].y0 + bx[w].y1) / 2; if (dv > -1) order += 0.6 * (dv + 1) ** 2; } }
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, ink = 0, lvlc = 0, snap = 0;
      bx.forEach(b => { x0 = Math.min(x0, b.x0); x1 = Math.max(x1, b.x1); y0 = Math.min(y0, b.y0); y1 = Math.max(y1, b.y1); });
      groups.forEach((g, i) => { ink += shapes[i][lv[i]].ink; lvlc += shapes[i][lv[i]].cost; if (i > 0 && shapes[i][lv[i]].elong && shapes[i - 1][lv[i - 1]].elong) lvlc += 2.5; });
      wp.forEach(p => { const m = Math.round(p.y / 1.5) * 1.5; snap += (p.y - m) ** 2; });
      const bw = x1 - x0, bh = y1 - y0, fill = ink / (bw * bh * K * K);
      // an elongated stroke earns its length when another word sits on it
      let shelf = 0; if (o.elongate) groups.forEach((g, i) => { const S = shapes[i][lv[i]]; (S.shelves || []).forEach(sh => {
        let cov = 0, tot = 0; for (let x = sh.x0 + 0.5; x < sh.x1 - 0.3; x += 0.6) { tot++; const gx = gpos[i].x + x, gy = gpos[i].y + sh.y;
          for (let j = 0; j < n && cov < tot; j++) { if (groups[j].word === g.word) continue; const T = shapes[j][lv[j]], lx = Math.round((gx - gpos[j].x - T.x0) * K) + 1;
            if (lx < 0 || lx >= T.W) continue; for (let d = 1.0; d <= 5.5; d += 0.75) { const ly = Math.round((gpos[j].y + T.y1 - (gy + d)) * K) + 1; if (ly >= 0 && ly < T.H && T.mask[ly * T.W + lx]) { cov++; break; } } } }
        shelf += tot ? cov / tot : 0; }); });
      return 3 * o2 + 25 * order + 60 * Math.max(0, 0.5 - fill) + 8 * Math.abs(Math.log(bw / bh / aspect)) + lvlc + 0.1 * snap - 7 * shelf;
    };
    let E = energy(), T = 20;
    for (let it = 0; it < iters; it++) {
      const mv = R(); let undo;
      if (mv < 0.65) { const w = Math.floor(R() * W), old = { ...wp[w] }; const s = T > 2 ? 1 : 0.35; wp[w].x += (R() - 0.5) * 8 * s; wp[w].y += (R() - 0.5) * 8 * s; layoutWord(w); recompute(w); undo = () => { wp[w] = old; layoutWord(w); recompute(w); }; }
      else if (mv < 0.9) { const gi = Math.floor(R() * n), w = groups[gi].word, old = lv[gi]; lv[gi] = Math.floor(R() * shapes[gi].length); layoutWord(w); recompute(w); undo = () => { lv[gi] = old; layoutWord(w); recompute(w); }; }
      else if (o.elongate && mv > 0.95) { // put a word on someone's shelf
        const withShelf = groups.map((g, i) => i).filter(i => (shapes[i][lv[i]].shelves || []).length); if (!withShelf.length) { const E2x = 0; }
        const gi = withShelf.length ? withShelf[Math.floor(R() * withShelf.length)] : -1;
        if (gi >= 0) { const sh = shapes[gi][lv[gi]].shelves[0], others = words.map((_, w) => w).filter(w => w !== groups[gi].word); const w = others[Math.floor(R() * others.length)];
          if (w != null) { const old = { ...wp[w] }; const bxw = wbox(w), sx = gpos[gi].x + (sh.x0 + sh.x1) / 2, sy = gpos[gi].y + sh.y;
            wp[w].x += sx - (bxw.x0 + bxw.x1) / 2; wp[w].y += sy + 1.0 - bxw.y0 + (wp[w].y - wp[w].y); layoutWord(w); recompute(w); undo = () => { wp[w] = old; layoutWord(w); recompute(w); }; }
          else undo = () => {}; } else undo = () => {};
      }
      else { const w = Math.floor(R() * W), old = { ...wp[w] }; wp[w].y = (R() - 0.5) * 26; wp[w].x += (R() - 0.5) * 12; layoutWord(w); recompute(w); undo = () => { wp[w] = old; layoutWord(w); recompute(w); }; }
      const E2 = energy();
      if (E2 <= E || R() < Math.exp((E - E2) / T)) E = E2; else undo();
      T = Math.max(0.03, T * Math.pow(0.03 / 20, 1 / iters));
    }
    let o2 = 0; for (let a = 0; a < W; a++) for (let b = a + 1; b < W; b++) o2 += ov[a][b];
    results.push({ E, overlap: o2, st: gpos.map(p => ({ ...p })), shapes: groups.map((g, i) => shapes[i][lv[i]]) });
  }
  results.sort((a, b) => a.E - b.E);
  return results;
}
function renderComposition(r, o = {}) {
  const strokes = [], dots = [];
  r.shapes.forEach((S, i) => { const { x, y } = r.st[i];
    S.b.strokes.forEach(s => strokes.push({ ...s, s: s.s.map(q => ({ x: q.x + x, y: q.y + y, w: q.w })) }));
    S.b.dots.forEach(([a, b]) => dots.push([a + x, b + y])); });
  return drawSVG(strokes, dots, o);
}

// ================= VOWEL MARKS =================
// Marks come only from the text itself: each mark belongs to the letter it follows and is placed in free space near it.
const HARAKAT = { 'َ': 'fatha', 'ِ': 'kasra', 'ُ': 'damma', 'ّ': 'shadda', 'ْ': 'sukun', 'ً': 'fathatan', 'ٍ': 'kasratan', 'ٌ': 'dammatan', 'ٰ': 'alifk' };
const BELOW = new Set(['kasra', 'kasratan', 'hamzaB']);
const SEATS = { 'أ': ['ا', 'hamza'], 'إ': ['ا', 'hamzaB'], 'ؤ': ['و', 'hamza'], 'ئ': ['ى', 'hamza'], 'آ': ['ا', 'madda'] };
function parseVowels(text) {
  // returns the bare text and, for each word, a list of marks keyed by letter position (after the lam-alif ligature)
  const words = text.trim().split(/\s+/), bare = [], marks = [];
  words.forEach(w => {
    let base = '', ms = [], li = -1, prev = '';
    for (let ch of w) { if (HARAKAT[ch]) { ms.push({ li, m: HARAKAT[ch] }); continue; } // mark on the last letter
      let seat = null; if (SEATS[ch]) { seat = SEATS[ch][1]; ch = SEATS[ch][0]; }
      if (seat) { const add = () => ms.push({ li: li + (ch === 'ا' && prev === 'ل' ? 0 : 1), m: seat }); add(); }
      if (ch === 'ا' && prev === 'ل') { prev = ch; base += ch; continue; } // alif joins the lam in the ligature: same position
      li++; base += ch; prev = ch; }
    bare.push(base); marks.push(ms);
  });
  return { bare: bare.join(' '), marks };
}
// mark shapes as pen strokes, centred, in nib units (drawn with a finer nib)
const MARK_SHAPES = {
  fatha: [[[0.75, 0.4, 0.3], [0.2, 0.1, 1], [-0.75, -0.4, 0.4]]],
  kasra: [[[0.75, 0.4, 0.3], [0.2, 0.1, 1], [-0.75, -0.4, 0.4]]],
  damma: [[[0.15, 0.25, 0.6], [-0.15, 0.75], [-0.6, 0.5], [-0.45, 0.05], [0.05, 0.05], [0.0, -0.45, 0.8], [-0.55, -0.85, 0.2]]],
  shadda: [[[1.0, 0.15, 0.4], [0.7, 0.6], [0.4, 0.05, 1, 1], [0.05, 0.55], [-0.3, 0.05, 1, 1], [-0.6, 0.55], [-0.95, 0.25, 0.4]]],
  sukun: [[[0.3, 0.4, 0.6], [-0.25, 0.45], [-0.45, 0.0], [-0.1, -0.35], [0.35, -0.1], [0.3, 0.4, 0.6]]],
  fathatan: [[[0.75, 0.75, 0.3], [0.2, 0.45, 1], [-0.75, -0.05, 0.4]], [[0.75, -0.05, 0.3], [0.2, -0.35, 1], [-0.75, -0.85, 0.4]]],
  kasratan: [[[0.75, 0.75, 0.3], [0.2, 0.45, 1], [-0.75, -0.05, 0.4]], [[0.75, -0.05, 0.3], [0.2, -0.35, 1], [-0.75, -0.85, 0.4]]],
  dammatan: [[[0.15, 0.25, 0.6], [-0.15, 0.75], [-0.6, 0.5], [-0.45, 0.05], [0.05, 0.05], [0.0, -0.45, 0.8], [-0.55, -0.85, 0.2], [-0.2, -0.6, 0.3], [0.5, -0.2, 0.2]]],
  alifk: [[[0.2, 0.9, 0.3], [0.05, 0.4, 1], [-0.1, -0.8, 0.5]]],
  hamza: [[[0.45, 0.55, 0.4], [-0.15, 0.7], [-0.45, 0.25], [0.05, -0.05], [0.55, 0.05, 0.8], [-0.5, -0.55, 0.3]]],
  hamzaB: [[[0.45, 0.55, 0.4], [-0.15, 0.7], [-0.45, 0.25], [0.05, -0.05], [0.55, 0.05, 0.8], [-0.5, -0.55, 0.3]]],
  madda: [[[0.9, 0.0, 0.4], [0.45, 0.4], [-0.1, 0.0], [-0.55, 0.35], [-0.9, 0.15, 0.4]]],
};
const MARK_SIZE = { hamza: [1.2, 1.3], hamzaB: [1.2, 1.3], madda: [1.9, 0.6], shadda: [2.1, 1.0], damma: [1.1, 1.8], dammatan: [1.4, 1.9], sukun: [1.0, 1.0], alifk: [0.6, 1.9], fathatan: [1.6, 1.7], kasratan: [1.6, 1.7], fatha: [1.6, 0.9], kasra: [1.6, 0.9] };

// ================= ROUNDEL =================
// A round field: the arrangement search fills a disc instead of a rectangle, then vowel marks are placed in the
// spaces near their letters, and an optional short companion text is set smaller in the largest space left.
function composeRoundel(text, o = {}) {
  const { tries = 18, iters = 6000, K = 1.6, seed = 7 } = o;
  const { bare, marks } = parseVowels(text);
  const groups = splitGroups(bare); if (!groups.length) return [];
  // companion text joins the arrangement as extra, smaller words
  if (o.companion && o.companion.trim()) { const pc = parseVowels(o.companion), base = Math.max(...groups.map(g => g.word)) + 1;
    let off = 0, lastW = -1; const sc = o.companionScale || 0.42, wl = pc.bare.split(' ').map(w => [...w.replace(/ل(?=[اأإآ])./g, 'ﻻ')].length);
    const cm = []; pc.marks.forEach((ms, wi) => { let o2 = 0; for (let j = 0; j < wi; j++) o2 += wl[j]; ms.forEach(m => cm.push({ li: m.li + o2, m: m.m })); });
    splitGroups(pc.bare).forEach(g => { g.newWord = g.word !== lastW && lastW >= 0; lastW = g.word; g.word = base; g.sc = sc; g.comp = true; groups.push(g); });
    marks[base] = cm; }
  // marks per group: letter positions inside each group
  let gi = 0; const wordStart = {}; groups.forEach((g, i) => { if (wordStart[g.word] == null) wordStart[g.word] = i; });
  groups.forEach((g, i) => { let off = 0; for (let j = wordStart[g.word]; j < i; j++) off += [...groups[j].s].length; g.marks = (marks[g.word] || []).filter(m => m.li >= off && m.li < off + [...g.s].length).map(m => ({ k: m.li - off, m: m.m })); });
  const shapes = groups.map(g => groupVariants(g, { ...o, deep: true, tails: true, levels: o.levels || [0, 2, 4, 7] }, K));
  const words = []; groups.forEach((g, i) => { (words[g.word] = words[g.word] || []).push(i); });
  const W = words.length, n = groups.length, GAP = 0.5;
  const pairOverlap = (A, ax, ay, B, bx, by, bare) => {
    const dx = Math.round((bx + B.x0 - (ax + A.x0)) * K), dy = Math.round(((ay + A.y1) - (by + B.y1)) * K);
    const xs = Math.max(0, dx), xe = Math.min(A.W, dx + B.W), ys = Math.max(0, dy), ye = Math.min(A.H, dy + B.H); if (xs >= xe || ys >= ye) return 0;
    let c = 0; const cw = o.cross ? 0.12 : 1, mw = o.merge ? 0.25 : 1; for (let y = ys; y < ye; y++) { const ra = y * A.W, rb = (y - dy) * B.W - dx; for (let x = xs; x < xe; x++) { const ta = (bare ? A.mask : A.dil)[ra + x], tb = B.mask[rb + x]; if (ta && tb) c += (ta === 1 && tb === 2) || (ta === 2 && tb === 1) ? cw : ta === 1 && tb === 1 ? mw : 1; } } // a stem may pass through a horizontal
    return c;
  };
  const results = [];
  for (let t = 0; t < tries; t++) {
    let sd = seed + t * 7919; const R = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    const lv = groups.map((g, i) => Math.floor(R() * shapes[i].length)), wp = words.map(() => ({ x: 0, y: 0 })), gpos = new Array(n);
    // inside a word, a break after a non-joining letter is kerned: the next piece slides right until it would touch
    const kern = new Map(), kernOf = (i, j) => { const key = i + ':' + lv[i] + '|' + j + ':' + lv[j]; if (kern.has(key)) return kern.get(key);
      const A = shapes[i][lv[i]], B = shapes[j][lv[j]]; let k = 0; for (let s = 0.25; s <= 4.01; s += 0.25) { const bx = -B.x1 + A.x0 - GAP + s; if (pairOverlap(A, 0, 0, B, bx, 0, true) > (o.kernTouch ?? 3)) break; k = s; } kern.set(key, k); return k; }; // a light touch is allowed
    const layoutWord = w => { let cur = wp[w].x, prev = -1; words[w].forEach(gi2 => { const S = shapes[gi2][lv[gi2]]; if (groups[gi2].newWord) cur -= 1.4 * (groups[gi2].sc || 1); let x = cur - S.x1; if (o.kern && prev >= 0 && !groups[gi2].newWord) x += Math.max(0, kernOf(prev, gi2) - 0.15); gpos[gi2] = { x, y: wp[w].y }; cur = x + S.x0 - GAP * (groups[gi2].sc || 1); prev = gi2; }); };
    let cur = 0; words.forEach((ws, w) => { wp[w].x = cur; layoutWord(w); const last = ws[ws.length - 1]; cur = gpos[last].x + shapes[last][lv[last]].x0 - 1.2; });
    const wbox = w => { let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; words[w].forEach(g2 => { const S = shapes[g2][lv[g2]], p = gpos[g2]; x0 = Math.min(x0, p.x + S.x0); x1 = Math.max(x1, p.x + S.x1); y0 = Math.min(y0, p.y + S.y0); y1 = Math.max(y1, p.y + S.y1); }); return { x0, x1, y0, y1 }; };
    const ov = Array.from({ length: W }, () => new Float64Array(W));
    const wordOverlap = (a, b) => { let c = 0; words[a].forEach(i => words[b].forEach(j => { const A = shapes[i][lv[i]], B = shapes[j][lv[j]]; c += pairOverlap(A, gpos[i].x, gpos[i].y, B, gpos[j].x, gpos[j].y) + pairOverlap(B, gpos[j].x, gpos[j].y, A, gpos[i].x, gpos[i].y); })); return c; };
    const recompute = a => { for (let b = 0; b < W; b++) if (b !== a) ov[a][b] = ov[b][a] = wordOverlap(a, b); };
    for (let a = 0; a < W; a++) recompute(a);
    // the disc: centred on the ink's centre of mass, radius reaching the furthest ink
    const disc = () => {
      const pts = []; let sw = 0; groups.forEach((g, i) => { const S = shapes[i][lv[i]]; sw += S.ink; S.hull.forEach(([hx, hy]) => pts.push([gpos[i].x + hx, gpos[i].y + hy])); });
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; pts.forEach(([x, y]) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); });
      let cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, r = 0;
      for (let it = 0; it < 12; it++) { // nudge the centre towards the furthest point (a quick smallest-enclosing-circle)
        let far = null, fd = -1; pts.forEach(p => { const dd = Math.hypot(p[0] - cx, p[1] - cy); if (dd > fd) { fd = dd; far = p; } }); r = fd;
        cx += (far[0] - cx) * 0.08 / (1 + it * 0.3); cy += (far[1] - cy) * 0.08 / (1 + it * 0.3); }
      const ov = o.oval || 1; r = 0; pts.forEach(p => { r = Math.max(r, Math.hypot((p[0] - cx) / ov, p[1] - cy)); });
      return { cx, cy, r: r + 0.8, ink: sw, oval: ov };
    };
    const energy = () => {
      let o2 = 0; for (let a = 0; a < W; a++) for (let b = a + 1; b < W; b++) o2 += ov[a][b];
      let order = 0; const bx = words.map((_, w) => wbox(w));
      for (let w = 0; w + 1 < W; w++) { const v = bx[w + 1].x1 - (bx[w].x1 - 1.5); if (v > 0) order += v * v; }
      // optionally, where two words overlap side to side, the one read first sits on top
      if (o.topFirst) for (let w = 0; w + 1 < W; w++) { const ox2 = Math.min(bx[w].x1, bx[w + 1].x1) - Math.max(bx[w].x0, bx[w + 1].x0), wm = Math.min(bx[w].x1 - bx[w].x0, bx[w + 1].x1 - bx[w + 1].x0);
        if (ox2 > 0.35 * wm) { const dv = (bx[w + 1].y0 + bx[w + 1].y1) / 2 - (bx[w].y0 + bx[w].y1) / 2; if (dv > -1) order += 0.6 * (dv + 1) ** 2; } }
      let cost = 0; groups.forEach((g, i) => { cost += shapes[i][lv[i]].cost; if (i > 0 && shapes[i][lv[i]].elong && shapes[i - 1][lv[i - 1]].elong) cost += 2.5; });
      const d = disc(), fill = d.ink / (Math.PI * d.r * d.r * (o.oval || 1) * K * K);
      // a round field wants a compact, roughly square mass of letters; the marks and companion text fill the rest
      let bx0 = 1e9, bx1 = -1e9, by0 = 1e9, by1 = -1e9; groups.forEach((g, i) => { const S = shapes[i][lv[i]]; bx0 = Math.min(bx0, gpos[i].x + S.x0); bx1 = Math.max(bx1, gpos[i].x + S.x1); by0 = Math.min(by0, gpos[i].y + S.y0); by1 = Math.max(by1, gpos[i].y + S.y1); });
      // balance: the ink's centre of mass should sit near the centre of the disc
      let sx = 0, sy = 0; groups.forEach((g, i) => { const S = shapes[i][lv[i]]; sx += (gpos[i].x + S.cx) * S.ink; sy += (gpos[i].y + S.cy) * S.ink; });
      const bal = Math.hypot(sx / d.ink - d.cx, sy / d.ink - d.cy) / d.r;
      let shelf = 0; if (o.elongate || o.emph) groups.forEach((g, i) => { const S = shapes[i][lv[i]]; (S.shelves || []).forEach(sh => {
        let cov = 0, tot = 0; for (let x = sh.x0 + 0.5; x < sh.x1 - 0.3; x += 0.6) { tot++; const gx = gpos[i].x + x, gy = gpos[i].y + sh.y;
          for (let j = 0; j < n && cov < tot; j++) { if (groups[j].word === g.word) continue; const T = shapes[j][lv[j]], lx = Math.round((gx - gpos[j].x - T.x0) * K) + 1;
            if (lx < 0 || lx >= T.W) continue; for (let dd = 1.0; dd <= 5.5; dd += 0.75) { const ly = Math.round((gpos[j].y + T.y1 - (gy + dd)) * K) + 1; if (ly >= 0 && ly < T.H && T.mask[ly * T.W + lx]) { cov++; break; } } } }
        shelf += tot ? cov / tot : 0; }); });
      // a later word may not rise above the first letters of the word before it (so the first name is read first)
      let rise = 0; if (o.noRise) for (let w = 0; w + 1 < W; w++) { const g0 = words[w][0], S0 = shapes[g0][lv[g0]], top0 = gpos[g0].y + S0.y1; const v = bx[w + 1].y1 - top0; if (v > -0.5) rise += (v + 0.5) ** 2; }
      // one top line: every tall stem reaches up to the same height
      let ceil = 0; if (o.ceiling) { const tops = []; groups.forEach((g, i) => (shapes[i][lv[i]].stemTops || []).forEach(([, ty]) => tops.push(gpos[i].y + ty))); if (tops.length > 1) { const mx = Math.max(...tops); tops.forEach(t => { ceil += (mx - t) ** 2; }); } }
      return 0.6 * ceil + 3 * o2 + 25 * order + 30 * Math.abs(Math.log((bx1 - bx0) / (by1 - by0) / (o.oval || 1))) + 110 * Math.max(0, (o.fillTarget || 0.36) - fill) + 25 * bal + cost - (o.emph ? 14 : 8) * shelf + 4 * rise;
    };
    let E = energy(), T = 20;
    if (o.fixed) { // rebuild a recorded layout: the same variant of each piece, each word in the same place
      o.fixed.lv.forEach((v, i) => { if (i < n) lv[i] = Math.min(v, shapes[i].length - 1); }); o.fixed.wp.forEach((p, w) => { if (w < W) wp[w] = { ...p }; });
      for (let w = 0; w < W; w++) layoutWord(w); for (let a = 0; a < W; a++) recompute(a); E = energy(); }
    for (let it = 0; it < (o.fixed ? 0 : iters); it++) {
      const mv = R(); let undo;
      if ((o.emph || o.elongate) && W > 1 && mv > (o.cradle ? 0.75 : 0.9)) { // lift a word onto a shelf (an elongated stroke or a long final sweep)
        const withShelf = groups.map((g, i) => i).filter(i => (shapes[i][lv[i]].shelves || []).length);
        if (withShelf.length) { const gi = withShelf[Math.floor(R() * withShelf.length)], shs = shapes[gi][lv[gi]].shelves, sh = shs.find(s2 => s2.cradle) || shs[0], others = words.map((_, w) => w).filter(w => w !== groups[gi].word), w = others[Math.floor(R() * others.length)];
          const old = { ...wp[w] }, bxw = wbox(w), sx0 = gpos[gi].x + sh.x0, sy = gpos[gi].y + sh.y;
          wp[w].x += (sx0 + (bxw.x1 - bxw.x0) / 2 + 0.6 + R() * Math.max(0, sh.x1 - sh.x0 - (bxw.x1 - bxw.x0))) - (bxw.x0 + bxw.x1) / 2; wp[w].y += sy + 0.9 + R() * 1.2 - bxw.y0;
          layoutWord(w); recompute(w); undo = () => { wp[w] = old; layoutWord(w); recompute(w); }; }
        else undo = () => {};
      }
      else if (mv < 0.6 && W > 1) { const w = Math.floor(R() * W), old = { ...wp[w] }; const s = T > 2 ? 1 : 0.35; wp[w].x += (R() - 0.5) * 8 * s; wp[w].y += (R() - 0.5) * 8 * s; layoutWord(w); recompute(w); undo = () => { wp[w] = old; layoutWord(w); recompute(w); }; }
      else { const g2 = Math.floor(R() * n), w = groups[g2].word, old = lv[g2]; lv[g2] = Math.floor(R() * shapes[g2].length); layoutWord(w); recompute(w); undo = () => { lv[g2] = old; layoutWord(w); recompute(w); }; }
      const E2 = energy();
      if (E2 <= E || R() < Math.exp((E - E2) / T)) E = E2; else undo();
      T = Math.max(0.03, T * Math.pow(0.03 / 20, 1 / iters));
    }
    let o2 = 0; for (let a = 0; a < W; a++) for (let b = a + 1; b < W; b++) o2 += ov[a][b];
    const d = disc();
    results.push({ E, overlap: o2, disc: d, st: gpos.map(p => ({ ...p })), shapes: groups.map((g, i) => shapes[i][lv[i]]), groups, lv: lv.slice(), wp: wp.map(p => ({ ...p })) });
    if (o.fixed) break;
  }
  results.sort((a, b) => a.E - b.E);
  return results;
}
// place vowel marks near their letters, in free space, with a finer pen
function placeMarks(r, o = {}) {
  const nib = o.nib || 1.3, K = 2, out = [], D = r.disc, RD = D.r * (o.discScale || 1.12) - 1.2;
  // rasterise the composition's ink
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; r.shapes.forEach((S, i) => { x0 = Math.min(x0, r.st[i].x + S.x0); x1 = Math.max(x1, r.st[i].x + S.x1); y0 = Math.min(y0, r.st[i].y + S.y0); y1 = Math.max(y1, r.st[i].y + S.y1); });
  x0 = Math.min(x0, D.cx - RD - 3); x1 = Math.max(x1, D.cx + RD + 3); y0 = Math.min(y0, D.cy - RD - 3); y1 = Math.max(y1, D.cy + RD + 3);
  const Wd = Math.ceil((x1 - x0) * K), Hd = Math.ceil((y1 - y0) * K), occ = new Uint8Array(Wd * Hd);
  const cv = document.createElement('canvas'); cv.width = Wd; cv.height = Hd; const cx = cv.getContext('2d'); cx.fillStyle = '#000';
  const X = x => (x - x0) * K, Y = y => (y1 - y) * K;
  r.shapes.forEach((S, i) => { S.b.strokes.forEach(s => cx.fill(new Path2D(nibPath(s.s.map(q => ({ x: q.x + r.st[i].x, y: q.y + r.st[i].y, w: q.w })), (s.nib || nib) * 1.6, s.ang, X, Y)))); });
  const px = cx.getImageData(0, 0, Wd, Hd).data; for (let i = 0; i < Wd * Hd; i++) occ[i] = px[i * 4 + 3] > 60 ? 1 : 0;
  const inDisc = (mx, my, w, h) => Math.hypot(mx - D.cx, my - D.cy) + Math.hypot(w, h) / 2 < RD;
  const free = (mx, my, w, h) => { if (!inDisc(mx, my, w, h)) return false; const ax = Math.floor(X(mx - w / 2)), bx = Math.ceil(X(mx + w / 2)), ay = Math.floor(Y(my + h / 2)), by = Math.ceil(Y(my - h / 2)); if (ax < 0 || ay < 0 || bx >= Wd || by >= Hd) return false; for (let y = ay; y <= by; y++) for (let x = ax; x <= bx; x++) if (occ[y * Wd + x]) return false; return true; };
  const claim = (mx, my, w, h) => { const ax = Math.floor(X(mx - w / 2 - 0.4)), bx = Math.ceil(X(mx + w / 2 + 0.4)), ay = Math.floor(Y(my + h / 2 + 0.4)), by = Math.ceil(Y(my - h / 2 - 0.4)); for (let y = Math.max(0, ay); y <= Math.min(Hd - 1, by); y++) for (let x = Math.max(0, ax); x <= Math.min(Wd - 1, bx); x++) occ[y * Wd + x] = 1; };
  r.shapes.forEach((S, i) => {
    const g = r.groups[i]; if (!g.marks || !g.marks.length) return;
    // stack shadda with its vowel: shadda first, then the vowel just above or below it
    const byLetter = {}; g.marks.forEach(m => { (byLetter[m.k] = byLetter[m.k] || []).push(m.m); });
    Object.entries(byLetter).forEach(([k, ms]) => {
      const p = S.b.placed.find(q => q.g && q.li === +k); if (!p) return;
      const sc = g.sc || 1, pts = p.g.s.flatMap(st => st.pts.map(q => [q[0] * sc + p.ox + r.st[i].x, q[1] * sc + (p.oy || 0) + r.st[i].y]));
      const lx = pts.reduce((a, q) => a + q[0], 0) / pts.length, top = Math.max(...pts.map(q => q[1])), bot = Math.min(...pts.map(q => q[1]));
      ms.sort((a, b) => (a === 'shadda' ? -1 : b === 'shadda' ? 1 : 0));
      ms.forEach(m => {
        const ms2 = (o.markScale || 1.6) * (g.sc || 1), [w0, h0] = MARK_SIZE[m] || [1.4, 1.2], w = w0 * ms2, h = h0 * ms2, below = BELOW.has(m), ay = below ? Math.min(bot, (p.oy || 0) + r.st[i].y) - 1.4 * (g.sc || 1) : Math.max(top - 2.5 * (g.sc || 1), (p.oy || 0) + r.st[i].y + 2.2 * (g.sc || 1));
        // search outward from the anchor for a free spot, preferring the side the mark belongs on
        let best = null;
        for (let rad = 0; rad <= 12 * (g.sc || 1) && !best; rad += 0.5 * (g.sc || 1)) for (let a = 0; a < 24; a++) {
          const ang2 = a / 24 * 2 * Math.PI, mx = lx + Math.cos(ang2) * rad, my = ay + Math.sin(ang2) * rad * 0.8;
          if (below ? my > ay + 1.5 : my < ay - 1.0) continue;
          // a mark sits over (or under) its letter, never level with it, where it could be misread as a letter
          if (below ? my + h / 2 > bot - 0.25 * (g.sc || 1) : my - h / 2 < top + 0.25 * (g.sc || 1)) continue;
          if (Math.abs(mx - lx) > (Math.max(...pts.map(q => q[0])) - Math.min(...pts.map(q => q[0]))) / 2 + 3.0 * (g.sc || 1)) continue;
          if (free(mx, my, w + 0.6, h + 0.6)) { best = [mx, my]; break; }
        }
        if (!best) { out.missing = (out.missing || 0) + 1; return; }
        claim(best[0], best[1], w, h);
        (MARK_SHAPES[m] || []).forEach(sh => out.push({ ang: 70, nib: nib * 0.75 * (g.sc || 1), s: sampleStroke(sh.map(([a2, b2, ww, c]) => [best[0] + a2 * ms2, best[1] + b2 * ms2, ww ?? 1, c])) }));
      });
    });
  });
  r.occ = { occ, Wd, Hd, X, Y, K, x0, y1 };
  return out;
}
// the companion text: set smaller, in the largest free space inside the disc
function placeCompanion(r, text, o = {}) {
  if (!text || !text.trim() || !r.occ) return null;
  const nib = o.nib || 1.3, D = r.disc, RD = D.r * (o.discScale || 1.12) - 1.0, { occ, Wd, Hd, X, Y, K } = r.occ;
  const pv = parseVowels(text), bs = buildStrokes(pv.bare, { ...o, noAuto: false });
  let best = null;
  for (const sc of [0.46, 0.4, 0.35, 0.3, 0.26, 0.22, 0.19]) {
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; bs.strokes.forEach(s => s.s.forEach(q => { x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); }));
    const pts = []; bs.strokes.forEach(s => s.s.forEach((q, i) => { if (i % 2 === 0) pts.push([(q.x - (x0 + x1) / 2) * sc, (q.y - (y0 + y1) / 2) * sc]); }));
    const pad = nib * sc * 0.9 + 0.5;
    let cand = [];
    for (let gy = D.cy - RD; gy <= D.cy + RD; gy += 0.4) for (let gx = D.cx - RD; gx <= D.cx + RD; gx += 0.4) {
      let ok = true, clear = 1e9;
      for (const [px, py] of pts) { const mx = gx + px, my = gy + py; if (Math.hypot(mx - D.cx, my - D.cy) > RD - pad) { ok = false; break; }
        const ix = Math.round(X(mx)), iy = Math.round(Y(my)), rr = Math.ceil(pad * K); for (let dy = -rr; dy <= rr && ok; dy += 2) for (let dx = -rr; dx <= rr; dx += 2) { const xx = ix + dx, yy = iy + dy; if (xx < 0 || yy < 0 || xx >= Wd || yy >= Hd || occ[yy * Wd + xx]) { ok = false; break; } } if (!ok) break; }
      if (ok) cand.push([gx, gy, -(gy - D.cy) * 0.3 - Math.hypot(gx - D.cx, gy - D.cy) * 0.1]);
    }
    if (cand.length) { cand.sort((a, b) => b[2] - a[2]); const [gx, gy] = cand[0]; best = { sc, gx, gy, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 }; break; }
  }
  if (!best) return null;
  const T2 = q => ({ x: best.gx + (q.x - best.cx) * best.sc, y: best.gy + (q.y - best.cy) * best.sc, w: q.w });
  const strokes = bs.strokes.map(s => ({ ...s, nib: (s.nib || nib) * best.sc, s: s.s.map(T2) }));
  // the companion's own vowel marks, placed near their letters in the space that is left
  strokes.forEach(s => s.s.forEach(q => { const ix = Math.round(X(q.x)), iy = Math.round(Y(q.y)); for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = ix + dx, yy = iy + dy; if (xx >= 0 && yy >= 0 && xx < Wd && yy < Hd) occ[yy * Wd + xx] = 1; } }));
  const sc = best.sc, ms2 = 1.6 * sc;
  pv.marks.forEach((ms, wi) => ms.forEach(({ li, m }) => {
    const p = bs.placed.find(q => q.g && q.wi === wi && q.li === li); if (!p) return;
    const pts = p.g.s.flatMap(st => st.pts.map(q => T2({ x: q[0] + p.ox, y: q[1] + (p.oy || 0) })));
    const lx = pts.reduce((a, q) => a + q.x, 0) / pts.length, top = Math.max(...pts.map(q => q.y)), bot = Math.min(...pts.map(q => q.y)), below = BELOW.has(m);
    const [w0, h0] = MARK_SIZE[m] || [1.4, 1.2], w = w0 * ms2, h = h0 * ms2;
    const ay = below ? bot - h * 0.8 : Math.max(top - 2.0 * sc, best.gy + 1.6 * sc);
    let spot = null;
    for (let rad = 0; rad <= 4 * sc + 1 && !spot; rad += 0.25) for (let a = 0; a < 12; a++) { const mx = lx + Math.cos(a / 12 * 6.283) * rad, my = ay + Math.sin(a / 12 * 6.283) * rad * 0.7;
      const ax = Math.floor(X(mx - w / 2)), bx = Math.ceil(X(mx + w / 2)), ay2 = Math.floor(Y(my + h / 2)), by = Math.ceil(Y(my - h / 2)); let ok = Math.hypot(mx - D.cx, my - D.cy) < RD;
      for (let y = ay2; y <= by && ok; y++) for (let x = ax; x <= bx; x++) if (x < 0 || y < 0 || x >= Wd || y >= Hd || occ[y * Wd + x]) { ok = false; break; }
      if (ok) { spot = [mx, my]; break; } }
    if (!spot) return;
    (MARK_SHAPES[m] || []).forEach(sh => strokes.push({ ang: 70, nib: nib * 0.34 * sc, s: sampleStroke(sh.map(([a2, b2, ww, c]) => [spot[0] + a2 * ms2, spot[1] + b2 * ms2, ww ?? 1, c])) }));
  }));
  return { strokes, dots: bs.dots.map(([a, b]) => { const q = T2({ x: a, y: b }); return [q.x, q.y, best.sc]; }), sc: best.sc };
}
let RID = 0;
function roundelParts(r, o = {}) {
  // everything to draw, in writing order: the name, its marks, the blessing, then the ring
  const nib = o.nib || 1.3, units = [];
  r.shapes.forEach((S, i) => { const { x, y } = r.st[i], tint = (r.groups[i] || {}).tint; S.b.strokes.forEach(s => units.push({ ...s, tint, s: s.s.map(q => ({ x: q.x + x, y: q.y + y, w: q.w })) }));
    if (!o.solved) S.b.dots.forEach(([a, b, sc]) => units.push({ dot: [a + r.st[i].x, b + r.st[i].y, sc || 1, 0] })); });
  if (o.solved) o.solved.dots.forEach(d2 => units.push({ dot: d2, tint: d2[4] }));
  (o.solved ? o.solved.strokes : (o.marks || [])).forEach(s => units.push(s));
  if (o.companion) { o.companion.strokes.forEach(s => units.push(s)); o.companion.dots.forEach(d2 => units.push({ dot: [d2[0], d2[1], d2[2] || 1, 0] })); }
  return units;
}
function renderRoundel(r, o = {}) {
  const { U = 10, field = '#1d4a3a', gold = '#d6ab4f', goldDark = '#7a5a1c', outline = '#3a2a0c', bg = '#ece6d6', marks = [] } = o, nib = o.nib || 1.3, id = 'r' + (++RID);
  const units = roundelParts(r, o);
  const d = r.disc; let R0 = d.r * (o.discScale || 1.12);
  units.forEach(u => { if (u.s) u.s.forEach(q => { R0 = Math.max(R0, Math.hypot((q.x - d.cx) / (d.oval || 1), q.y - d.cy) + nib * 0.7); }); });
  const Rin = R0 * 1.03;
  // the inscription ring, outside the inner field
  const ring = o.ringText ? makeRing(o.ringText, d.cx, d.cy, Rin + Rin * 0.03, Rin * 0.36, o) : null;
  if (ring) { ring.strokes.forEach(s => units.push(s)); ring.marks.forEach(s => units.push(s)); ring.dots.forEach(d2 => units.push({ dot: d2 })); }
  const OV = r.disc.oval || 1, Rf = ring ? ring.R1 + Rin * 0.03 : Rin, rim = Rin * 0.075, Rout = Rf + rim;
  const panel = o.illum === 'panel' || o.illum === 'iznik', pad = o.illum === 'rays' || panel ? Rout * (OV > 1.01 ? 0.5 : 0.3) : 1.5, S2 = (Rout * OV + pad) * 2 * U, C = S2 / 2;
  const X = x => C + (x - d.cx) * U, Y = y => C - (y - d.cy) * U;
  const quads = units.map(u => u.dot ? [dotPath(u.dot[0], u.dot[1], nib * u.dot[2], o.ang || 70, X, Y, u.dot[3] || 0)] : nibQuads(u.s, u.nib || nib, u.ang, X, Y));
  const ill = o.illum && o.illum !== 'none' ? illumination(C, Rout, U, { gold, goldDark, blue: o.blue, red: o.red, fold: o.fold, density: o.density, ov: OV }, o.illum, S2) : { under: '', over: '' };
  // turquoise in the counters, under the letters (letters only, not marks)
  let holes = ''; if (o.counters) { const ls = units.filter(u => u.s && !u.mark && (u.nib || nib) > nib * 0.6); let a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9; ls.forEach(u => u.s.forEach(q => { a0 = Math.min(a0, q.x); a1 = Math.max(a1, q.x); b0 = Math.min(b0, q.y); b1 = Math.max(b1, q.y); })); holes = `<path d="${findCounters(ls, nib, a0 - 1, b1 + 1, U, a1 - a0 + 2, b1 - b0 + 2, X, Y).join('')}" fill="${o.counters}"/>`; }
  let body;
  if (o.animate) {
    // the pen writes: each little segment appears in turn, with a pause when the pen lifts between strokes
    let t = 0, outl = '', fill = ''; const dt = (o.duration || 9) / Math.max(1, quads.reduce((a, q) => a + q.length, 0) + quads.length * 6);
    quads.forEach((qs, ui) => { const tint = units[ui].tint ? ` fill="${units[ui].tint}" stroke="${units[ui].tint}"` : ''; qs.forEach(q => { if (!o.noOutline) outl += `<path class="q${id}" style="animation-delay:${t.toFixed(3)}s" d="${q}"/>`; fill += `<path class="q${id}"${tint} style="animation-delay:${t.toFixed(3)}s" d="${q}"/>`; t += dt; }); t += dt * 6; });
    body = `<style>.q${id}{opacity:0;animation:a${id} .12s linear forwards}@keyframes a${id}{to{opacity:1}}</style><g fill="${outline}" stroke="${outline}" stroke-width="${(0.22 * U).toFixed(1)}" stroke-linejoin="round">${outl}</g><g fill="url(#gd${id})" stroke="url(#gd${id})" stroke-width="${(0.09 * U).toFixed(1)}" stroke-linejoin="round">${fill}</g>`; // a hairline of gold closes the seams between segments
  } else {
    const all = quads.filter((q, i) => !units[i].tint).map(q => q.join('')).join(''), tints = {};
    quads.forEach((q, i) => { const t = units[i].tint; if (t) tints[t] = (tints[t] || '') + q.join(''); }); // letters set in their own colour
    body = `${o.noOutline ? '' : `<g fill="${outline}" stroke="${outline}" stroke-width="${(0.22 * U).toFixed(1)}" stroke-linejoin="round"><path d="${all}"/></g>`}<g fill="url(#gd${id})"><path d="${all}"/></g>` + Object.entries(tints).map(([t, d2]) => `<path fill="${t}" d="${d2}"/>`).join('');
  }
  const ringDeco = ring ? `<circle cx="${C}" cy="${C}" r="${(Rin * U).toFixed(1)}" fill="none" stroke="url(#gd${id})" stroke-width="${(Rin * 0.022 * U).toFixed(1)}"/><circle cx="${C}" cy="${C}" r="${(Rin * U).toFixed(1)}" fill="none" stroke="${goldDark}" stroke-width="${(0.06 * U).toFixed(1)}"/>` + rosette(C, C + ((ring.R0 + ring.R1) / 2) * U, (ring.R1 - ring.R0) * U * 0.28, 8, gold, goldDark) : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S2.toFixed(0)} ${S2.toFixed(0)}" width="${S2.toFixed(0)}" height="${S2.toFixed(0)}">
<defs><linearGradient id="gd${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${gold}"/><stop offset="0.5" stop-color="#f0d07a"/><stop offset="1" stop-color="${gold}"/></linearGradient>
<radialGradient id="fd${id}" cx="0.5" cy="0.45" r="0.6"><stop offset="0" stop-color="${field}" stop-opacity="0.85"/><stop offset="1" stop-color="${field}"/></radialGradient></defs>
<rect width="100%" height="100%" fill="${bg}"/>${ill.under}
<ellipse cx="${C}" cy="${C}" rx="${((Rout + rim * (OV - 1)) * OV * U / OV + (Rout * OV - Rout) * U).toFixed(1)}" ry="${(Rout * U).toFixed(1)}" fill="url(#gd${id})" stroke="${goldDark}" stroke-width="${(0.12 * U).toFixed(1)}"/>
<ellipse cx="${C}" cy="${C}" rx="${((Rout - rim * 0.32) * U + (Rout * OV - Rout) * U).toFixed(1)}" ry="${((Rout - rim * 0.32) * U).toFixed(1)}" fill="none" stroke="${goldDark}" stroke-width="${(0.08 * U).toFixed(1)}"/>
<ellipse cx="${C}" cy="${C}" rx="${(Rf * U + (Rout * OV - Rout) * U).toFixed(1)}" ry="${(Rf * U).toFixed(1)}" fill="url(#fd${id})" stroke="${goldDark}" stroke-width="${(0.1 * U).toFixed(1)}"/>${ringDeco}
${holes}${body}${ill.over}
</svg>`;
}
function finishRoundel(r, companion, o = {}) {
  let best = null;
  for (const ds of [1.06, 1.14, 1.24, 1.36, 1.5, 1.64]) {
    const marks = placeMarks(r, { ...o, discScale: ds }), want = (r.groups || []).reduce((a, g) => a + new Set((g.marks || []).map(m => m.k + m.m)).size, 0);
    const placedMarks = marks.length ? new Set(marks.map(m => m.mk)).size : 0;
    const comp = companion ? placeCompanion(r, companion, { ...o, discScale: ds }) : null;
    const solved = o.solver !== false ? solveMarks(r, { ...o, discScale: ds, extraInk: comp }) : null; // marks are solved around the placed blessing
    const res = { marks, solved, companion: comp, discScale: ds, missing: (solved ? 0 : (marks.missing || 0)) + (companion && !comp ? 1 : 0) };
    if (!best || res.missing < best.missing) best = res;
    if (!res.missing) break;
  }
  return best;
}

// ================= INSCRIPTION RING =================
// A line of thuluth bent round a circle, letter tops towards the centre, reading clockwise from the bottom, as on a
// dome or a medallion's border. The pen turns with the writing. The text is stretched (or shrunk) to go round once,
// leaving a small gap at the bottom for a rosette.
function lineMarks(bs, pvMarks, o, yTop, yBot) {
  // vowel marks for a line of text, placed in free space over or under their letters, within the band
  const nib = o.nib || 1.3, K = 2, out = [];
  let x0 = 1e9, x1 = -1e9; bs.strokes.forEach(s => s.s.forEach(q => { x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); }));
  x0 -= 2; x1 += 2; const y0 = yBot - 1, y1 = yTop + 1, Wd = Math.ceil((x1 - x0) * K), Hd = Math.ceil((y1 - y0) * K);
  const cv = document.createElement('canvas'); cv.width = Wd; cv.height = Hd; const c2 = cv.getContext('2d'); c2.fillStyle = '#000';
  const X = x => (x - x0) * K, Y = y => (y1 - y) * K;
  bs.strokes.forEach(s => c2.fill(new Path2D(nibPath(s.s, (s.nib || nib) * 1.5, s.ang, X, Y))));
  bs.dots.forEach(([a, b]) => c2.fill(new Path2D(dotPath(a, b, nib * 1.4, o.ang || 70, X, Y))));
  const px = c2.getImageData(0, 0, Wd, Hd).data, occ = new Uint8Array(Wd * Hd); for (let i = 0; i < Wd * Hd; i++) occ[i] = px[i * 4 + 3] > 60 ? 1 : 0;
  const ms2 = o.markScale || 1.5;
  pvMarks.forEach((ms, wi) => ms.forEach(({ li, m }) => {
    const p = bs.placed.find(q => q.g && q.wi === wi && q.li === li); if (!p) return;
    const pts = p.g.s.flatMap(st => st.pts.map(q => [q[0] + p.ox, q[1] + (p.oy || 0)]));
    const lx = pts.reduce((a, q) => a + q[0], 0) / pts.length, top = Math.max(...pts.map(q => q[1])), bot = Math.min(...pts.map(q => q[1])), below = BELOW.has(m);
    const [w0, h0] = MARK_SIZE[m] || [1.4, 1.2], w = w0 * ms2, h = h0 * ms2;
    let spot = null;
    for (let rad = 0; rad <= 6 && !spot; rad += 0.3) for (let a = 0; a < 20; a++) {
      const mx = lx + Math.cos(a / 20 * 6.283) * rad, my = (below ? bot - h / 2 - 0.4 : top + h / 2 + 0.4) + Math.sin(a / 20 * 6.283) * rad * 0.6;
      if (below ? my + h / 2 > bot - 0.2 : my - h / 2 < Math.min(top, 3.0) + 0.2) continue;
      if (my + h / 2 > yTop || my - h / 2 < yBot) continue;
      const ax = Math.floor(X(mx - w / 2)), bx = Math.ceil(X(mx + w / 2)), ay = Math.floor(Y(my + h / 2)), by = Math.ceil(Y(my - h / 2)); let ok = true;
      for (let y = ay; y <= by && ok; y++) for (let x = ax; x <= bx; x++) if (x < 0 || y < 0 || x >= Wd || y >= Hd || occ[y * Wd + x]) { ok = false; break; }
      if (ok) { spot = [mx, my]; for (let y = ay - 1; y <= by + 1; y++) for (let x = ax - 1; x <= bx + 1; x++) if (x >= 0 && y >= 0 && x < Wd && y < Hd) occ[y * Wd + x] = 1; break; }
    }
    if (!spot) return;
    (MARK_SHAPES[m] || []).forEach(sh => out.push({ ang: 70, nib: nib * 0.34, s: sampleStroke(sh.map(([a2, b2, ww, c]) => [spot[0] + a2 * ms2, spot[1] + b2 * ms2, ww ?? 1, c])) }));
  }));
  return out;
}
function makeRing(text, cx, cy, R0, band, o = {}) {
  if (!text || !text.trim()) return null;
  const pv = parseVowels(text), seam = o.seam || 0.26; // radians left open at the bottom, for the rosette
  const measure = k => { const bs = buildStrokes(pv.bare, { ...o, kashida: k }); let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; bs.strokes.forEach(s => s.s.forEach(q => { x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); })); bs.dots.forEach(([a, b]) => { y0 = Math.min(y0, b); y1 = Math.max(y1, b); }); return { bs, x0, x1, y0, y1 }; };
  // the band holds the letters plus room for marks above; choose the stretch that sends the text once round
  let m0 = measure(0); const reserve = 2.6, hText = (m0.y1 + reserve) - Math.min(m0.y0, -2.5);
  let s = band / hText, Rb = R0 + band - (-Math.min(m0.y0, -2.5)) * s;
  const target = (2 * Math.PI - seam) * Rb;
  let best = m0;
  if ((m0.x1 - m0.x0) * s < target) { for (let k = 0.25; k <= 12; k += 0.25) { const m = measure(k); if ((m.x1 - m.x0) * s > target) break; best = m; } }
  else { s = target / (m0.x1 - m0.x0); Rb = R0 + band - (-Math.min(m0.y0, -2.5)) * s; }
  const { bs } = best, yTop = best.y1 + reserve, yBot = Math.min(best.y0, -2.5);
  const marks = lineMarks(bs, pv.marks, o, yTop, yBot);
  // leftover space is shared between the words, so the text goes all the way round
  const span = (best.x1 - best.x0) * s, extra = Math.max(0, ((2 * Math.PI - seam) * Rb - span) / Rb);
  const wx = {}; bs.placed.forEach(p => { if (!p.g) return; const xs = p.g.s.flatMap(st => st.pts.map(q => q[0] + p.ox)); const w = wx[p.wi] || (wx[p.wi] = [1e9, -1e9]); w[0] = Math.min(w[0], ...xs); w[1] = Math.max(w[1], ...xs); });
  const nW = Object.keys(wx).length, perGap = nW > 1 ? extra / (nW - 1) : 0, lead = nW > 1 ? 0 : extra / 2;
  const wordOf = x => { let best2 = 0, bd = 1e9; Object.entries(wx).forEach(([wi, [a2, b2]]) => { const dd = x < a2 ? a2 - x : x > b2 ? x - b2 : 0; if (dd < bd) { bd = dd; best2 = +wi; } }); return best2; };
  const map = (x, y, wi) => { const u = (best.x1 - x) * s, phi = -Math.PI / 2 - seam / 2 - lead - (wi ?? wordOf(x)) * perGap - u / Rb, r = Rb - y * s; return { x: cx + r * Math.cos(phi), y: cy + r * Math.sin(phi), rot: phi + Math.PI / 2 }; };
  const bend = st => { const xs = st.s.map(q => q.x), wi = wordOf((Math.min(...xs) + Math.max(...xs)) / 2); return { ...st, nib: (st.nib || o.nib || 1.3) * s, s: st.s.map(q => { const m = map(q.x, q.y, wi); return { x: m.x, y: m.y, w: q.w, rot: m.rot }; }) }; };
  return { strokes: bs.strokes.map(bend), marks: marks.map(bend), dots: bs.dots.map(([a, b]) => { const m = map(a, b); return [m.x, m.y, s, m.rot]; }), R0, R1: R0 + band, s };
}

// ================= ILLUMINATION =================
// Ottoman-style illumination: radiating rays round the rim, a band of small palmettes, and for a full panel, scrolling
// spirals with leaves and rosettes in the corners. All parametric.
function rosette(x, y, r, petals, fill, centre) {
  let d = ''; for (let i = 0; i < petals; i++) { const a = i / petals * 2 * Math.PI, a1 = a - Math.PI / petals * 0.8, a2 = a + Math.PI / petals * 0.8;
    d += `M${x.toFixed(1)} ${y.toFixed(1)}Q${(x + Math.cos(a1) * r * 1.2).toFixed(1)} ${(y + Math.sin(a1) * r * 1.2).toFixed(1)} ${(x + Math.cos(a) * r).toFixed(1)} ${(y + Math.sin(a) * r).toFixed(1)}Q${(x + Math.cos(a2) * r * 1.2).toFixed(1)} ${(y + Math.sin(a2) * r * 1.2).toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}Z`; }
  return `<path d="${d}" fill="${fill}"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(r * 0.32).toFixed(1)}" fill="${centre}"/>`;
}
function leaf(x, y, ang, len, wid, fill) { // a pointed leaf along direction ang (screen radians)
  const c = Math.cos(ang), s = Math.sin(ang), px = -s, py = c, tip = [x + c * len, y + s * len];
  return `<path d="M${x.toFixed(1)} ${y.toFixed(1)}Q${(x + c * len * 0.5 + px * wid).toFixed(1)} ${(y + s * len * 0.5 + py * wid).toFixed(1)} ${tip[0].toFixed(1)} ${tip[1].toFixed(1)}Q${(x + c * len * 0.5 - px * wid).toFixed(1)} ${(y + s * len * 0.5 - py * wid).toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}Z" fill="${fill}"/>`;
}
function illumination(C, Rout, U, P, mode, S2) {
  const gold = P.gold, blue = P.blue || '#2c4a8c', red = P.red || '#a3352b', dark = P.goldDark; let under = '', over = '';
  const R = Rout * U;
  // rays: alternating long and short, thin, tipped with dots (tığ)
  const N = 96; let rays = '';
  for (let i = 0; i < N; i++) { const a = i / N * 2 * Math.PI, long = i % 2 === 0, l = R * (long ? 0.2 : 0.11), w = R * (long ? 0.012 : 0.009), c = Math.cos(a), s = Math.sin(a), x0 = C + c * R * 1.0, y0 = C + s * R * 1.0, x1 = C + c * (R + l), y1 = C + s * (R + l);
    rays += `<path d="M${(x0 - s * w).toFixed(1)} ${(y0 + c * w).toFixed(1)}L${x1.toFixed(1)} ${y1.toFixed(1)}L${(x0 + s * w).toFixed(1)} ${(y0 - c * w).toFixed(1)}Z" fill="${i % 4 === 0 ? blue : gold}"/>`;
    if (long) rays += `<circle cx="${(C + c * (R + l + R * 0.012)).toFixed(1)}" cy="${(C + s * (R + l + R * 0.012)).toFixed(1)}" r="${(R * 0.008).toFixed(1)}" fill="${i % 4 === 0 ? blue : gold}"/>`; }
  if (mode !== 'iznik') under += rays;
  // a band of small palmettes just outside the rim
  const M = 48; let band = `<circle cx="${C}" cy="${C}" r="${(R * 1.035).toFixed(1)}" fill="none" stroke="${dark}" stroke-width="${(R * 0.004).toFixed(1)}"/>`;
  for (let i = 0; i < M; i++) { const a = (i + 0.5) / M * 2 * Math.PI, x = C + Math.cos(a) * R * 1.02, y = C + Math.sin(a) * R * 1.02; band += leaf(x, y, a, R * 0.045, R * 0.014, i % 2 ? gold : red); }
  under += band;
  if (mode === 'iznik') {
    // the medallion on a field of Iznik tiles, a white halo round the rim and a cobalt frame
    const half = S2 / 2;
    const ov = P.ov || 1;
    if (ov > 1.01) { // an oval cartouche on a landscape panel of tiles, with an oval halo and a cobalt frame round the panel
      const rx = R * 1.07 * ov, ry = R * 1.07, m = R * 0.3, fx = C - rx - m, fy = C - ry - m, fw = 2 * (rx + m), fh = 2 * (ry + m);
      return { under: iznikField(S2, { fold: P.fold || 8, density: P.density || 3, cx: C, cy: C, reach: S2 * 0.85, tile: fh / 3 }) + `<ellipse cx="${C}" cy="${C}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="#f4f6f7" stroke="#1f3f8f" stroke-width="${(R * 0.012).toFixed(1)}"/>`
        + `<rect x="${(fx + m * 0.12).toFixed(1)}" y="${(fy + m * 0.12).toFixed(1)}" width="${(fw - m * 0.24).toFixed(1)}" height="${(fh - m * 0.24).toFixed(1)}" fill="none" stroke="#1f3f8f" stroke-width="${(m * 0.12).toFixed(1)}"/>`, over: '', panel: [fx, fy, fw, fh] };
    }
    return { under: iznikField(S2, { fold: P.fold || 8, density: P.density || 3, cx: C, cy: C, reach: S2 * 0.85, tile: S2 / 5 }) + `<circle cx="${C}" cy="${C}" r="${(R * 1.07).toFixed(1)}" fill="#f4f6f7" stroke="#1f3f8f" stroke-width="${(R * 0.012).toFixed(1)}"/>` + band
      + `<rect x="${(half * 0.03).toFixed(1)}" y="${(half * 0.03).toFixed(1)}" width="${(S2 - half * 0.06).toFixed(1)}" height="${(S2 - half * 0.06).toFixed(1)}" fill="none" stroke="#1f3f8f" stroke-width="${(half * 0.03).toFixed(1)}"/>`, over: '' };
  }
  if (mode === 'panel') {
    // corner scrolls: a spiral stem with leaves and rosettes, mirrored into all four corners and across each diagonal
    const half = S2 / 2; let sc = '';
    const spiral = (flip) => {
      let d = '', g = ''; const pts = [];
      for (let t = 0; t <= 1; t += 0.01) { const th = 0.6 + t * 4.2, r = half * 0.42 * Math.exp(-0.33 * th); let x = half * 0.86 - Math.cos(th) * r * 1.0 - half * 0.05, y = half * 0.86 - Math.sin(th) * r * 0.9 - half * 0.18; if (flip) [x, y] = [y, x]; pts.push([x, y]); }
      d = 'M' + pts.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L');
      g += `<path d="${d}" fill="none" stroke="${gold}" stroke-width="${(half * 0.008).toFixed(1)}" stroke-linecap="round"/>`;
      for (let i = 6; i < pts.length - 4; i += 9) { const [x, y] = pts[i], [x2, y2] = pts[i + 1], a = Math.atan2(y2 - y, x2 - x) + (i % 18 < 9 ? 1 : -1) * 0.9; g += leaf(x, y, a, half * 0.06 * (1 - i / pts.length * 0.5), half * 0.018, i % 27 < 9 ? blue : gold); }
      const [ex, ey] = pts[pts.length - 1]; g += rosette(ex, ey, half * 0.035, 6, red, gold);
      const [sx, sy] = pts[0]; g += rosette(sx, sy, half * 0.05, 8, gold, blue);
      return g;
    };
    const corner = spiral(false) + spiral(true);
    [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(([fx, fy]) => { sc += `<g transform="translate(${C} ${C}) scale(${fx} ${fy})">${corner}</g>`; });
    under = `<rect x="${(C - half + half * 0.04).toFixed(1)}" y="${(C - half + half * 0.04).toFixed(1)}" width="${(half * 1.92).toFixed(1)}" height="${(half * 1.92).toFixed(1)}" fill="none" stroke="${gold}" stroke-width="${(half * 0.012).toFixed(1)}"/><rect x="${(C - half + half * 0.065).toFixed(1)}" y="${(C - half + half * 0.065).toFixed(1)}" width="${(half * 1.87).toFixed(1)}" height="${(half * 1.87).toFixed(1)}" fill="none" stroke="${dark}" stroke-width="${(half * 0.004).toFixed(1)}"/>` + sc + under;
  }
  return { under, over };
}

// ================= GLOBAL MARK SOLVER =================
// Vowels and dots are placed together, after the letters, as one even distribution that counterweights the letters
// (letters first, marks second; marks spread evenly, never at random). Vowels are written with a pen a third the width
// of the letters' pen. Dot groups may shift and regroup but stay with their letter, on its side. Optionally, muhmal signs
// (a small hah under hah, a small seen under seen) and tirfil/tirnak ornaments fill the largest remaining gaps.
const DOT_ARR = { 2: ['h', 'v'], 3: ['up', 'down'] };
function dotOffsets(n, arr, nib, side) {
  const s = nib * 1.15;
  if (n === 1) return [[0, 0]];
  if (n === 2) return arr === 'v' ? [[0, -s * 0.5], [0, s * 0.5]] : [[-s / 2, 0], [s / 2, 0]];
  if (arr === 'row') return [[-s, 0], [0, 0], [s, 0]];
  const up = arr === 'up' ? 1 : -1; return [[-s / 2, -s * 0.45 * up], [s / 2, -s * 0.45 * up], [0, s * 0.55 * up]];
}
const ORN_SHAPES = {
  plume: [[[0.05, -1.0, 0.3], [0.2, -0.35, 0.9], [0.55, 0.35, 1], [0.35, 0.95, 0.7], [-0.15, 1.05, 0.5], [-0.35, 0.55, 0.8], [-0.1, -0.1, 0.9], [0.05, -1.0, 0.3]], [[0.1, -0.5, 0.4], [0.15, 0.35, 0.6], [0.0, 0.8, 0.3]]],
  tirfil: [[[0.0, 0.55, 0.6], [-0.35, 0.95], [-0.05, 1.2], [0.25, 0.9], [0.0, 0.55, 0.6]], [[-0.1, 0.4, 0.6], [-0.75, 0.35], [-0.8, 0.0], [-0.35, 0.05], [-0.1, 0.4, 0.6]], [[0.1, 0.4, 0.6], [0.75, 0.35], [0.8, 0.0], [0.35, 0.05], [0.1, 0.4, 0.6]], [[0.0, 0.3, 0.8], [0.0, -0.9, 0.3]]],
  tirnak: [[[0.8, 0.5, 0.2], [0.2, 0.1, 0.9], [-0.4, -0.15, 1], [-0.85, 0.1, 0.4]]],
  minihah: [[[0.75, 0.55, 0.3], [0.1, 0.45, 0.9], [-0.45, 0.5, 0.9, 1], [-0.1, 0.0], [-0.5, -0.55], [0.1, -0.95], [0.85, -0.8, 0.3]]],
  minisin: [[[1.0, 0.4, 0.4], [0.85, -0.1, 0.9, 1], [0.6, 0.35, 0.6, 1], [0.4, -0.1, 0.9, 1], [0.15, 0.35, 0.6, 1], [-0.05, -0.1, 0.9], [-0.6, -0.35], [-1.0, -0.05, 0.4]]],
};
const ORN_SIZE = { plume: [1.3, 2.3], tirfil: [1.7, 2.2], tirnak: [1.8, 0.8], minihah: [1.7, 1.8], minisin: [2.1, 0.9] };
function solveMarks(r, o = {}) {
  const nib = o.nib || 1.3, K = 2, D = r.disc, RD = D.r * (o.discScale || 1.18) - 1.0, ms = o.markScale || 1.6, OV = D.oval || 1, hyp = (dx, dy) => Math.hypot(dx / OV, dy);
  // the letters' ink (no dots), rasterised
  const x0 = D.cx - RD * OV - 4, x1 = D.cx + RD * OV + 4, y0 = D.cy - RD - 4, y1 = D.cy + RD + 4, Wd = Math.ceil((x1 - x0) * K), Hd = Math.ceil((y1 - y0) * K);
  const cv = document.createElement('canvas'); cv.width = Wd; cv.height = Hd; const c2 = cv.getContext('2d'); c2.fillStyle = '#000';
  const X = x => (x - x0) * K, Y = y => (y1 - y) * K;
  r.shapes.forEach((S, i) => S.b.strokes.forEach(s => c2.fill(new Path2D(nibPath(s.s.map(q => ({ x: q.x + r.st[i].x, y: q.y + r.st[i].y, w: q.w })), (s.nib || nib) * 1.35, s.ang, X, Y)))));
  if (o.extraInk) { o.extraInk.strokes.forEach(s => c2.fill(new Path2D(nibPath(s.s, (s.nib || nib) * 1.5, s.ang, X, Y)))); o.extraInk.dots.forEach(d => c2.fill(new Path2D(dotPath(d[0], d[1], nib * (d[2] || 1) * 1.5, o.ang || 70, X, Y)))); } // the blessing is an obstacle too
  const px = c2.getImageData(0, 0, Wd, Hd).data, ink = new Uint8Array(Wd * Hd); for (let i = 0; i < Wd * Hd; i++) ink[i] = px[i * 4 + 3] > 60 ? 1 : 0;
  // distance from every cell to the nearest ink (chamfer), used to measure the gaps
  const dist = new Float32Array(Wd * Hd); for (let i = 0; i < Wd * Hd; i++) dist[i] = ink[i] ? 0 : 1e6;
  for (let y = 0; y < Hd; y++) for (let x = 0; x < Wd; x++) { const i = y * Wd + x; if (x) dist[i] = Math.min(dist[i], dist[i - 1] + 1); if (y) dist[i] = Math.min(dist[i], dist[i - Wd] + 1); if (x && y) dist[i] = Math.min(dist[i], dist[i - Wd - 1] + 1.414); if (y && x < Wd - 1) dist[i] = Math.min(dist[i], dist[i - Wd + 1] + 1.414); }
  for (let y = Hd - 1; y >= 0; y--) for (let x = Wd - 1; x >= 0; x--) { const i = y * Wd + x; if (x < Wd - 1) dist[i] = Math.min(dist[i], dist[i + 1] + 1); if (y < Hd - 1) dist[i] = Math.min(dist[i], dist[i + Wd] + 1); if (x < Wd - 1 && y < Hd - 1) dist[i] = Math.min(dist[i], dist[i + Wd + 1] + 1.414); if (y < Hd - 1 && x) dist[i] = Math.min(dist[i], dist[i + Wd - 1] + 1.414); }
  const inkHits = (cx, cy, w, h) => { const ax = Math.floor(X(cx - w / 2)), bx = Math.ceil(X(cx + w / 2)), ay = Math.floor(Y(cy + h / 2)), by = Math.ceil(Y(cy - h / 2)); let c = 0; for (let y = ay; y <= by; y++) for (let x = ax; x <= bx; x++) { if (x < 0 || y < 0 || x >= Wd || y >= Hd) { c++; continue; } if (ink[y * Wd + x]) c++; } return c; };
  // gather the items: vowel marks, dot groups and (optionally) muhmal signs
  const items = [];
  r.shapes.forEach((S, i) => {
    const g = r.groups[i], sc = g.sc || 1, ox = r.st[i].x, oy = r.st[i].y;
    const letterBox = li => { const p = S.b.placed.find(q => q.g && q.li === li); if (!p) return null; const pts = p.g.s.flatMap(st => st.pts.map(q => [q[0] * sc + p.ox + ox, q[1] * sc + (p.oy || 0) + oy]));
      return { lx: pts.reduce((a, q) => a + q[0], 0) / pts.length, x0: Math.min(...pts.map(q => q[0])), x1: Math.max(...pts.map(q => q[0])), top: Math.max(...pts.map(q => q[1])), bot: Math.min(...pts.map(q => q[1])), c: p.c }; };
    (S.b.dotGroups || []).forEach(dg => { const n = dg.n, arrs = DOT_ARR[n] || ['h']; items.push({ kind: 'dots', key: i + ':' + dg.li, n, arrs, arr: arrs[0], side: dg.side, x: dg.x + ox, y: dg.y + oy, ax: dg.x + ox, ay: dg.y + oy, lx0: dg.x0 + ox, lx1: dg.x1 + ox, top: dg.top + oy, bot: dg.bot + oy, sc: dg.sc || 1 }); });
    const byLetter = {}; (g.marks || []).forEach(m => { (byLetter[m.k] = byLetter[m.k] || []).push(m.m); });
    Object.entries(byLetter).forEach(([k, list]) => { const L = letterBox(+k); if (!L) return; list.sort((a, b) => (a === 'shadda' ? -1 : b === 'shadda' ? 1 : 0));
      list.forEach((m, j) => { const [w0, h0] = MARK_SIZE[m] || [1.4, 1.2], below = BELOW.has(m), w = w0 * ms * sc, h = h0 * ms * sc;
        const ay = below ? L.bot - h / 2 - 0.5 * sc : Math.max(L.top, oy + 2.2 * sc) + h / 2 + 0.5 * sc + j * 1.2 * sc;
        items.push({ kind: 'mark', key: i + ':' + k, m, side: below ? -1 : 1, w, h, x: L.lx, y: ay, ax: L.lx, ay, lx0: L.x0, lx1: L.x1, top: L.top, bot: L.bot, sc }); }); });
    if (o.ornaments) [...g.s].forEach((c, li) => { const fam = FAM[c]; const sign = fam === 'hah' && c === 'ح' ? 'minihah' : fam === 'sin' && c === 'س' ? 'minisin' : null; if (!sign) return;
      const L = letterBox(li); if (!L) return; const [w0, h0] = ORN_SIZE[sign], w = w0 * sc, h = h0 * sc, ay = L.bot - h / 2 - 0.6 * sc;
      items.push({ kind: 'orn', m: sign, side: -1, w, h, x: L.lx, y: ay, ax: L.lx, ay, lx0: L.x0, lx1: L.x1, top: L.top, bot: L.bot, sc }); });
  });
  const boxOf = it => { if (it.kind !== 'dots') return [it.w, it.h]; const off = dotOffsets(it.n, it.arr, nib * it.sc, it.side); const xs = off.map(q => q[0]), ys = off.map(q => q[1]); return [Math.max(...xs) - Math.min(...xs) + nib * it.sc * 1.1, Math.max(...ys) - Math.min(...ys) + nib * it.sc * 1.1]; };
  // where an item may go: on its letter's side, within reach of the letter, inside the disc
  const allowed = it => { const [w, h] = boxOf(it), reach = (it.kind === 'dots' ? 1.6 : 3.0) * it.sc;
    // dots stand over (or under) their letter's centre and close to it; vowels stay roughly over their letter
    if (it.kind === 'dots' && (Math.abs(it.x - it.ax) > 0.35 * it.sc || Math.abs(it.y - it.ay) > 1.4 * it.sc)) return false;
    if (it.kind === 'mark' && Math.abs(it.x - (it.lx0 + it.lx1) / 2) > (it.lx1 - it.lx0) / 2 + 1.0 * it.sc) return false;
    if (it.kind === 'mark' && o.markReach && (it.side > 0 ? it.y - h / 2 - Math.max(it.top, it.ay - h / 2 - 0.5 * it.sc) : Math.min(it.bot, it.ay + h / 2) - (it.y + h / 2)) > o.markReach * it.sc) return false; // a vowel stays close to its letter
    if (it.x < it.lx0 - reach || it.x > it.lx1 + reach) return false;
    if (it.side > 0 ? it.y - h / 2 < Math.min(it.top, it.ay - h / 2) - (it.kind === 'dots' ? 1.2 : 0.2) * it.sc : it.y + h / 2 > Math.max(it.bot, it.ay + h / 2) + (it.kind === 'dots' ? 1.2 : 0.2) * it.sc) return false;
    return hyp(it.x - D.cx, it.y - D.cy) + Math.hypot(w, h) / 2 < RD; };
  // gaps: on a coarse grid inside the disc, the distance to the nearest ink or mark
  const cells = []; for (let gy = D.cy - RD + 0.7; gy < D.cy + RD; gy += 1.4) for (let gx = D.cx - RD * OV + 0.7; gx < D.cx + RD * OV; gx += 1.4) if (hyp(gx - D.cx, gy - D.cy) < RD - 0.7) { const ix = Math.round(X(gx)), iy = Math.round(Y(gy)); cells.push([gx, gy, ix >= 0 && iy >= 0 && ix < Wd && iy < Hd ? dist[iy * Wd + ix] / K : 0]); }
  const gapCost = () => { let e2 = 0; for (const [gx, gy, d0] of cells) { let d = d0; for (const it of items) { const [w, h] = boxOf(it); d = Math.min(d, Math.max(0, Math.hypot(gx - it.x, gy - it.y) - Math.hypot(w, h) / 2)); } if (d > 1.6) e2 += (d - 1.6) ** 2; } return e2 / Math.max(1, cells.length); };
  const itemCost = it => { const [w, h] = boxOf(it); return 30 * inkHits(it.x, it.y, w + 0.5, h + 0.5) + 0.5 * ((it.x - it.ax) ** 2 + (it.y - it.ay) ** 2) / (it.sc * it.sc); };
  const pairCost = () => { let c = 0; for (let a = 0; a < items.length; a++) for (let b = a + 1; b < items.length; b++) { const A = items[a], B = items[b], [wa, ha] = boxOf(A), [wb, hb] = boxOf(B); const ox2 = Math.min(A.x + wa / 2, B.x + wb / 2) - Math.max(A.x - wa / 2, B.x - wb / 2) + 0.4, oy2 = Math.min(A.y + ha / 2, B.y + hb / 2) - Math.max(A.y - ha / 2, B.y - hb / 2) + 0.4; if (ox2 > 0 && oy2 > 0) c += 40 * ox2 * oy2; } return c; };
  // a vowel on the same side of the same letter as its dots sits beyond them, further from the letter
  const orderCost = () => { let c = 0; items.forEach(v => { if (v.kind !== 'mark') return; items.forEach(d => { if (d.kind !== 'dots' || d.key !== v.key || d.side !== v.side) return;
    const [, hv] = boxOf(v), [, hd] = boxOf(d), gap = v.side > 0 ? (v.y - hv / 2) - (d.y + hd / 2) : (d.y - hd / 2) - (v.y + hv / 2); if (gap < 0.2) c += 60 * (0.2 - gap) + 20; }); }); return c; };
  const energy = () => items.reduce((a, it) => a + itemCost(it), 0) + pairCost() + orderCost() + 8 * gapCost();
  // start from the plain positions, nudged into free space, then search
  let sd = 12345; const R = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  items.forEach(v => { if (v.kind !== 'mark') return; const d = items.find(q => q.kind === 'dots' && q.key === v.key && q.side === v.side); if (!d) return; const [, hd] = boxOf(d);
    if (v.side > 0) { v.y = v.ay = Math.max(v.ay, d.y + hd / 2 + v.h / 2 + 0.35); } else { v.y = v.ay = Math.min(v.ay, d.y - hd / 2 - v.h / 2 - 0.35); } });
  items.forEach(it => { if (!allowed(it)) { it.x = it.ax; it.y = it.ay; } });
  let E = energy(), T = 6; const iters = o.markIters || 2500;
  for (let t = 0; t < iters && items.length; t++) {
    const it = items[Math.floor(R() * items.length)], old = { x: it.x, y: it.y, arr: it.arr };
    if (it.kind === 'dots' && R() < 0.2 && it.arrs.length > 1) it.arr = it.arrs[Math.floor(R() * it.arrs.length)];
    else { const s = (T > 1 ? 1.2 : 0.5) * it.sc; it.x += (R() - 0.5) * 2 * s; it.y += (R() - 0.5) * 2 * s; }
    if (!allowed(it)) { Object.assign(it, old); continue; }
    const E2 = energy(); if (E2 <= E || R() < Math.exp((E - E2) / T)) E = E2; else Object.assign(it, old);
    T = Math.max(0.02, T * Math.pow(0.02 / 6, 1 / iters));
  }
  // ornaments: tirfil and tirnak in the largest gaps that remain, as many as the density asks for
  const fillers = [];
  if (o.ornaments) {
    const density = o.density ?? 0.5, thresh = 3.2 - 1.6 * density, maxN = Math.round(2 + 10 * density);
    for (let n2 = 0; n2 < maxN; n2++) {
      let best = null; for (const [gx, gy, d0] of cells) { let d = d0; for (const it of items.concat(fillers)) { const [w, h] = it.kind ? boxOf(it) : [it.w, it.h]; d = Math.min(d, Math.max(0, Math.hypot(gx - it.x, gy - it.y) - Math.hypot(w, h) / 2)); } if (!best || d > best[2]) best = [gx, gy, d]; }
      if (!best || best[2] < thresh) break;
      const m = o.ornStyle === 'trefoil' ? 'tirfil' : 'plume', [w, h] = ORN_SIZE[m], /* only the trefoil: the tirnak looked like a stray fatha */ sz = Math.min(0.85, best[2] / 2.8); // ornaments stay about the size of a vowel mark
      fillers.push({ m, x: best[0], y: best[1], w: w * sz, h: h * sz, sz });
    }
  }
  // draw: vowels and ornaments with a third of the pen, dots as rhombs of the full pen
  const strokes = [], dots = [];
  items.forEach(it => {
    const tint = it.key != null ? (r.groups[+String(it.key).split(':')[0]] || {}).tint : undefined;
    if (it.kind === 'dots') { dotOffsets(it.n, it.arr, nib * it.sc, it.side).forEach(([dx, dy]) => dots.push([it.x + dx, it.y + dy, it.sc, 0, tint])); return; }
    const shapes = it.kind === 'orn' ? ORN_SHAPES[it.m] : MARK_SHAPES[it.m], s2 = it.kind === 'orn' ? it.sc : ms * it.sc;
    (shapes || []).forEach(sh => strokes.push({ tint, ang: 70, nib: nib * (o.markPen || 0.34) * it.sc * (it.kind === 'orn' ? 1.3 : 1), s: sampleStroke(sh.map(([a2, b2, ww, c]) => [it.x + a2 * s2, it.y + b2 * s2, ww ?? 1, c])) }));
  });
  fillers.forEach(f => ORN_SHAPES[f.m].forEach(sh => strokes.push({ ang: 70, nib: nib * 0.42 * f.sz, s: sampleStroke(sh.map(([a2, b2, ww, c]) => [f.x + a2 * f.sz, f.y + b2 * f.sz, ww ?? 1, c])) })));
  return { strokes, dots, count: items.length, fillers: fillers.length, E, items: items.map(it => { const [w, h] = boxOf(it); return { kind: it.kind, x: it.x, y: it.y, w, h }; }) };
}

// ================= IZNIK BACKDROP =================
// A Penrose rhomb tiling (Robinson-triangle subdivision from a ten-triangle "sun", so it has exact 5-fold rotational
// symmetry about its centre and never repeats), dressed as Iznik tilework: cobalt vines along the tile edges (continuous
// across the field because edges meet at vertices), rosettes where five or ten edges meet, small stars and leaves inside
// the tiles, and recursive curling tendrils. Square ceramic joints can be drawn over the top.
const PHI = (1 + Math.sqrt(5)) / 2;
function penrose(levels, R) {
  let tris = [];
  for (let i = 0; i < 10; i++) {
    let B = [R * Math.cos((2 * i - 1) * Math.PI / 10), R * Math.sin((2 * i - 1) * Math.PI / 10)], C = [R * Math.cos((2 * i + 1) * Math.PI / 10), R * Math.sin((2 * i + 1) * Math.PI / 10)];
    if (i % 2 === 0) [B, C] = [C, B];
    tris.push([0, [0, 0], B, C]);
  }
  for (let l = 0; l < levels; l++) {
    const out = [];
    tris.forEach(([c, A, B, C]) => {
      if (c === 0) { const P = [A[0] + (B[0] - A[0]) / PHI, A[1] + (B[1] - A[1]) / PHI]; out.push([0, C, P, B], [1, P, C, A]); }
      else { const Q = [B[0] + (A[0] - B[0]) / PHI, B[1] + (A[1] - B[1]) / PHI], Rr = [B[0] + (C[0] - B[0]) / PHI, B[1] + (C[1] - B[1]) / PHI]; out.push([1, Rr, C, A], [1, Q, Rr, B], [0, Rr, Q, A]); }
    });
    tris = out;
  }
  return tris;
}
function iznikBackdrop(S, o = {}) {
  const { levels = 5, ground = '#f4f6f7', cobalt = '#1f3f8f', turq = '#2a9d9a', red = '#b3362c', seams = true, tile = 0, cx = S / 2, cy = S / 2, reach = S * 0.75 } = o;
  const tris = penrose(levels, reach);
  const key = p => Math.round(p[0] * 10) + ',' + Math.round(p[1] * 10), P = p => [cx + p[0], cy + p[1]];
  // rhomb edges are A-B and A-C of each Robinson triangle; B-C is a rhomb's diagonal
  const edges = new Map(), deg = new Map(), verts = new Map();
  const addE = (a, b) => { const k1 = key(a), k2 = key(b), k = k1 < k2 ? k1 + '|' + k2 : k2 + '|' + k1; if (edges.has(k)) return; edges.set(k, [a, b]); [[k1, a], [k2, b]].forEach(([kk, pt]) => { deg.set(kk, (deg.get(kk) || 0) + 1); verts.set(kk, pt); }); };
  tris.forEach(([c, A, B, C]) => { addE(A, B); addE(A, C); });
  const L = Math.hypot(...[0, 1].map(i => tris[0][1][i] - tris[0][2][i])); // edge length after subdivision
  let vines = '', leaves = '', flowers = '', stars = '', tend = '';
  const f = n => n.toFixed(1);
  const leafPath = (x, y, ang, len, wid) => { const c = Math.cos(ang), s = Math.sin(ang), px = -s, py = c, tx = x + c * len, ty = y + s * len;
    return `M${f(x)} ${f(y)}Q${f(x + c * len * 0.45 + px * wid)} ${f(y + s * len * 0.45 + py * wid)} ${f(tx)} ${f(ty)}Q${f(x + c * len * 0.55 - px * wid * 0.6)} ${f(y + s * len * 0.55 - py * wid * 0.6)} ${f(x)} ${f(y)}Z`; };
  // a curling tendril, recursively sprouting smaller curls (the "fractal" part)
  const tendril = (x, y, ang, len, turn, depth) => {
    let d = `M${f(x)} ${f(y)}`, px = x, py = y, a = ang; const steps = 14;
    for (let i = 1; i <= steps; i++) { a += turn * (0.5 + i / steps * 1.6) / steps * 2.2; px += Math.cos(a) * len / steps; py += Math.sin(a) * len / steps; d += `L${f(px)} ${f(py)}`;
      if (depth > 0 && i === Math.round(steps * 0.45)) tend += tendril(px, py, a - turn * 0.9, len * 0.5, -turn, depth - 1); }
    tend += `<path d="${d}" fill="none" stroke="${cobalt}" stroke-width="${f(Math.max(0.7, len * 0.045))}" stroke-linecap="round"/>`;
    leaves += `<path d="${leafPath(px, py, a, len * 0.32, len * 0.1)}" fill="${depth % 2 ? turq : cobalt}"/>`;
    return '';
  };
  // a saz leaf: long and curved, smooth on one side, serrated on the other
  const saz = (x, y, ang, len, wid, fill, bend = 0.25) => { const c = Math.cos(ang), s = Math.sin(ang), px = -s, py = c; let d = `M${f(x)} ${f(y)}`;
    const N = 9; for (let i = 1; i <= N; i++) { const t2 = i / N, w = wid * Math.sin(Math.PI * Math.min(1, t2 * 1.1)) * (i % 2 ? 1 : 0.62), cv = Math.sin(t2 * Math.PI) * bend * len; d += `L${f(x + c * len * t2 + px * (w + cv))} ${f(y + s * len * t2 + py * (w + cv))}`; }
    for (let i = N - 1; i >= 1; i--) { const t2 = i / N, w = wid * 0.55 * Math.sin(Math.PI * t2), cv = Math.sin(t2 * Math.PI) * bend * len; d += `L${f(x + c * len * t2 + px * (cv - w))} ${f(y + s * len * t2 + py * (cv - w))}`; }
    return `<path d="${d}Z" fill="${fill}"/>`; };
  edges.forEach(([a, b]) => {
    const [x1, y1] = P(a), [x2, y2] = P(b), dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy), ang = Math.atan2(dy, dx);
    // the bulge side depends only on the edge's direction, so the decoration keeps the tiling's 5-fold symmetry
    const idx = ((Math.round(ang / (Math.PI / 5)) % 10) + 10) % 10, sg = idx % 2 ? 1 : -1, nx = -dy / len * sg, ny = dx / len * sg;
    const mx = (x1 + x2) / 2 + nx * len * 0.18, my = (y1 + y2) / 2 + ny * len * 0.18;
    vines += `<path d="M${f(x1)} ${f(y1)}Q${f(mx)} ${f(my)} ${f(x2)} ${f(y2)}"/>`;
    const at = t2 => [(1 - t2) * (1 - t2) * x1 + 2 * (1 - t2) * t2 * mx + t2 * t2 * x2, (1 - t2) * (1 - t2) * y1 + 2 * (1 - t2) * t2 * my + t2 * t2 * y2];
    // saz leaves leaning off the vine, alternating sides
    [[0.28, -1], [0.62, 1]].forEach(([t2, side], j) => { const [qx, qy] = at(t2), ta = ang + side * 0.95 * sg + (side > 0 ? Math.PI : 0);
      leaves += saz(qx, qy, ta, len * 0.34, len * 0.07, j ? turq : cobalt, 0.18 * side); });
    tendril(mx, my, Math.atan2(ny, nx), len * 0.36, sg * 1.0, 2);
  });
  // vertices: layered hatayi flowers where 5 or 10 edges meet, tulip buds elsewhere (pointing away from the centre)
  verts.forEach((pt, k) => {
    const [x, y] = P(pt), d = deg.get(k);
    if (d >= 5) {
      const r = L * 0.27, petals = d >= 10 ? 10 : 5; let outer = '', inner = '';
      for (let i = 0; i < petals; i++) { const a2 = i / petals * 2 * Math.PI - Math.PI / 2;
        outer += `<path d="${leafPath(x, y, a2, r * 1.15, r * 0.42)}" fill="${cobalt}" stroke="${ground}" stroke-width="${f(r * 0.06)}"/>`;
        inner += `<path d="${leafPath(x, y, a2 + Math.PI / petals, r * 0.62, r * 0.22)}" fill="${turq}"/>`; }
      if (d >= 10) { let sd = ''; for (let i = 0; i < 20; i++) { const a2 = i / 20 * 2 * Math.PI - Math.PI / 2, rr = i % 2 ? L * 0.36 : L * 0.55; sd += (i ? 'L' : 'M') + f(x + Math.cos(a2) * rr) + ' ' + f(y + Math.sin(a2) * rr); }
        flowers += `<path d="${sd}Z" fill="${ground}" stroke="${turq}" stroke-width="${f(L * 0.02)}"/>`; }
      flowers += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r * 1.2)}" fill="${ground}"/>${outer}${inner}<circle cx="${f(x)}" cy="${f(y)}" r="${f(r * 0.24)}" fill="${red}" stroke="${ground}" stroke-width="${f(r * 0.06)}"/>`;
    } else {
      const a2 = Math.atan2(y - cy, x - cx), r = L * 0.13;
      flowers += `<path d="${leafPath(x, y, a2 - 0.45, r * 1.5, r * 0.5)}${leafPath(x, y, a2 + 0.45, r * 1.5, r * 0.5)}" fill="${cobalt}"/><path d="${leafPath(x, y, a2, r * 1.8, r * 0.55)}" fill="${red}"/>`;
    }
  });
  // small outlined five-pointed stars at the centres of the thin rhombs
  tris.forEach(([c, A, B, C]) => { if (c !== 0) return; const [x, y] = P([(A[0] + B[0] + C[0]) / 3, (A[1] + B[1] + C[1]) / 3]), r = L * 0.07; let d = '';
    for (let i = 0; i < 10; i++) { const a2 = i / 10 * 2 * Math.PI - Math.PI / 2, rr = i % 2 ? r * 0.42 : r; d += (i ? 'L' : 'M') + f(x + Math.cos(a2) * rr) + ' ' + f(y + Math.sin(a2) * rr); }
    stars += `<path d="${d}Z" fill="${ground}" stroke="${cobalt}" stroke-width="${f(r * 0.18)}"/>`; });
  let joints = '';
  if (seams) { const T = tile || S / 6; for (let v = T; v < S; v += T) joints += `<path d="M${f(v)} 0V${f(S)}M0 ${f(v)}H${f(S)}"/>`; joints = `<g stroke="#c9d1d6" stroke-width="${f(S / 700)}">${joints}</g>`; }
  return `<rect width="${S}" height="${S}" fill="${ground}"/><g fill="none" stroke="${cobalt}" stroke-width="${f(Math.max(0.8, L * 0.028))}" stroke-linecap="round">${vines}</g>${tend}${leaves}${stars}${flowers}${joints}`;
}
let MAX_COUNTER = 9;

// ================= COUNTERS =================
// The enclosed spaces inside letters (heh, waw, mim, qaf, fa, sad, tah loops), found on a raster of the ink and traced
// into outlines, so they can be filled with colour as on the Topkapi tile bands (turquoise inside white letters).
function findCounters(strokes, nib, X0, Y0, U, W, H, MX, MY, grow = 0.25) {
  // rasterise the ink at U px per unit over a box [X0, X0 + W] x [Y0 - H, Y0]
  const K = 4, Wp = Math.ceil(W * K), Hp = Math.ceil(H * K), cv = document.createElement('canvas'); cv.width = Wp; cv.height = Hp; const c2 = cv.getContext('2d'); c2.fillStyle = '#000';
  const X = x => (x - X0) * K, Y = y => (Y0 - y) * K;
  strokes.forEach(s => c2.fill(new Path2D(nibPath(s.s, s.nib || nib, s.ang, X, Y))));
  const px = c2.getImageData(0, 0, Wp, Hp).data, ink = new Uint8Array(Wp * Hp); for (let i = 0; i < Wp * Hp; i++) ink[i] = px[i * 4 + 3] > 90 ? 1 : 0;
  // flood the outside; anything empty that the flood cannot reach is a counter
  const seen = new Uint8Array(Wp * Hp), st = []; for (let x = 0; x < Wp; x++) { st.push(x, (Hp - 1) * Wp + x); } for (let y = 0; y < Hp; y++) { st.push(y * Wp, y * Wp + Wp - 1); }
  while (st.length) { const i = st.pop(); if (seen[i] || ink[i]) continue; seen[i] = 1; const x = i % Wp, y = (i - x) / Wp; if (x > 0) st.push(i - 1); if (x < Wp - 1) st.push(i + 1); if (y > 0) st.push(i - Wp); if (y < Hp - 1) st.push(i + Wp); }
  // each enclosed region, traced as row runs (merged into one path of rectangles; small specks ignored)
  const reg = new Int32Array(Wp * Hp).fill(-1), paths = []; let nreg = 0;
  for (let i = 0; i < Wp * Hp; i++) { if (ink[i] || seen[i] || reg[i] >= 0) continue; const q = [i], cells = []; reg[i] = nreg;
    while (q.length) { const j = q.pop(); cells.push(j); const x = j % Wp, y = (j - x) / Wp; [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([a, b]) => { const xx = x + a, yy = y + b; if (xx < 0 || yy < 0 || xx >= Wp || yy >= Hp) return; const k2 = yy * Wp + xx; if (!ink[k2] && !seen[k2] && reg[k2] < 0) { reg[k2] = nreg; q.push(k2); } }); }
    if (cells.length < K * K * 0.6 || cells.length > K * K * (MAX_COUNTER || 9)) { nreg++; continue; } // a letter's counter, not the space a great bowl encloses
    // outline by marching squares would be smoother; row runs are enough at this resolution, drawn with a slight blur-free overlap
    const rows = new Map(); cells.forEach(j => { const x = j % Wp, y = (j - x) / Wp; if (!rows.has(y)) rows.set(y, []); rows.get(y).push(x); });
    let d = ''; rows.forEach((xs, y) => { xs.sort((a, b) => a - b); let s0 = xs[0], prev = xs[0]; for (let t = 1; t <= xs.length; t++) { if (t < xs.length && xs[t] === prev + 1) { prev = xs[t]; continue; }
      const ux0 = X0 + s0 / K - grow, ux1 = X0 + (prev + 1) / K + grow, uy0 = Y0 - y / K + grow * 0.3, uy1 = Y0 - (y + 1) / K - grow * 0.3; d += `M${MX(ux0).toFixed(1)} ${MY(uy0).toFixed(1)}H${MX(ux1).toFixed(1)}V${MY(uy1).toFixed(1)}H${MX(ux0).toFixed(1)}Z`; if (t < xs.length) { s0 = xs[t]; prev = xs[t]; } } });
    paths.push(d); nreg++; }
  return paths; // in unit coordinates (y up); the caller maps them
}

// ================= INSCRIPTION BAND =================
// A horizontal frieze in the manner of the Topkapi tile bands: white letters on cobalt, turquoise in the counters,
// between narrow floral borders.
function renderBand(r, f, o = {}) {
  const { U = 10, nib = 1.3, field = '#1f3f8f', ink = '#f7f8f6', counter = '#2aa6a0', border = true } = o;
  const strokes = [], dots = [];
  r.shapes.forEach((S, i) => S.b.strokes.forEach(s => strokes.push({ ...s, s: s.s.map(q => ({ x: q.x + r.st[i].x, y: q.y + r.st[i].y, w: q.w })) })));
  (f.solved ? f.solved.strokes : []).forEach(s => strokes.push(s));
  (f.solved ? f.solved.dots : []).forEach(d => dots.push(d));
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; strokes.forEach(s => s.s.forEach(q => { x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); }));
  dots.forEach(([a, b]) => { x0 = Math.min(x0, a); x1 = Math.max(x1, a); y0 = Math.min(y0, b); y1 = Math.max(y1, b); });
  const padX = 3, padY = 1.6, bh = (y1 - y0 + 2 * padY), stripH = border ? bh * 0.16 : 0, W = (x1 - x0 + 2 * padX) * U, Hb = bh * U, Hs = stripH * U, H = Hb + 2 * Hs;
  const X = x => (x - x0 + padX) * U, Y = y => Hs + (y1 + padY - y) * U;
  const letters = strokes.map(s => nibPath(s.s, s.nib || nib, s.ang, X, Y)).join('') + dots.map(([a, b, sc]) => dotPath(a, b, nib * (sc || 1), o.ang || 70, X, Y)).join('');
  const holes = findCounters(strokes, nib, x0 - 1, y1 + 1, U, x1 - x0 + 2, y1 - y0 + 2, X, Y).join('');
  let strips = '';
  if (border) { const P2 = Hs * 4, uid = 'bp' + Math.round(Math.random() * 1e9); strips += `<defs><pattern id="${uid}" patternUnits="userSpaceOnUse" width="${P2.toFixed(1)}" height="${P2.toFixed(1)}"><svg viewBox="0 0 600 600" width="${P2.toFixed(1)}" height="${P2.toFixed(1)}">${iznikField(600, { fold: o.fold || 8, density: 2, seams: false, ground: '#eef2f4' })}</svg></pattern></defs>`;
    [0, Hs + Hb].forEach(top => { strips += `<rect x="0" y="${top.toFixed(1)}" width="${W.toFixed(1)}" height="${Hs.toFixed(1)}" fill="url(#${uid})"/>`; });
    strips += `<rect x="0" y="${Hs.toFixed(1)}" width="${W.toFixed(1)}" height="${(U * 0.25).toFixed(1)}" fill="#2aa6a0"/><rect x="0" y="${(Hs + Hb - U * 0.25).toFixed(1)}" width="${W.toFixed(1)}" height="${(U * 0.25).toFixed(1)}" fill="#2aa6a0"/>`; }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W.toFixed(0)} ${H.toFixed(0)}" width="${W.toFixed(0)}" height="${H.toFixed(0)}"><rect width="100%" height="100%" fill="#eef2f4"/><rect x="0" y="${Hs.toFixed(1)}" width="${W.toFixed(1)}" height="${Hb.toFixed(1)}" fill="${field}"/>${strips}<path d="${holes}" fill="${counter}"/><path d="${letters}" fill="${ink}"/></svg>`;
}

// ================= MULTIGRID TILINGS =================
// de Bruijn's multigrid: N families of parallel lines at angles pi*j/N give a quasi-periodic rhomb tiling with exact
// 2N-fold symmetry about the centre. N = 4 gives the 8-fold Ammann-Beenker tiling (45 degrees), N = 6 a 12-fold
// dodecagonal tiling (30 degrees), N = 5 the 10-fold Penrose-type tiling.
function multigrid(N, reach, edge) {
  const e = [...Array(N)].map((_, j) => [Math.cos(Math.PI * j / N), Math.sin(Math.PI * j / N)]), g = 0.5 + 1e-7, tiles = [];
  const Kmax = Math.ceil(reach / edge / 1.2) + 2;
  for (let r = 0; r < N; r++) for (let s = r + 1; s < N; s++) {
    const det = e[r][0] * e[s][1] - e[r][1] * e[s][0];
    for (let kr = -Kmax; kr <= Kmax; kr++) for (let ks = -Kmax; ks <= Kmax; ks++) {
      const a = kr + g, b = ks + g, px = (a * e[s][1] - b * e[r][1]) / det, py = (b * e[r][0] - a * e[s][0]) / det;
      const K = e.map(([ex, ey], j) => (j === r ? kr : j === s ? ks : Math.ceil(px * ex + py * ey - g)));
      const V = (da, db) => { let x = 0, y = 0; K.forEach((k, j) => { const kk = k + (j === r ? da : 0) + (j === s ? db : 0); x += kk * e[j][0]; y += kk * e[j][1]; }); return [x * edge, y * edge]; };
      const q = [V(0, 0), V(1, 0), V(1, 1), V(0, 1)], cx = q.reduce((a2, p) => a2 + p[0], 0) / 4, cy = q.reduce((a2, p) => a2 + p[1], 0) / 4;
      if (Math.hypot(cx, cy) < reach) tiles.push({ q, angle: Math.acos(Math.abs(e[r][0] * e[s][0] + e[r][1] * e[s][1])) });
    }
  }
  return tiles;
}
// the Iznik dressing for any rhomb tiling, symmetric under rotation about the centre
function iznikField(S, o = {}) {
  const { fold = 8, density = 3, ground = '#f4f6f7', cobalt = '#1f3f8f', turq = '#2a9d9a', red = '#b3362c', seams = true, tile = 0 } = o, N = fold / 2;
  const cx = o.cx ?? S / 2, cy = o.cy ?? S / 2, reach = o.reach || S * 0.75, L = S / (density * 6.5);
  const tiles = multigrid(N, reach, L), f = n => n.toFixed(1), P = p => [cx + p[0], cy + p[1]];
  const key = p => Math.round(p[0] * 20) + ',' + Math.round(p[1] * 20), edges = new Map(), deg = new Map(), verts = new Map();
  tiles.forEach(t => t.q.forEach((a, i) => { const b = t.q[(i + 1) % 4], k1 = key(a), k2 = key(b), k = k1 < k2 ? k1 + '|' + k2 : k2 + '|' + k1; if (edges.has(k)) return; edges.set(k, [a, b]); [[k1, a], [k2, b]].forEach(([kk, pt]) => { deg.set(kk, (deg.get(kk) || 0) + 1); verts.set(kk, pt); }); }));
  const leafPath = (x, y, ang, len, wid) => { const c = Math.cos(ang), s = Math.sin(ang), px = -s, py = c, tx = x + c * len, ty = y + s * len;
    return `M${f(x)} ${f(y)}Q${f(x + c * len * 0.45 + px * wid)} ${f(y + s * len * 0.45 + py * wid)} ${f(tx)} ${f(ty)}Q${f(x + c * len * 0.55 - px * wid * 0.6)} ${f(y + s * len * 0.55 - py * wid * 0.6)} ${f(x)} ${f(y)}Z`; };
  const saz = (x, y, ang, len, wid, fill, bend) => { const c = Math.cos(ang), s = Math.sin(ang), px = -s, py = c; let d = `M${f(x)} ${f(y)}`; const n = 9;
    for (let i = 1; i <= n; i++) { const t2 = i / n, w = wid * Math.sin(Math.PI * Math.min(1, t2 * 1.1)) * (i % 2 ? 1 : 0.62), cv = Math.sin(t2 * Math.PI) * bend * len; d += `L${f(x + c * len * t2 + px * (w + cv))} ${f(y + s * len * t2 + py * (w + cv))}`; }
    for (let i = n - 1; i >= 1; i--) { const t2 = i / n, w = wid * 0.55 * Math.sin(Math.PI * t2), cv = Math.sin(t2 * Math.PI) * bend * len; d += `L${f(x + c * len * t2 + px * (cv - w))} ${f(y + s * len * t2 + py * (cv - w))}`; }
    return `<path d="${d}Z" fill="${fill}"/>`; };
  let vines = '', leaves = '', tend = '', flowers = '', stars = '';
  const tendril = (x, y, ang, len, turn, depth) => { let d = `M${f(x)} ${f(y)}`, px = x, py = y, a = ang; const steps = 12;
    for (let i = 1; i <= steps; i++) { a += turn * (0.5 + i / steps * 1.6) / steps * 2.2; px += Math.cos(a) * len / steps; py += Math.sin(a) * len / steps; d += `L${f(px)} ${f(py)}`; if (depth > 0 && i === 5) tendril(px, py, a - turn * 0.9, len * 0.5, -turn, depth - 1); }
    tend += `<path d="${d}" fill="none" stroke="${cobalt}" stroke-width="${f(Math.max(0.6, len * 0.045))}" stroke-linecap="round"/>`; leaves += `<path d="${leafPath(px, py, a, len * 0.32, len * 0.1)}" fill="${depth % 2 ? turq : cobalt}"/>`; };
  edges.forEach(([a0, b0]) => {
    // orient each edge outward from the centre and always bulge to its left: invariant under any rotation about the centre
    let [a, b] = Math.hypot(...a0) <= Math.hypot(...b0) - 1e-6 ? [a0, b0] : [b0, a0];
    if (Math.abs(Math.hypot(...a0) - Math.hypot(...b0)) < 1e-6) { const ca = Math.atan2(a0[1], a0[0]), cb = Math.atan2(b0[1], b0[0]); if (((cb - ca + 3 * Math.PI) % (2 * Math.PI)) - Math.PI < 0) [a, b] = [b0, a0]; else [a, b] = [a0, b0]; }
    const [x1, y1] = P(a), [x2, y2] = P(b), dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy), ang = Math.atan2(dy, dx), nx = -dy / len, ny = dx / len;
    const mx = (x1 + x2) / 2 + nx * len * 0.18, my = (y1 + y2) / 2 + ny * len * 0.18;
    vines += `<path d="M${f(x1)} ${f(y1)}Q${f(mx)} ${f(my)} ${f(x2)} ${f(y2)}"/>`;
    const at = t2 => [(1 - t2) * (1 - t2) * x1 + 2 * (1 - t2) * t2 * mx + t2 * t2 * x2, (1 - t2) * (1 - t2) * y1 + 2 * (1 - t2) * t2 * my + t2 * t2 * y2];
    [[0.28, -1], [0.62, 1]].forEach(([t2, side], j) => { const [qx, qy] = at(t2); leaves += saz(qx, qy, ang + side * 0.95 + (side > 0 ? Math.PI : 0), len * 0.34, len * 0.07, j ? turq : cobalt, 0.18 * side); });
    tendril(mx, my, Math.atan2(ny, nx), len * 0.36, 1, 2);
  });
  verts.forEach((pt, k) => { const [x, y] = P(pt), d = deg.get(k);
    if (d >= Math.min(6, fold - 1)) { const r = L * 0.27, petals = d >= fold ? fold : d; let outer = '', inner = '';
      for (let i = 0; i < petals; i++) { const a2 = i / petals * 2 * Math.PI - Math.PI / 2; outer += `<path d="${leafPath(x, y, a2, r * 1.15, r * 0.4)}" fill="${cobalt}" stroke="${ground}" stroke-width="${f(r * 0.06)}"/>`; inner += `<path d="${leafPath(x, y, a2 + Math.PI / petals, r * 0.62, r * 0.2)}" fill="${turq}"/>`; }
      if (d >= fold) { let sd = ''; for (let i = 0; i < 2 * fold; i++) { const a2 = i / (2 * fold) * 2 * Math.PI - Math.PI / 2, rr = i % 2 ? L * 0.36 : L * 0.56; sd += (i ? 'L' : 'M') + f(x + Math.cos(a2) * rr) + ' ' + f(y + Math.sin(a2) * rr); } flowers += `<path d="${sd}Z" fill="${ground}" stroke="${turq}" stroke-width="${f(L * 0.02)}"/>`; }
      flowers += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r * 1.2)}" fill="${ground}"/>${outer}${inner}<circle cx="${f(x)}" cy="${f(y)}" r="${f(r * 0.24)}" fill="${red}" stroke="${ground}" stroke-width="${f(r * 0.06)}"/>`; }
    else if (d >= 3) { const a2 = Math.atan2(y - cy, x - cx), r = L * 0.13; flowers += `<path d="${leafPath(x, y, a2 - 0.45, r * 1.5, r * 0.5)}${leafPath(x, y, a2 + 0.45, r * 1.5, r * 0.5)}" fill="${cobalt}"/><path d="${leafPath(x, y, a2, r * 1.8, r * 0.55)}" fill="${red}"/>`; } });
  // small stars in the narrowest tiles, four-pointed stars in the squares
  tiles.forEach(t => { const [x, y] = P([t.q.reduce((a2, p) => a2 + p[0], 0) / 4, t.q.reduce((a2, p) => a2 + p[1], 0) / 4]); const sq = Math.abs(t.angle - Math.PI / 2) < 0.05, thin = t.angle < Math.PI / 4.5;
    if (!sq && !thin) return; const n = sq ? 4 : 5, r = L * (sq ? 0.12 : 0.07); let d = ''; for (let i = 0; i < 2 * n; i++) { const a2 = i / (2 * n) * 2 * Math.PI - Math.PI / 2 + (sq ? Math.PI / 4 : 0), rr = i % 2 ? r * 0.42 : r; d += (i ? 'L' : 'M') + f(x + Math.cos(a2) * rr) + ' ' + f(y + Math.sin(a2) * rr); }
    stars += `<path d="${d}Z" fill="${ground}" stroke="${cobalt}" stroke-width="${f(r * 0.18)}"/>`; });
  let joints = ''; if (seams) { const T = tile || S / 6; for (let v = T; v < S; v += T) joints += `<path d="M${f(v)} 0V${f(S)}M0 ${f(v)}H${f(S)}"/>`; joints = `<g stroke="#c9d1d6" stroke-width="${f(S / 700)}">${joints}</g>`; }
  return `<rect width="${S}" height="${S}" fill="${ground}"/><g fill="none" stroke="${cobalt}" stroke-width="${f(Math.max(0.7, L * 0.028))}" stroke-linecap="round">${vines}</g>${tend}${leaves}${stars}${flowers}${joints}`;
}

// ================= LETTERS FITTED TO A MASTER =================
// Waw, initial ain and medial mim fitted, and initial and medial hah rebuilt from the master's centreline, to the gold jali panel in the photo (analysis by synthesis),
// kept at the master's letter-to-pen proportion.
const FITTED = {"waw": {"fin": {"s": [{"pts": [[0.0, 0.0, 1], [-2.3, 0.17, 1], [-2.38, 0.89, 1], [-2.12, 1.28, 1], [-1.2, 1.22, 1], [-0.23, 0.32, 1], [-0.66, -0.59, 1], [-0.21, -0.93, 1], [-2.31, -2.31, 1], [-4.48, -3.59, 1], [-5.64, -3.9, 1], [-6.46, -3.39, 1], [-6.55, -2.26, 1], [-6.36, -1.2, 0.4]]}], "exit": null, "dotX": -2.92}}, "ain": {"ini": {"s": [{"pts": [[-1.17, 2.6, 0.55], [-2.97, 2.86, 1], [-4.28, 2.48, 1], [-4.27, 1.98, 1], [-4.23, 1.03, 1], [-3.41, -0.13, 1], [-2.12, -0.4, 1], [-0.98, -0.02, 1], [0.0, 0.74, 1], [-1.78, -0.36, 1], [-3.53, -0.93, 1], [-4.58, -0.86, 1], [-5.48, 0.0, 1]]}], "exit": -5.48, "dotX": -2.98}}, "mim": {"med": {"s": [{"pts": [[0.0, 0.0, 1], [-0.71, 0.81, 1], [-1.5, 0.81, 1], [-2.39, -0.49, 1], [-1.85, -1.41, 1], [-1.06, -1.18, 1], [-0.86, -0.43, 1], [-2.18, -0.29, 1], [-3.03, 0.0, 1]]}], "exit": -3.03, "dotX": null}}, "hah": {"ini": {"dotX": -2.82, "s": [{"pts": [[0.0, 2.5, 0.25], [-0.65, 2.55, 0.7], [-1.74, 2.93, 1], [-2.82, 3.26, 1], [-4.18, 3.53, 1], [-4.99, 3.42, 1], [-5.37, 2.99, 1], [-5.48, 2.17, 1], [-5.43, 1.36, 1], [-5.16, 0.81, 1], [-4.45, 0.65, 1], [-3.37, 0.92, 1], [-2.28, 1.41, 1], [-1.19, 1.95, 1], [-0.38, 2.39, 0.35]]}, {"pts": [[-5.16, 0.81, 1], [-5.48, 0.33, 1], [-5.3975, 0.08, 1], [-6.35, 0, 1]]}], "exit": -6.35}, "med": {"dotX": -3.52, "s": [{"pts": [[0, 0, 1], [-0.35, 0.35, 1], [-0.55, 1.2, 0.8], [-1.35, 2.55, 0.6]]}, {"pts": [[-0.7, 2.5, 0.25], [-1.35, 2.55, 0.7], [-2.44, 2.93, 1], [-3.52, 3.26, 1], [-4.88, 3.53, 1], [-5.69, 3.42, 1], [-6.07, 2.99, 1], [-6.18, 2.17, 1], [-6.13, 1.36, 1], [-5.86, 0.81, 1], [-5.15, 0.65, 1], [-4.07, 0.92, 1], [-2.98, 1.41, 1], [-1.89, 1.95, 1], [-1.08, 2.39, 0.35]]}, {"pts": [[-5.86, 0.81, 1], [-6.18, 0.33, 1], [-6.1, 0.08, 1], [-7.05, 0, 1]]}], "exit": -7.05}}};

// Roundel-scale gestures fitted to the Husayn roundel in Hagia Sophia (Kazasker Mustafa Izzet): the great final nun bowl and
// the long-headed initial hah. Swapped in for roundels with useGreat(true).
const GREAT = {"nun": {"fin": {"s": [{"pts": [[0.0, 0.0, 1], [-0.41, -1.1, 1], [0.0, -3.75, 1], [1.9, -5.56, 1], [4.27, -6.15, 1], [7.54, -5.25, 1], [9.42, -3.16, 1], [9.67, -1.29, 1], [7.67, 0.63, 0.3]]}], "exit": null, "dotX": 4.45}}, "hah": {"ini": {"s": [{"pts": [[-0.61, 3.07, 0.25], [-1.46, 3.08, 0.7], [-3.02, 3.58, 1], [-4.38, 4.04, 1], [-6.28, 4.43, 1], [-7.4, 4.29, 1], [-7.87, 3.68, 1], [-8.05, 2.6, 1], [-8.36, 1.57, 1], [-8.43, 0.97, 1], [-6.91, 1.09, 1], [-4.32, 0.87, 1], [-1.6, 0.38, 1], [0.0, 0.11, 1], [-1.09, 2.74, 0.35]]}, {"pts": [[-8.96, 0.78, 1], [-8.17, -0.47, 1], [-6.99, -1.05, 1], [-8.96, 0.0, 1]]}], "exit": -8.96, "dotX": -5.41}}};
let GREAT_BACKUP = null;
function useGreat(on, which = { nun: true, hah: true, ya: false }) {
  if (on) { GREAT_BACKUP = { nun: { ...T.nun }, hah: { ...T.hah }, ya: { ...T.ya } };
    if (which.nun) T.nun = { ...T.nun, fin: JSON.parse(JSON.stringify(GREAT.nun.fin)) };
    if (which.hah) T.hah = { ...T.hah, ini: JSON.parse(JSON.stringify(GREAT.hah.ini)) };
    if (which.ya) { const g = JSON.parse(JSON.stringify(GREAT.nun.fin)), sx = which.yaWide || 1.7, sy = which.yaDeep || 0.6; // wide and low, as the master's bowl sits in its disc
      g.s.forEach(st => st.pts.forEach(p => { p[0] *= sx; p[1] *= sy; })); g.dotX = -0.9; T.ya = { ...T.ya, fin: g }; } } // the ya's marks sit where its bowl begins, beside the letter before it // the great bowl as a returning ya, wrapping back under the word
  else if (GREAT_BACKUP) { T.nun = GREAT_BACKUP.nun; T.hah = GREAT_BACKUP.hah; T.ya = GREAT_BACKUP.ya; GREAT_BACKUP = null; }
  gcache.clear();
}

// The sad (and dad) loop rebuilt from the master's dad in the Husayn roundel's blessing (رضي): a broad, open teardrop, rounded
// where the pen comes in on the right and pointed on the left before the tooth, with a counter generous enough to stay open
// under a heavy pen.
const SAD_MASTER = {"med": {"s": [{"pts": [[0, 0, 1], [0.15, 0.25, 1], [0.0, 0.47, 1], [0.4, 1.34, 1], [0.13, 2.35, 1], [-0.87, 3.02, 1], [-2.41, 3.08, 1], [-3.75, 2.41, 1], [-4.56, 1.54, 1], [-4.82, 0.94, 1], [-3.89, 0.54, 1], [-2.41, 0.4, 1], [-0.94, 0.54, 1], [-0.2, 0.8, 0.8]]}, {"pts": [[-5.17, 1.75, 0.3], [-5.27, 1.0, 0.9], [-5.37, 0.12, 1], [-5.77, 0.0, 1], [-6.27, 0.0, 1]]}], "exit": -6.27}, "ini": {"s": [{"pts": [[0.1, 1.0699999999999998, 0.5], [0.0, 0.47, 1], [0.4, 1.34, 1], [0.13, 2.35, 1], [-0.87, 3.02, 1], [-2.41, 3.08, 1], [-3.75, 2.41, 1], [-4.56, 1.54, 1], [-4.82, 0.94, 1], [-3.89, 0.54, 1], [-2.41, 0.4, 1], [-0.94, 0.54, 1], [-0.2, 0.8, 0.8]]}, {"pts": [[-5.17, 1.75, 0.3], [-5.27, 1.0, 0.9], [-5.37, 0.12, 1], [-5.77, 0.0, 1], [-6.27, 0.0, 1]]}], "exit": -6.27}};

// The fa and qaf head built from the master-fitted waw head (the same round, open loop sitting on the stroke).
const FA_MASTER_OLD = {"ini": {"s": [{"pts": [[0.25, 0.55, 0.5], [-2.64, 0.2, 1], [-2.74, 1.02, 1], [-2.44, 1.47, 1], [-1.38, 1.4, 1], [-0.26, 0.37, 1], [-0.96, 0.08, 1], [-3.14, 0.0, 1], [-4.14, 0.0, 1]]}], "exit": -4.14, "dotX": -1.37}, "med": {"s": [{"pts": [[0.0, 0.0, 1], [-2.64, 0.2, 1], [-2.74, 1.02, 1], [-2.44, 1.47, 1], [-1.38, 1.4, 1], [-0.26, 0.37, 1], [-0.96, 0.08, 1], [-3.14, 0.0, 1], [-4.14, 0.0, 1]]}], "exit": -4.14, "dotX": -1.37}};

// The fa and qaf head redrawn as a round, open loop about twice the pen width across, so its counter stays open under a heavy
// pen (the hand-drawn head filled in at roundel weight).
const FA_MASTER = {"ini": {"s": [{"pts": [[0.15, 1.15, 0.45], [-0.15, 1.55, 1], [-0.95, 2.1, 1], [-1.85, 1.85, 1], [-2.25, 1.1, 1], [-1.95, 0.35, 1], [-1.15, 0.05, 1], [-0.35, 0.2, 0.9], [-1.3, -0.02, 1], [-2.7, 0.0, 1], [-3.3, 0.0, 1]]}], "exit": -3.3, "dotX": -1.1}, "med": {"s": [{"pts": [[0, 0, 1], [0.1, 0.6, 1], [-0.15, 1.55, 1], [-0.95, 2.1, 1], [-1.85, 1.85, 1], [-2.25, 1.1, 1], [-1.95, 0.35, 1], [-1.15, 0.05, 1], [-0.35, 0.2, 0.9], [-1.3, -0.02, 1], [-2.7, 0.0, 1], [-3.3, 0.0, 1]]}], "exit": -3.3, "dotX": -1.1}};

// ================= LEARNED LETTERS =================
// Letter forms averaged from the Calliar dataset (MIT licence), from 70 hand-picked thuluth samples where there are enough instances: for each form, the most typical traced instance and its
// 25 nearest neighbours, simplified to a few control points.
const LEARNED = {"nun": {"ini": {"s": [{"pts": [[0.0, 1.81, 0.55], [-0.32, 1.51, 1], [-0.4, 0.28, 1], [-0.85, -0.27, 1], [-1.64, -0.45, 1], [-2.38, 0.0, 1]]}], "exit": -2.38, "dotX": -0.84}, "iso": {"s": [{"pts": [[0.0, 0.0, 0.55], [-0.55, 0.07, 1], [-0.12, -1.57, 1], [-0.38, -2.57, 1], [-1.53, -3.47, 1], [-3.23, -4.11, 1], [-5.1, -4.24, 1], [-6.53, -3.8, 1], [-6.89, -3.43, 1], [-7.05, -2.9, 1], [-6.92, -1.52, 0.4]]}], "exit": null, "dotX": -0.31}, "med": {"s": [{"pts": [[0.0, 0.0, 1], [-0.7, 0.76, 1], [-2.27, 0.0, 1]]}], "exit": -2.27, "dotX": -1.12}, "fin": {"s": [{"pts": [[0.0, 0.0, 1], [-0.15, -1.71, 1], [-0.64, -2.53, 1], [-1.81, -3.47, 1], [-3.5, -4.06, 1], [-4.72, -4.05, 1], [-5.71, -3.24, 1], [-5.87, -2.06, 1], [-5.46, -0.88, 0.4]]}], "exit": null, "dotX": -1.45}}, "tooth": {"fin": {"s": [{"pts": [[0.0, 0.0, 1], [-3.09, -0.81, 1], [-5.37, -0.97, 1], [-6.4, -0.44, 1], [-6.67, 0.12, 1], [-6.6, 0.71, 0.4]]}], "exit": null, "dotX": -3.77}, "ini": {"s": [{"pts": [[-0.1, 1.21, 0.55], [-0.01, 0.32, 1], [-0.25, -0.11, 1], [-0.81, -0.28, 1], [-1.4, 0.0, 1]]}], "exit": -1.4, "dotX": -0.44}, "iso": {"s": [{"pts": [[0.0, 0.0, 0.55], [-0.64, -0.14, 1], [-0.53, -1.24, 1], [-0.78, -2.39, 1], [-1.46, -2.73, 1], [-2.32, -2.62, 0.4]]}], "exit": null, "dotX": -0.47}, "med": {"s": [{"pts": [[0.0, 0.0, 1], [-0.53, 0.43, 1], [-1.84, -0.1, 1], [-2.71, 0.0, 1]]}], "exit": -2.71, "dotX": -1.33}}, "alif": {"fin": {"s": [{"pts": [[0.0, 0.0, 1], [-0.28, 1.23, 1], [-0.45, 5.52, 1], [-0.91, 9.97, 0.4]]}], "exit": null, "dotX": -0.46}, "iso": {"s": [{"pts": [[0.0, 9.07, 0.55], [-0.81, 9.91, 1], [-0.14, 2.16, 1], [-0.35, 0.0, 0.4]]}], "exit": null, "dotX": -0.43}}, "lam": {"fin": {"s": [{"pts": [[0.0, 0.0, 1], [0.45, 0.43, 1], [0.77, 1.46, 1], [0.61, 7.16, 1], [0.85, 6.98, 0.4]]}], "exit": null, "dotX": 0.67}, "iso": {"s": [{"pts": [[0.0, 0.0, 0.55], [-0.3, -0.81, 1], [-0.27, -5.84, 1], [-0.71, -7.28, 1], [-1.41, -8.51, 1], [-2.56, -9.76, 1], [-3.66, -10.21, 1], [-4.62, -10.16, 0.4]]}], "exit": null, "dotX": -0.21}, "ini": {"s": [{"pts": [[-0.05, 2.58, 0.55], [-0.32, 2.65, 1], [-0.0, 0.48, 1], [-0.25, -0.55, 1], [-0.69, -0.83, 1], [-1.22, -0.84, 1], [-1.75, -0.47, 1], [-1.97, 0.0, 1]]}], "exit": -1.97, "dotX": -0.54}, "med": {"s": [{"pts": [[0.0, 0.0, 1], [-0.41, 0.33, 1], [-0.79, 1.04, 1], [-1.47, 4.67, 1], [-1.27, 2.68, 1], [-1.48, 1.07, 1], [-2.08, 0.11, 1], [-2.73, 0.0, 1]]}], "exit": -2.73, "dotX": -1.36}}, "hah": {"med": {"s": [{"pts": [[0.0, 0.0, 1], [0.84, 0.45, 1], [3.14, 0.8, 1], [-0.39, 0.0, 1]]}], "exit": -0.39, "dotX": 1.42}, "ini": {"s": [{"pts": [[-5.06, 0.96, 0.55], [-4.17, 1.33, 1], [-1.48, 0.57, 1], [0.0, 0.47, 1], [-4.32, -0.68, 1], [-5.23, -0.44, 1], [-5.61, 0.0, 1]]}], "exit": -5.61, "dotX": -2.78}, "fin": {"s": [{"pts": [[0.0, 0.0, 1], [0.84, -0.51, 1], [1.28, -1.42, 1], [1.24, -1.98, 1], [0.76, -3.04, 1], [-0.06, -3.9, 1], [-1.1, -4.47, 1], [-2.26, -4.66, 1], [-3.41, -4.43, 1], [-4.35, -3.72, 1], [-4.64, -3.21, 1], [-4.85, -2.02, 1], [-4.53, -0.25, 1], [-3.96, 0.81, 1], [-3.18, 1.72, 1], [-0.19, 3.89, 1], [-3.28, 3.89, 1], [-4.4, 3.66, 1], [-4.58, 3.26, 1], [-3.39, 1.71, 0.4]]}], "exit": null, "dotX": -2.31}, "iso": {"s": [{"pts": [[-5.11, 0.0, 0.55], [-3.96, 0.43, 1], [0.0, -0.09, 1], [-3.99, -2.0, 1], [-5.45, -2.1, 0.4]]}], "exit": null, "dotX": -2.03}}, "ya": {"med": {"s": [{"pts": [[0.0, 0.0, 1], [-1.33, -0.2, 1], [-2.06, 0.0, 1]]}], "exit": -2.06, "dotX": -1.03}, "ini": {"s": [{"pts": [[0.0, 1.24, 0.55], [-0.21, 0.38, 1], [-0.64, -0.17, 1], [-1.34, -0.35, 1], [-1.81, 0.0, 1]]}], "exit": -1.81, "dotX": -0.64}, "iso": {"s": [{"pts": [[0.0, 0.0, 0.55], [-0.4, -0.17, 1], [-0.75, -0.94, 1], [-0.53, -2.36, 1], [-1.28, -3.09, 1], [-2.15, -3.37, 1], [-3.16, -3.3, 1], [-3.74, -2.84, 1], [-3.95, -2.17, 0.4]]}], "exit": null, "dotX": -0.49}, "fin": {"s": [{"pts": [[0.0, 0.0, 1], [1.26, -0.35, 1], [1.3, -0.67, 1], [1.09, -0.99, 1], [-0.71, -2.08, 1], [-1.62, -2.37, 1], [-2.54, -2.38, 1], [-3.29, -1.97, 1], [-3.68, -1.29, 1], [-3.64, -0.24, 1], [-3.22, 0.68, 0.4]]}], "exit": null, "dotX": -1.22}}, "ha": {"iso": {"s": [{"pts": [[0.0, 0.0, 0.55], [-1.63, -2.91, 1], [-1.45, -3.56, 1], [-0.81, -3.61, 1], [-0.43, -3.24, 1], [-0.38, -2.53, 1], [-1.45, -0.57, 0.4]]}], "exit": null, "dotX": -0.85}, "fin": {"s": [{"pts": [[0.0, 0.0, 1], [-0.33, 1.0, 1], [-0.24, 2.85, 1], [-0.49, 2.83, 1], [-0.72, 2.5, 1], [-1.45, 0.04, 1], [-1.82, -0.4, 1], [-2.31, -0.25, 1], [-2.6, 0.28, 1], [-2.7, 1.32, 1], [-2.52, 1.92, 0.4]]}], "exit": null, "dotX": -1.24}, "ini": {"s": [{"pts": [[-1.73, 3.15, 0.55], [-1.62, 3.39, 1], [-1.39, 3.4, 1], [-0.54, 2.91, 1], [-0.02, 1.99, 1], [-0.11, 1.32, 1], [-0.79, 0.81, 1], [-1.5, 0.78, 1], [-1.95, 0.96, 1], [-2.27, 1.55, 1], [-2.17, 2.0, 1], [-1.86, 2.31, 1], [-1.54, 2.26, 1], [-1.39, 1.96, 1], [-1.52, 1.26, 1], [-2.22, 0.44, 1], [-3.17, 0.0, 1]]}], "exit": -3.17, "dotX": -1.41}, "med": {"s": [{"pts": [[0.0, 0.0, 1], [-0.29, 0.38, 1], [-0.38, 1.56, 1], [-0.57, 1.7, 1], [-0.87, 1.43, 1], [-1.53, -0.97, 1], [-1.87, -1.48, 1], [-2.39, -1.53, 1], [-2.83, -1.25, 1], [-3.21, -0.51, 1], [-3.2, 0.0, 1]]}], "exit": -3.2, "dotX": -1.37}}, "fa": {"ini": {"s": [{"pts": [[-0.0, 1.26, 0.55], [-1.55, 1.55, 1], [-1.6, 1.99, 1], [-1.25, 2.52, 1], [-0.84, 2.67, 1], [-0.45, 2.47, 1], [-0.06, 1.76, 1], [-0.01, 1.13, 1], [-0.36, 0.31, 1], [-1.53, 0.0, 1]]}], "exit": -1.53, "dotX": -0.73}, "med": {"s": [{"pts": [[0.0, 0.0, 1], [-0.44, 1.11, 1], [-0.35, 1.51, 1], [-0.13, 1.64, 1], [0.2, 1.4, 1], [0.11, 0.79, 1], [-1.22, 0.0, 1]]}], "exit": -1.22, "dotX": -0.26}, "fin": {"s": [{"pts": [[0.0, 0.0, 1], [-1.21, -0.05, 1], [-1.34, 0.36, 1], [-1.14, 0.76, 1], [-0.76, 0.79, 1], [-0.31, 0.26, 1], [-0.15, -0.47, 1], [-0.39, -1.17, 1], [-1.85, -2.24, 1], [-3.38, -2.63, 1], [-4.36, -2.45, 1], [-4.9, -1.95, 1], [-5.1, -1.22, 1], [-4.9, -0.23, 0.4]]}], "exit": null, "dotX": -1.57}, "iso": {"s": [{"pts": [[-0.2, 0.0, 0.55], [-1.83, 0.16, 1], [-1.95, 0.74, 1], [-1.5, 1.47, 1], [-0.75, 1.56, 1], [-0.33, 1.09, 1], [-0.0, 0.02, 1], [-0.11, -0.86, 1], [-0.45, -1.42, 1], [-1.16, -1.95, 1], [-1.96, -2.25, 1], [-2.86, -2.22, 0.4]]}], "exit": null, "dotX": -0.83}}, "ra": {"fin": {"s": [{"pts": [[0.0, 0.0, 1], [-0.89, 0.09, 1], [-1.4, -1.28, 1], [-2.69, -2.28, 1], [-3.54, -2.22, 1], [-3.82, -1.32, 0.4]]}], "exit": null, "dotX": -1.14}, "iso": {"s": [{"pts": [[0.0, 0.0, 0.55], [-0.74, 0.39, 1], [-0.09, -1.89, 1], [-0.32, -2.51, 1], [-0.77, -3.02, 1], [-3.08, -4.54, 1], [-4.48, -5.03, 1], [-5.65, -5.21, 0.4]]}], "exit": null, "dotX": -0.41}}, "sin": {"ini": {"s": [{"pts": [[-0.09, 1.28, 0.55], [-0.05, 0.44, 1], [-0.59, 0.04, 1], [-1.1, 0.04, 1], [-1.44, 0.78, 1], [-1.91, 0.12, 1], [-2.5, -0.18, 1], [-3.37, 0.24, 1], [-5.25, 0.0, 1]]}], "exit": -5.25, "dotX": -2.23}, "iso": {"s": [{"pts": [[0.0, 0.0, 0.55], [-0.17, -1.3, 1], [-0.7, -1.77, 1], [-1.35, -1.68, 1], [-1.76, -1.02, 1], [-2.98, -2.02, 1], [-3.61, -2.03, 1], [-4.54, -1.52, 1], [-6.46, -2.31, 1], [-7.54, -2.39, 0.4]]}], "exit": null, "dotX": -1.08}, "fin": {"s": [{"pts": [[0.0, 0.0, 1], [-0.67, -0.54, 1], [-2.69, -0.83, 1], [-3.37, -1.6, 1], [-4.16, -1.95, 1], [-7.23, -2.21, 1], [-7.92, -1.97, 1], [-8.41, -1.31, 0.4]]}], "exit": null, "dotX": -2.27}, "med": {"s": [{"pts": [[0.0, 0.0, 1], [-0.53, -0.71, 1], [-1.1, -0.9, 1], [-1.42, -0.62, 1], [-1.5, -0.07, 1], [-2.45, -0.59, 1], [-3.26, -0.07, 1], [-4.91, 0.0, 1]]}], "exit": -4.91, "dotX": -2.23}}, "mim": {"med": {"s": [{"pts": [[0.0, 0.0, 1], [-0.45, -0.29, 1], [-0.28, -0.68, 1], [0.08, -0.83, 1], [0.09, -0.54, 1], [-0.45, -0.2, 1], [-1.5, -0.38, 1], [-2.21, 0.0, 1]]}], "exit": -2.21, "dotX": -0.65}, "ini": {"s": [{"pts": [[-0.98, 0.62, 0.55], [-1.08, 1.75, 1], [-0.68, 2.26, 1], [-0.06, 1.83, 1], [-0.0, 1.42, 1], [-0.23, 1.06, 1], [-2.58, 0.04, 1], [-3.88, 0.0, 1]]}], "exit": -3.88, "dotX": -1.39}, "iso": {"s": [{"pts": [[-0.97, 0.0, 0.55], [-0.47, 0.51, 1], [-0.02, 0.49, 1], [-0.05, 0.36, 1], [-1.23, -0.18, 1], [-3.97, -2.24, 1], [-4.9, -2.27, 1], [-5.38, -1.67, 0.4]]}], "exit": null, "dotX": -1.07}, "fin": {"s": [{"pts": [[0.0, 0.0, 1], [0.28, -0.83, 1], [0.63, -1.07, 1], [-0.38, -0.81, 1], [-1.46, -1.01, 1], [-5.48, -3.36, 1], [-6.17, -3.21, 1], [-6.53, -2.63, 1], [-6.63, -1.96, 1], [-6.36, -1.02, 0.4]]}], "exit": null, "dotX": -1.05}}, "dal": {"iso": {"s": [{"pts": [[-0.68, 0.0, 0.55], [-0.01, -2.92, 1], [-0.13, -3.78, 1], [-0.45, -4.34, 1], [-2.07, -5.6, 1], [-3.25, -5.83, 1], [-3.73, -5.64, 1], [-4.06, -5.23, 1], [-4.0, -3.97, 0.4]]}], "exit": null, "dotX": -0.5}, "fin": {"s": [{"pts": [[0.0, 0.0, 1], [-0.46, 1.32, 1], [-0.79, 1.5, 1], [-1.82, -0.71, 1], [-2.69, -1.8, 1], [-4.07, -2.45, 1], [-5.36, -2.22, 0.4]]}], "exit": null, "dotX": -1.07}}, "sad": {"ini": {"s": [{"pts": [[-4.39, -1.06, 0.55], [-3.69, 0.4, 1], [-2.71, 1.69, 1], [-1.62, 2.37, 1], [-0.69, 2.35, 1], [-0.04, 1.72, 1], [-0.08, 1.13, 1], [-0.73, 0.45, 1], [-1.6, 0.03, 1], [-3.49, -0.22, 1], [-4.62, 0.45, 1], [-5.86, 0.05, 1], [-6.73, 0.0, 1]]}], "exit": -6.73, "dotX": -2.93}, "iso": {"s": [{"pts": [[-6.6, 0.0, 0.55], [-5.63, 0.1, 1], [-3.86, 0.83, 1], [-2.68, 1.03, 1], [-1.66, 1.45, 1], [-0.26, 2.49, 1], [-0.02, 2.91, 1], [-0.07, 3.27, 1], [-0.47, 3.49, 1], [-1.07, 3.48, 1], [-2.65, 2.62, 1], [-4.02, 0.9, 1], [-5.19, -1.3, 0.4]]}], "exit": null, "dotX": -2.94}, "med": {"s": [{"pts": [[0.0, 0.0, 1], [0.49, 1.18, 1], [1.12, 2.01, 1], [1.72, 2.52, 1], [2.47, 2.76, 1], [3.2, 2.55, 1], [3.44, 1.9, 1], [3.15, 1.22, 1], [2.32, 0.53, 1], [1.02, 0.18, 1], [-0.25, 0.43, 1], [-1.88, 0.0, 1]]}], "exit": -1.88, "dotX": 1.16}, "fin": {"s": [{"pts": [[0.0, 0.0, 1], [0.34, 1.72, 1], [0.92, 2.67, 1], [1.53, 3.04, 1], [2.71, 2.94, 1], [3.23, 2.62, 1], [3.32, 2.35, 1], [1.55, 2.58, 1], [-0.91, 0.39, 0.4]]}], "exit": null, "dotX": 1.38}}, "ain": {"ini": {"s": [{"pts": [[-1.11, 2.74, 0.55], [-2.41, 3.04, 1], [-3.68, 2.75, 1], [-4.15, 1.94, 1], [-3.95, 0.98, 1], [-3.3, 0.23, 1], [-2.07, -0.2, 1], [-1.09, -0.12, 1], [-0.01, 0.43, 1], [-1.73, -0.41, 1], [-3.33, -0.87, 1], [-4.29, -0.81, 1], [-5.16, 0.0, 1]]}], "exit": -5.16, "dotX": -2.57}, "fin": {"s": [{"pts": [[0.0, 0.0, 1], [-2.3, 1.53, 1], [-2.14, 2.01, 1], [-1.27, 2.48, 1], [-0.37, 2.55, 1], [0.08, 2.2, 1], [0.07, 1.48, 1], [-0.49, 0.53, 1], [-1.33, -0.3, 1], [-2.32, -0.93, 1], [-3.36, -1.22, 1], [-4.22, -1.16, 0.4]]}], "exit": null, "dotX": -1.45}, "iso": {"s": [{"pts": [[-1.21, 0.0, 0.55], [-2.71, 0.17, 1], [-3.79, -0.17, 1], [-4.31, -0.69, 1], [-4.59, -1.39, 1], [-4.4, -2.46, 1], [-3.64, -3.24, 1], [-2.56, -3.5, 1], [-1.41, -3.37, 1], [0.0, -2.74, 1], [-3.71, -4.68, 1], [-4.82, -5.0, 1], [-5.77, -5.02, 0.4]]}], "exit": null, "dotX": -3.13}, "med": {"s": [{"pts": [[0.0, 0.0, 1], [-1.71, 1.2, 1], [-1.58, 1.47, 1], [-0.26, 1.84, 1], [0.08, 1.58, 1], [-0.19, 0.9, 1], [-1.02, 0.31, 1], [-2.46, -0.2, 1], [-3.96, -0.49, 1], [-5.47, -0.51, 1], [-6.35, -0.38, 1], [-7.08, 0.0, 1]]}], "exit": -7.08, "dotX": -2.25}}, "waw": {"iso": {"s": [{"pts": [[-0.1, 0.0, 0.55], [-1.45, 0.37, 1], [-1.46, 0.83, 1], [-1.18, 1.21, 1], [-0.73, 1.3, 1], [-0.18, 0.87, 1], [0.0, 0.17, 1], [-0.15, -0.53, 1], [-1.12, -1.62, 1], [-2.8, -2.6, 1], [-3.48, -2.68, 1], [-3.87, -2.54, 1], [-4.35, -1.96, 1], [-4.43, -1.42, 0.4]]}], "exit": null, "dotX": -0.77}, "fin": {"s": [{"pts": [[0.0, 0.0, 1], [-1.36, -0.29, 1], [-1.72, 0.01, 1], [-1.65, 0.75, 1], [-1.23, 0.96, 1], [-0.45, 0.27, 1], [-0.2, -0.53, 1], [-0.32, -1.05, 1], [-1.69, -2.46, 1], [-3.49, -3.31, 1], [-4.31, -3.21, 1], [-4.88, -2.63, 1], [-5.04, -1.82, 1], [-4.86, -1.0, 0.4]]}], "exit": null, "dotX": -1.19}}, "kaf": {"ini": {"s": [{"pts": [[-1.02, 5.57, 0.55], [0.0, 7.71, 1], [-0.07, 8.01, 1], [-0.66, 8.18, 1], [-2.78, 7.11, 1], [-5.67, 5.02, 1], [-5.82, 4.74, 1], [-5.66, 4.22, 1], [-3.46, 2.16, 1], [-3.01, 1.14, 1], [-3.16, 0.51, 1], [-3.62, 0.02, 1], [-4.71, -0.2, 1], [-5.31, 0.0, 1]]}], "exit": -5.31, "dotX": -3.23}, "iso": {"s": [{"pts": [[-0.37, 0.0, 0.55], [-0.01, 2.07, 1], [-0.34, 2.4, 1], [-1.01, 2.23, 1], [-2.14, 1.57, 1], [-3.57, 0.41, 1], [-5.93, -2.32, 1], [-6.17, -3.07, 1], [-5.98, -3.75, 1], [-4.46, -5.7, 1], [-3.81, -7.43, 1], [-3.89, -8.31, 1], [-4.38, -9.05, 1], [-5.13, -9.51, 1], [-5.87, -9.54, 0.4]]}], "exit": null, "dotX": -1.88}, "med": {"s": [{"pts": [[0.0, 0.0, 1], [1.0, 2.92, 1], [0.87, 3.32, 1], [0.56, 3.53, 1], [-0.24, 3.59, 1], [-4.06, 3.19, 1], [-5.12, 2.95, 1], [-5.71, 2.59, 1], [-5.76, 2.34, 1], [-5.54, 2.05, 1], [-3.32, 0.8, 1], [-2.91, 0.14, 1], [-3.13, -0.15, 1], [-3.33, 0.0, 1]]}], "exit": -3.33, "dotX": -2.79}, "fin": {"s": [{"pts": [[0.0, 0.0, 1], [-1.77, 1.84, 1], [-4.04, 3.68, 1], [-4.37, 4.47, 1], [-3.74, 5.22, 1], [-2.49, 5.99, 1], [0.49, 7.46, 1], [1.84, 7.9, 1], [2.12, 7.87, 1], [2.35, 7.48, 1], [1.66, 5.51, 0.4]]}], "exit": null, "dotX": -1.08}}};
// which learned forms to use: the ones that came out well; the rest keep the hand-drawn shape
const LEARN_USE = { ain: ['ini', 'med', 'fin', 'iso'], alif: ['iso', 'fin'], kaf: ['ini'], lam: ['ini', 'med'],
  nun: ['fin', 'iso'], ra: ['fin', 'iso'], sin: ['ini', 'med'], tooth: ['ini', 'med', 'fin', 'iso'], waw: ['fin', 'iso'], ya: ['fin', 'iso'], hah: ['fin'] };
let USE_FA_MASTER = false, USE_SAD_MASTER = true, LOOP_X = null, LOOP_Y = null, USE_FITTED = true, LEARN_BACKUP = null, LOOP_BACKUP = null, LOOP_GROW = 1.35;
function useLearned(on, scale = 1) {
  if (!LEARN_BACKUP) { LEARN_BACKUP = {}; Object.keys(LEARN_USE).forEach(f => { LEARN_BACKUP[f] = { ...T[f] }; }); }
  Object.keys(LEARN_USE).forEach(f => { T[f] = { ...LEARN_BACKUP[f] }; if (on) LEARN_USE[f].forEach(form => { const g = LEARNED[f] && LEARNED[f][form]; if (!g) return;
    T[f][form] = { dotX: g.dotX * scale, exit: g.exit == null ? null : g.exit * scale, s: g.s.map(st => ({ pts: st.pts.map(([x, y, w]) => [x * scale, y * scale, w]) })) }; }); });
  // the hand-drawn loop letters get larger heads beside the learned letters, so their counters stay open
  if (!LOOP_BACKUP) { LOOP_BACKUP = {}; ['fa', 'qaf', 'sad', 'mim', 'ta'].forEach(f => { LOOP_BACKUP[f] = JSON.parse(JSON.stringify(T[f])); }); }
  ['fa', 'qaf', 'sad', 'mim', 'ta'].forEach(f => { const src = JSON.parse(JSON.stringify(LOOP_BACKUP[f])); if (on) Object.values(src).forEach(g => (g.s || []).forEach(st => { if (st.ang === 38) return;
    const hp = st.pts.filter(q => q[1] > 0.25); if (hp.length < 3) return; const cx = hp.reduce((a, q) => a + q[0], 0) / hp.length, cy = hp.reduce((a, q) => a + q[1], 0) / hp.length;
    const gx = LOOP_GROW * ((LOOP_X && LOOP_X[f]) || 1), gy = LOOP_GROW * ((LOOP_Y && LOOP_Y[f]) || (f === 'sad' ? 1.3 : 1)); hp.forEach(q => { q[0] = cx + (q[0] - cx) * gx; q[1] = cy + (q[1] - cy) * gy; }); })); T[f] = src; }); // the sad's loop a little fuller still
  if (on && typeof FA_MASTER !== 'undefined' && USE_FA_MASTER) T.fa = { ...T.fa, ...JSON.parse(JSON.stringify(FA_MASTER)) };
  if (on && typeof SAD_MASTER !== 'undefined' && USE_SAD_MASTER) T.sad = { ...T.sad, ...JSON.parse(JSON.stringify(SAD_MASTER)) };
  if (on && typeof FITTED !== 'undefined' && USE_FITTED) Object.entries(FITTED).forEach(([f, forms]) => Object.entries(forms).forEach(([form, g]) => { T[f] = { ...T[f], [form]: JSON.parse(JSON.stringify(g)) }; }));
  if (T.qaf) { T.qaf.ini = T.fa.ini; T.qaf.med = T.fa.med; }
  gcache.clear();
}

// ================= SHAPE A GREAT BOWL TO THE FRAME =================
// After composition, redraw a great final bowl (a returning ya or a final nun) as a curve that follows the frame's lower
// rim at a fixed clearance below the other letters, wide and low as a master would draw it; put the letter's dots inside
// the bowl, anchor its vowels at its start, and recompute the frame around the new ink.
function shapeBowl(r, o = {}) {
  const ov = o.oval || (r.disc && r.disc.oval) || 1, clear = o.clear ?? 2.6, side = o.side ?? 1.0, tailUp = o.tailUp ?? 2.2;
  let gi = -1, P = null;
  r.shapes.forEach((S, i) => { const last = S.b.placed.filter(p => p.g).pop(); if (!last) return; const ys = last.g.s.flatMap(st => st.pts.map(q => q[1])); if (Math.min(...ys) < -3.2 && (last.c === 'ي' || last.c === 'ى' || last.c === 'ن')) { gi = i; P = last; } });
  if (gi < 0) return r;
  const S = r.shapes[gi], G = r.st[gi], sc = r.groups[gi].sc || 1, J = { x: G.x + P.ox, y: G.y + (P.oy || 0) };
  // the other ink: every glyph except the bowl
  let X0 = 1e9, X1 = -1e9, Y0 = 1e9, Y1 = -1e9;
  r.shapes.forEach((S2, i) => S2.b.placed.forEach(p => { if (!p.g || (i === gi && p === P)) return; p.g.s.forEach(st => st.pts.forEach(q => { const x = r.st[i].x + p.ox + q[0] * (r.groups[i].sc || 1), y = r.st[i].y + (p.oy || 0) + q[1] * (r.groups[i].sc || 1); X0 = Math.min(X0, x); X1 = Math.max(X1, x); Y0 = Math.min(Y0, y); Y1 = Math.max(Y1, y); })); }));
  // the bowl: the lower half of an ellipse that clears the letters, as wide as the composition
  // the bowl leads out to the left of the join and drops in a broad, open curve (a tight turn under the letter before
  // closes into a small loop that reads as a ta marbuta), then sweeps back beneath everything and rises on the right
  const lead = o.lead ?? 2.0, cx = (X0 + X1) / 2, bottom = Math.min(Y0, J.y) - clear;
  const cy = Math.min(J.y - 1.2, Math.max(bottom + 2, (Y0 + Y1) / 2 - (Y1 - Y0) * 0.1)), b = cy - bottom;
  const aL = Math.max(cx - (J.x - lead), cx - X0 + side), aR = X1 - cx + side;
  const E = t => [cx + (Math.cos(t) < 0 ? aL : aR) * Math.cos(t), cy + b * Math.sin(t)];
  const ts = Math.PI, te = Math.PI * 2 - 0.12 + (o.tailAng || 0), pts = [[J.x, J.y, 1]];
  const s0 = E(ts); pts.push([J.x - lead * 0.45, J.y - 0.15, 1], [s0[0] + lead * 0.12, (J.y + s0[1]) / 2 + 0.25, 1]);
  for (let t = ts; t <= te; t += 0.18) { const [x, y] = E(t); pts.push([x, y, 1]); }
  const [ex, ey] = E(te); pts.push([ex + 0.15, ey + tailUp * 0.55, 0.6], [ex - 0.25, ey + tailUp, 0.2]);
  // replace the ink after the join with the new curve
  const lx = J.x - G.x, ly = J.y - G.y; let best = null;
  S.b.strokes.forEach((st, si) => st.s.forEach((q, qi) => { const d = Math.hypot(q.x - lx, q.y - ly); if (!best || d < best.d) best = { d, si, qi }; }));
  const st = S.b.strokes[best.si]; st.s = st.s.slice(0, best.qi + 1).concat(sampleStroke(pts.slice(1).map(([x, y, w]) => [x - G.x, y - G.y, w])));
  // the letter's vowels sit at its start; its dots inside the bowl, low and to the left
  P.g = { s: [{ pts: [[0, 0, 1], [-1.4 / sc, -0.5 / sc, 1]] }], exit: null };
  const dg = (S.b.dotGroups || []).find(d => d.li === P.li);
  if (dg) { const tx = cx - aL * (o.dotAt ?? 0.42), cth = Math.acos(Math.max(-1, Math.min(1, (tx - cx) / aL))), ty = cy - b * Math.sin(cth) + 1.7; /* just inside the curve at that point */ Object.assign(dg, { x: tx - G.x, y: ty - G.y, x0: tx - G.x - 1, x1: tx - G.x + 1, top: ty - G.y + 1.6, bot: ty - G.y + 0.9 }); }
  // the frame around the new ink
  let ink = []; r.shapes.forEach((S2, i) => S2.b.strokes.forEach(s2 => s2.s.forEach(q => ink.push([q.x + r.st[i].x, q.y + r.st[i].y]))));
  const xs = ink.map(q => q[0]), ys = ink.map(q => q[1]), mx = (Math.min(...xs) + Math.max(...xs)) / 2, my = (Math.min(...ys) + Math.max(...ys)) / 2, Wd = Math.max(...xs) - Math.min(...xs), Hd = Math.max(...ys) - Math.min(...ys);
  // the smallest oval holding the ink: search its centre and (if asked) its proportions together
  const hull = ink.filter((_, i) => i % 3 === 0); let bestE = null;
  const ovs = o.autoOval ? [1.2, 1.35, 1.5, 1.65, 1.8, 2.0, 2.2] : [ov];
  ovs.forEach(v => { for (let dx = -0.2; dx <= 0.2001; dx += 0.05) for (let dy = -0.2; dy <= 0.2001; dy += 0.05) { const ccx = mx + dx * Wd, ccy = my + dy * Hd; let R2 = 0; hull.forEach(([x, y]) => { R2 = Math.max(R2, Math.hypot((x - ccx) / v, y - ccy)); });
    const area = R2 * R2 * v * (1 + 0.15 * Math.abs(v - 1.5)); if (!bestE || area < bestE.area) bestE = { area, cx: ccx, cy: ccy, R: R2, v }; } });
  r.disc = { ...r.disc, cx: bestE.cx, cy: bestE.cy, r: bestE.R + 0.8, oval: bestE.v };
  return r;
}
// Fit the frame to everything drawn (letters, dots and vowels), then solve the marks again inside it.
function fitFrame(r, o = {}) {
  let f = finishRoundel(r, '', o);
  for (let pass = 0; pass < 2; pass++) {
    const units = roundelParts(r, { ...o, solved: f.solved }), pts = [];
    units.forEach(u => { if (u.s) u.s.forEach((q, i) => { if (i % 2 === 0) pts.push([q.x, q.y, (u.nib || o.nib || 1.3) * 0.7]); }); if (u.dot) pts.push([u.dot[0], u.dot[1], (o.nib || 1.3) * 0.8]); });
    const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]), mx = (Math.min(...xs) + Math.max(...xs)) / 2, my = (Math.min(...ys) + Math.max(...ys)) / 2, Wd = Math.max(...xs) - Math.min(...xs), Hd = Math.max(...ys) - Math.min(...ys);
    let best = null; (o.ovals || [1.0, 1.15, 1.3, 1.45, 1.6, 1.8, 2.0, 2.2]).forEach(v => { for (let dx = -0.15; dx <= 0.1501; dx += 0.03) for (let dy = -0.15; dy <= 0.1501; dy += 0.03) { const ccx = mx + dx * Wd, ccy = my + dy * Hd; let R = 0;
      pts.forEach(([x, y, m]) => { R = Math.max(R, Math.hypot((x - ccx) / v, y - ccy) + m); }); const area = R * R * v * (1 + (o.ovalPull ?? 0.12) * Math.abs(v - (o.ovalPref || 1.5))); if (!best || area < best.area) best = { area, cx: ccx, cy: ccy, R, v }; } });
    r.disc = { ...r.disc, cx: best.cx, cy: best.cy, r: best.R / 1.02, oval: best.v };
    f = finishRoundel(r, '', o); f.discScale = 1.0;
  }
  return f;
}
// How crowded the marks are: overlap between the boxes of dots and vowels, and their crowding of the letters.
function crowding(f) {
  const its = (f.solved && f.solved.items) || []; let c = 0;
  for (let i = 0; i < its.length; i++) for (let j = i + 1; j < its.length; j++) { const a = its[i], b = its[j], gx = Math.abs(a.x - b.x) - (a.w + b.w) / 2, gy = Math.abs(a.y - b.y) - (a.h + b.h) / 2, gap = Math.max(gx, gy); if (gap < 0.9) c += (0.9 - gap) ** 2; }
  return c;
}

// Scale one group of letters about its own origin (a smaller conjunction, say); its marks scale with it.
function scaleGroup(r, gi, s, nib = 1.3) {
  const S = r.shapes[gi], g = r.groups[gi];
  S.b.strokes.forEach(st => { st.s = st.s.map(q => ({ x: q.x * s, y: q.y * s, w: q.w })); st.nib = (st.nib || nib) * s; });
  S.b.dots = S.b.dots.map(([x, y, sc]) => [x * s, y * s, (sc || 1) * s]);
  (S.b.dotGroups || []).forEach(d => { ['x', 'y', 'x0', 'x1', 'top', 'bot'].forEach(f => { d[f] *= s; }); d.sc = (d.sc || 1) * s; });
  S.b.placed.forEach(p => { if (p.g) { p.ox *= s; p.oy = (p.oy || 0) * s; } });
  ['x0', 'x1', 'y0', 'y1'].forEach(f => { if (S[f] != null) S[f] *= s; }); g.sc = (g.sc || 1) * s;
}
// The ink box of one group, in composition coordinates.
function groupBox(r, gi) { let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; r.shapes[gi].b.strokes.forEach(st => st.s.forEach(q => { x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); })); const { x, y } = r.st[gi]; return { x0: x0 + x, x1: x1 + x, y0: y0 + y, y1: y1 + y }; }
// Put a group centred under the last letter of another group (the conjunction under Zainab's ba).
function placeUnder(r, gi, under, gap = 1.0, dx = 0) {
  const S = r.shapes[under], p = S.b.placed.filter(q => q.g).pop(), sc = r.groups[under].sc || 1;
  const xs = p.g.s.flatMap(st => st.pts.map(q => r.st[under].x + p.ox + q[0] * sc)), ys = p.g.s.flatMap(st => st.pts.map(q => r.st[under].y + (p.oy || 0) + q[1] * sc));
  let bot = Math.min(...ys); const cx = (Math.min(...xs) + Math.max(...xs)) / 2 + dx, b = groupBox(r, gi);
  // clear the letter's own dots below it too
  (S.b.dotGroups || []).filter(d => d.li === p.li && d.side < 0).forEach(d => { bot = Math.min(bot, r.st[under].y + d.y - 1.0); });
  r.st[gi] = { x: r.st[gi].x + cx - (b.x0 + b.x1) / 2, y: r.st[gi].y + (bot - gap) - b.y1 };
}
