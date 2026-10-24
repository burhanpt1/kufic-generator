
// ================= LEGIBILITY CHECKER =================
// 1. Rasm confusion: every letter form drawn alone (no dots), compared with every other rasm in the same position.
//    Distance = 1 - IoU after the best small shift and with a little tolerance (both dilated by one pixel).
// 2. Dots: every word has the dots its letters need, and no dot sits on ink.
// 3. Counters: loop letters keep an open counter at a given pen.
const RASM = [ // [class, representative letter, forms], letters sharing a rasm are one class
  ['alif', 'ا', ['iso', 'fin']], ['lam', 'ل', ['ini', 'med', 'fin', 'iso']], ['tooth', 'ب', ['ini', 'med']], ['ba', 'ب', ['fin', 'iso']],
  ['nun', 'ن', ['fin', 'iso']], ['ya', 'ى', ['fin', 'iso']], ['sin', 'س', ['ini', 'med', 'fin', 'iso']], ['sad', 'ص', ['ini', 'med', 'fin', 'iso']],
  ['tah', 'ط', ['ini', 'med', 'fin', 'iso']], ['ain', 'ع', ['ini', 'med', 'fin', 'iso']], ['fa', 'ف', ['ini', 'med', 'fin', 'iso']], ['qaf', 'ق', ['fin', 'iso']],
  ['kaf', 'ك', ['ini', 'med', 'fin', 'iso']], ['mim', 'م', ['ini', 'med', 'fin', 'iso']], ['heh', 'ه', ['ini', 'med', 'fin', 'iso']], ['hah', 'ح', ['ini', 'med', 'fin', 'iso']],
  ['dal', 'د', ['fin', 'iso']], ['ra', 'ر', ['fin', 'iso']], ['waw', 'و', ['fin', 'iso']]];
function rasterGlyph(c, form, o = {}) {
  const g = glyphFor(c, form); if (!g || !g.s) return null;
  const nib = o.nib || 1.3, K = o.K || 7, W = 24, H = 24, cv = document.createElement('canvas'); cv.width = W * K; cv.height = H * K; const cx = cv.getContext('2d', { willReadFrequently: true });
  cx.fillStyle = '#000'; const ox = W * K * 0.7, oy = H * K * 0.62;
  g.s.forEach(st => cx.fill(new Path2D(nibPath(sampleStroke(st.pts), nib, st.ang || o.ang || 69, x => ox + x * K, y => oy - y * K))));
  const d = cx.getImageData(0, 0, cv.width, cv.height).data, m = new Uint8Array(cv.width * cv.height); let n = 0; for (let i = 0; i < m.length; i++) { m[i] = d[i * 4 + 3] > 100 ? 1 : 0; n += m[i]; }
  return { m, w: cv.width, h: cv.height, n, K };
}
function dilate(A) { const { w, h } = A, m = new Uint8Array(w * h); for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const i = y * w + x; if (A.m[i] || A.m[i - 1] || A.m[i + 1] || A.m[i - w] || A.m[i + w]) m[i] = 1; } return { ...A, m }; }
function shapeDistance(A, B, maxShift = 10, step = 2) { // translation-tolerant: the best shift within about 1.5 units
  const a = dilate(A), b = dilate(B), { w, h } = a; let best = 1;
  for (let dy = -maxShift; dy <= maxShift; dy += step) for (let dx = -maxShift * 2; dx <= maxShift * 2; dx += step) {
    let inter = 0, uni = 0; for (let y = 0; y < h; y++) { const yb = y + dy; if (yb < 0 || yb >= h) { for (let x = 0; x < w; x++) uni += a.m[y * w + x]; continue; } for (let x = 0; x < w; x++) { const xb = x + dx, va = a.m[y * w + x], vb = xb >= 0 && xb < w ? b.m[yb * w + xb] : 0; inter += va & vb; uni += va | vb; } }
    const dist = 1 - inter / Math.max(1, uni); if (dist < best) best = dist; }
  return best;
}
function confusionReport(o = {}) {
  const out = { pairs: [], forms: {} };
  ['ini', 'med', 'fin', 'iso'].forEach(form => {
    const items = RASM.filter(r => r[2].includes(form)).map(([cls, c]) => ({ cls, c, R: rasterGlyph(c, form, o) })).filter(it => it.R && it.R.n > 0);
    out.forms[form] = items.map(it => it.cls);
    for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) out.pairs.push({ form, a: items[i].cls, b: items[j].cls, d: +shapeDistance(items[i].R, items[j].R).toFixed(3) });
  });
  out.pairs.sort((p, q) => p.d - q.d); return out;
}
// dots: count and collisions in rendered words
function dotReport(words, o = {}) {
  const nib = o.nib || 1.3, rows = [];
  words.forEach(w => { const b = buildStrokes(w, { nib, ang: o.ang || 69 }); let expect = 0; [...w].forEach(c => (DOTS[c] || []).forEach(([, n]) => { expect += n; }));
    // collisions: raster the letters, then measure how much of each dot lands on ink
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; b.strokes.forEach(s => s.s.forEach(q => { x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); }));
    b.dots.forEach(([x, y]) => { x0 = Math.min(x0, x - 1); x1 = Math.max(x1, x + 1); y0 = Math.min(y0, y - 1); y1 = Math.max(y1, y + 1); });
    const K = 8, W = Math.ceil((x1 - x0 + 2) * K), H = Math.ceil((y1 - y0 + 2) * K), X = x => (x - x0 + 1) * K, Y = y => (y1 + 1 - y) * K;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const cx = cv.getContext('2d', { willReadFrequently: true }); cx.fillStyle = '#000';
    b.strokes.forEach(s => cx.fill(new Path2D(nibPath(s.s, s.nib || nib, s.ang, X, Y)))); const ink = cx.getImageData(0, 0, W, H).data;
    let worst = 0; b.dots.forEach(([x, y]) => { const c2 = document.createElement('canvas'); c2.width = W; c2.height = H; const d2 = c2.getContext('2d', { willReadFrequently: true }); d2.fillStyle = '#000'; d2.fill(new Path2D(dotPath(x, y, nib, o.ang || 69, X, Y))); const dd = d2.getImageData(0, 0, W, H).data; let a = 0, on = 0; for (let i = 3; i < dd.length; i += 4) if (dd[i] > 100) { a++; if (ink[i] > 100) on++; } worst = Math.max(worst, on / Math.max(1, a)); });
    rows.push({ w, dots: b.dots.length, expect, ok: b.dots.length === expect, overlap: +worst.toFixed(2) }); });
  return rows;
}
// counters: loop letters keep an open counter
function counterReport(o = {}) {
  const nib = o.nib || 1.6, rows = [];
  [['mim', 'م', ['ini', 'med', 'fin']], ['fa', 'ف', ['ini', 'med', 'fin', 'iso']], ['qaf', 'ق', ['fin', 'iso']], ['waw', 'و', ['fin', 'iso']], ['sad', 'ص', ['ini', 'med', 'fin', 'iso']], ['tah', 'ط', ['ini', 'med', 'fin', 'iso']], ['heh', 'ه', ['ini', 'med', 'fin', 'iso']], ['ain', 'ع', ['med']]].forEach(([cls, c, forms]) => forms.forEach(form => {
    const g = glyphFor(c, form); if (!g) return; const strokes = g.s.map(st => ({ s: sampleStroke(st.pts), ang: st.ang || o.ang || 69 }));
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; strokes.forEach(s => s.s.forEach(q => { x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); }));
    const U = 10, holes = findCounters(strokes, nib, x0 - 1, y1 + 1, U, x1 - x0 + 2, y1 - y0 + 2, x => x, y => y, 0);
    rows.push({ cls, form, counters: holes.length, ok: holes.length > 0 }); }));
  return rows;
}
