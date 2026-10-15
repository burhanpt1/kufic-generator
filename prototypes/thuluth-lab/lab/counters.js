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
