
// ================= LETTER STYLE =================
// Fifteen shared parameters that reshape every letter coherently, applied as smooth deformations of the drawn
// letter skeletons: stems, teeth, loop heads, bowls and tails, entry and exit hairlines, curve tension, pen.
const STYLE_PARAMS = [
  ['nib', 'Nib width', 1.05, 1.55, 1.3], ['ang', 'Nib angle', 58, 78, 70], ['body', 'Letter body size', 1.15, 1.55, 1.3],
  ['stemH', 'Stem height', 8.5, 11.5, 10], ['stemCurve', 'Stem curve', -0.4, 0.4, 0], ['slant', 'Slant', -0.12, 0.08, -0.06],
  ['tooth', 'Tooth height', 1.8, 3.2, 2.45], ['depth', 'Bowl depth', 0.75, 1.35, 1], ['width', 'Bowl width', 0.8, 1.3, 1],
  ['head', 'Loop head size', 0.8, 1.3, 1], ['hahHead', 'Hah head size', 0.8, 1.25, 1], ['rise', 'Tail rise', 0.6, 1.6, 1],
  ['flick', 'Hairline sharpness', 0.5, 1.5, 1], ['tension', 'Curve roundness', 0.35, 0.65, 0.5], ['sag', 'Stretch sag', 0, 0.6, 0.3]];
const STYLE_DEFAULT = Object.fromEntries(STYLE_PARAMS.map(p => [p[0], p[4]]));
const clone = x => JSON.parse(JSON.stringify(x));
const T0 = {}; ['alif', 'lam', 'tooth', 'sin', 'mim', 'ra', 'hah', 'nun', 'dal', 'waw', 'fa', 'qaf', 'sad', 'ya', 'kaf', 'ain', 'ta', 'lamalif'].forEach(f => { if (T[f]) T0[f] = clone(T[f]); });
const T0ha = { ini: clone(T.ha.ini), med: clone(T.ha.med), iso: clone(T.ha.iso) }, H0 = clone(HEH_FIN);
const LOOPS = new Set(['mim', 'fa', 'qaf', 'waw', 'ha', 'sad', 'ta', 'ain']), TEETH = new Set(['tooth', 'sin']), TAILS = new Set(['nun', 'ra', 'ya', 'waw', 'tooth', 'qaf', 'sad', 'lam']);
function styleGlyph(fam, g, P) {
  if (!g || !g.s) return g;
  const out = clone(g);
  out.s.forEach(st => {
    const pts = st.pts;
    if (st.ang === 38) { // stems: height and a gentle bow
      const hs = P.stemH / 10; pts.forEach(q => { if (q[1] > 1.2) { q[1] = 1.2 + (q[1] - 1.2) * hs; q[0] += P.stemCurve * Math.sin(Math.PI * Math.min(1, q[1] / (10 * hs))); } });
    } else {
      if (TEETH.has(fam)) pts.forEach(q => { if (q[1] > 0.55) q[1] = 0.55 + (q[1] - 0.55) * (P.tooth - 0.55) / (2.45 - 0.55); });
      // loop heads grow or shrink about their own centre (points above the baseline)
      const scaleHead = (s2, sel) => { const hp = pts.filter(sel); if (hp.length < 3) return; const cx = hp.reduce((a, q) => a + q[0], 0) / hp.length, cy = hp.reduce((a, q) => a + q[1], 0) / hp.length; hp.forEach(q => { q[0] = cx + (q[0] - cx) * s2; q[1] = cy + (q[1] - cy) * s2; }); };
      if (LOOPS.has(fam)) scaleHead(P.head, q => q[1] > 0.25);
      if (fam === 'hah') scaleHead(P.hahHead, q => q[1] > 1.4);
      // bowls and tails below the baseline: deeper or shallower, wider or narrower, blending in smoothly from the baseline
      pts.forEach(q => { if (q[1] < 0) { const k = Math.min(1, -q[1] / 1.0); q[0] *= 1 + (P.width - 1) * k; q[1] *= P.depth; } });
      // the rising end of a tail
      if (TAILS.has(fam) && pts.length > 3) { const n = pts.length, last = pts[n - 1], prev = pts[n - 2]; if (last[1] > prev[1] && prev[1] < 0.5) { last[1] += (P.rise - 1) * 0.9; pts[n - 2][1] += (P.rise - 1) * 0.35; } }
    }
    // hairline entries and exits: the thinner the end, the sharper the flick
    [0, pts.length - 1].forEach(i => { const q = pts[i]; if (q[2] != null && q[2] < 0.6) q[2] = Math.max(0.06, Math.min(0.6, q[2] / P.flick)); });
  });
  return out;
}
function applyStyle(P) {
  Object.entries(T0).forEach(([f, fam]) => { const nf = {}; Object.entries(fam).forEach(([form, g]) => { nf[form] = styleGlyph(f, g, P); }); T[f] = nf; });
  T.lam.fin = T.lam.fin || T.lam.iso; T.qaf.ini = T.fa.ini; T.qaf.med = T.fa.med;
  const ha = { ini: styleGlyph('ha', T0ha.ini, P), med: styleGlyph('ha', T0ha.med, P), iso: styleGlyph('ha', T0ha.iso, P) }; T.ha = ha;
  Object.keys(H0).forEach(k => { HEH_FIN[k] = styleGlyph('ha', H0[k], P); });
  Object.defineProperty(T.ha, 'fin', { get: () => HEH_FIN[OPT.heh] || HEH_FIN.round, configurable: true });
  BODY = P.body; OPT.slant = P.slant; CR_T = P.tension; gcache.clear();
}
