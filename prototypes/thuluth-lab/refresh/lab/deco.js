
// ================= DECORATIVE CRITIC =================
// Scores an image of a composition against the classical rules of istif (M. Uğur Derman, "İstif", TDV İslâm
// Ansiklopedisi): even density of stroke over the field, no heavy knots where letters cross, any looseness at the top
// rather than the bottom, tall stems evenly spaced, and organic unity (no part detached from the rest). It reads only an
// ink mask and a field mask, so it judges engine output and photographs of masters alike.
function decoMetrics(ink, field, W, H, o = {}) {
  let fx0 = W, fx1 = 0, fy0 = H, fy1 = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (field[y * W + x]) { fx0 = Math.min(fx0, x); fx1 = Math.max(fx1, x); fy0 = Math.min(fy0, y); fy1 = Math.max(fy1, y); }
  const rows = fy1 - fy0;
  // 1. density at the scale of the composition's parts: ink blurred over about an eighth of the field, sampled inside it
  const rad = Math.max(3, Math.round((o.blur || 0.125) * Math.max(fx1 - fx0, rows))), S = new Float64Array((W + 1) * (H + 1));
  for (let y = 0; y < H; y++) { let row = 0; for (let x = 0; x < W; x++) { row += ink[y * W + x]; S[(y + 1) * (W + 1) + x + 1] = S[y * (W + 1) + x + 1] + row; } }
  const boxD = (x, y) => { const xa = Math.max(0, x - rad), xb = Math.min(W, x + rad), ya = Math.max(0, y - rad), yb = Math.min(H, y + rad); return (S[yb * (W + 1) + xb] - S[ya * (W + 1) + xb] - S[yb * (W + 1) + xa] + S[ya * (W + 1) + xa]) / ((xb - xa) * (yb - ya)); };
  const samples = [], step = Math.max(2, Math.round(rad / 2));
  for (let y = fy0 + rad; y <= fy1 - rad; y += step) for (let x = fx0 + rad; x <= fx1 - rad; x += step) if (field[y * W + x]) samples.push({ x, y, d: boxD(x, y) });
  const ds = samples.map(c => c.d), mean = ds.reduce((a, b) => a + b, 0) / Math.max(1, ds.length), sd = Math.sqrt(ds.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, ds.length));
  const uniformity = Math.max(0, 1 - sd / Math.max(1e-6, mean));           // 1 = perfectly even texture
  const knots = samples.filter(c => c.d > 2.0 * mean).length / Math.max(1, samples.length); // share of the field that is a heavy knot
  // 2. looseness belongs at the top: emptiness in the top third against the bottom third
  const third = rows / 3, emptyIn = (a, b2) => { const ss = samples.filter(c => c.y >= a && c.y < b2); return ss.length ? ss.filter(c => c.d < 0.35 * mean).length / ss.length : 0; };
  const looseTop = emptyIn(fy0, fy0 + third) - emptyIn(fy1 - third, fy1 + 1);   // > 0: the looseness sits at the top, as it should
  // 3. tall stems: columns holding a long vertical run of ink; their spacing should be even
  const runMin = (o.stemFrac || 0.3) * rows, stemCols = [];
  for (let x = fx0; x <= fx1; x++) { let run = 0, best = 0; for (let y = fy0; y <= fy1; y++) { if (ink[y * W + x]) { run++; best = Math.max(best, run); } else run = 0; } if (best > runMin) stemCols.push(x); }
  const stems = []; stemCols.forEach(x => { if (!stems.length || x - stems[stems.length - 1].x1 > 2) stems.push({ x0: x, x1: x }); else stems[stems.length - 1].x1 = x; });
  const sx = stems.map(s => (s.x0 + s.x1) / 2), gaps = sx.slice(1).map((v, i) => v - sx[i]);
  const gm = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0, gsd = gaps.length ? Math.sqrt(gaps.reduce((a, b) => a + (b - gm) ** 2, 0) / gaps.length) : 0;
  const stemEven = gaps.length >= 1 ? Math.max(0, 1 - gsd / Math.max(1e-6, gm)) : null;
  // 4. organic unity: join ink within a small reach; the composition should be one body (dots and marks may float)
  const r = Math.max(2, Math.round((o.reach || 0.035) * Math.max(W, H))), lab = new Int32Array(W * H).fill(-1); const comps = [];
  const near = new Uint8Array(W * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (ink[y * W + x]) for (let dy = -r; dy <= r; dy += r) for (let dx = -r; dx <= r; dx += r) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < W && yy < H) near[yy * W + xx] = 1; }
  for (let i = 0; i < W * H; i++) { if (!near[i] || lab[i] >= 0) continue; const st = [i]; lab[i] = comps.length; let area = 0; while (st.length) { const j = st.pop(); if (ink[j]) area++; const x = j % W, y = (j - x) / W; [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([a, b]) => { const xx = x + a, yy = y + b; if (xx < 0 || yy < 0 || xx >= W || yy >= H) return; const k = yy * W + xx; if (near[k] && lab[k] < 0) { lab[k] = comps.length; st.push(k); } }); } comps.push(area); }
  const total = comps.reduce((a, b) => a + b, 0), bigShare = Math.max(...comps) / Math.max(1, total);
  const unity = bigShare;                                                // share of the ink in the main body
  // 5. coverage: how much of the field the ink spans
  let ix0 = W, ix1 = 0, iy0 = H, iy1 = 0, area = 0, farea = 0; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (field[i]) farea++; if (ink[i] && field[i]) { area++; ix0 = Math.min(ix0, x); ix1 = Math.max(ix1, x); iy0 = Math.min(iy0, y); iy1 = Math.max(iy1, y); } }
  const fill = area / Math.max(1, farea), span = ((ix1 - ix0) / Math.max(1, fx1 - fx0) + (iy1 - iy0) / Math.max(1, fy1 - fy0)) / 2;
  const score = 1.0 * uniformity - 1.5 * knots + 0.35 * Math.max(-1, Math.min(1, looseTop)) + 0.4 * (stemEven ?? 0.5) + 0.6 * unity + 0.5 * Math.min(1, span / 0.85);
  return { score, uniformity, knots, looseTop, stemEven, stems: stems.length, unity, fill, span };
}
// rasterise units (strokes and dots, as from roundelParts) and a circular or custom field into masks
function rasterUnits(units, nib, box, K, mirror, only) {
  if (only === 'letters') units = units.filter(u => u.dot || ((u.nib || nib) > nib * 0.6));
  const W = Math.ceil((box.x1 - box.x0) * K), H = Math.ceil((box.y1 - box.y0) * K), cv = document.createElement('canvas'); cv.width = W; cv.height = H; const cx = cv.getContext('2d', { willReadFrequently: true }); cx.fillStyle = '#000';
  const X = x => (x - box.x0) * K, Y = y => (box.y1 - y) * K;
  const draw = () => units.forEach(u => { if (u.dot) cx.fill(new Path2D(dotPath(u.dot[0], u.dot[1], nib * u.dot[2], 69, X, Y, u.dot[3] || 0))); else if (u.s) cx.fill(new Path2D(nibPath(u.s, u.nib || nib, u.ang, X, Y))); });
  draw(); if (mirror != null) { cx.save(); cx.translate(2 * X(mirror), 0); cx.scale(-1, 1); draw(); cx.restore(); }
  const d = cx.getImageData(0, 0, W, H).data, ink = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) ink[i] = d[i * 4 + 3] > 100 ? 1 : 0;
  return { ink, W, H, X, Y };
}
function unitsSVG(units, nib, X, Y) { return units.map(u => u.dot ? dotPath(u.dot[0], u.dot[1], nib * u.dot[2], 69, X, Y, u.dot[3] || 0) : u.s ? nibPath(u.s, u.nib || nib, u.ang, X, Y) : '').join(''); }

// ================= MÜSENNÂ (MIRRORED COMPOSITION) =================
// Compose a text once, set it against a vertical axis (overlapping it by `overlap` units, so the halves meet or interlace),
// mirror it, and let the decorative critic choose among many candidates. The right half reads; the whole is ornament.
function musenna(text, o = {}) {
  const pen = { nib: o.nib || 1.5, ang: 69 }, cands = [];
  (o.seeds || [11, 23, 37, 51, 67, 83]).forEach(seed => (o.ovals || [1.0, 1.25]).forEach(oval => {
    const r = composeRoundel(text, { ...pen, tries: o.tries || 3, iters: o.iters || 3000, seed, elongate: true, cross: true, cradle: true, deep: true, fillTarget: 0.45, oval, ...(o.compose || {}) })[0];
    if (!r) return; const f = finishRoundel(r, '', { ...pen, ...(o.finish || {}) }), units = roundelParts(r, { ...pen, solved: f.solved });
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; units.forEach(u => (u.s || []).forEach(q => { x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); }));
    (o.overlaps || [-0.6, 0.4, 1.4, 2.6]).forEach(ov => {
      const axis = x0 + ov, half = Math.max(x1 - axis, axis - x0) + 1.5, cyy = (y0 + y1) / 2, rad = Math.max(half, (y1 - y0) / 2 + 1.5) * 1.06;
      const box = { x0: axis - rad, x1: axis + rad, y0: cyy - rad, y1: cyy + rad }, K = 4, R = rasterUnits(units, pen.nib, box, K, axis);
      const field = new Uint8Array(R.W * R.H); for (let y = 0; y < R.H; y++) for (let x = 0; x < R.W; x++) { const dx = x / R.W - 0.5, dy = y / R.H - 0.5; if (dx * dx + dy * dy < 0.25) field[y * R.W + x] = 1; }
      // the two halves must not collide in a blob at the axis: measure ink in a strip on the axis
      let axisInk = 0, axisN = 0; const ax = Math.round(R.X(axis)); for (let y = 0; y < R.H; y++) for (let x = ax - 3; x <= ax + 3; x++) { axisN++; axisInk += R.ink[y * R.W + x] || 0; }
      const L = rasterUnits(units, pen.nib, box, K, axis, 'letters'), mL = decoMetrics(L.ink, field, L.W, L.H, { stemFrac: 0.28 }), mA = decoMetrics(R.ink, field, R.W, R.H, { stemFrac: 0.28 });
      // letters first: texture, knots and unity of the letters alone; ornament only for how evenly the gaps are filled
      const m = { ...mL, uniformity: 0.7 * mL.uniformity + 0.3 * mA.uniformity };
      const score = 1.0 * m.uniformity - 1.5 * mL.knots + 0.35 * Math.max(-1, Math.min(1, mL.looseTop)) + 0.4 * (mL.stemEven ?? 0.5) + 1.6 * mL.unity + 0.5 * Math.min(1, mL.span / 0.85) - 1.2 * Math.max(0, axisInk / axisN - 0.18);
      cands.push({ seed, oval, ov, score, m, r, f, units, axis, box, rad, cyy });
    });
  }));
  cands.sort((a, b) => b.score - a.score); return cands;
}
// render a mirrored composition in a circle, with the reading half on the right
function renderMusenna(c, o = {}) {
  const U = o.U || 10, nib = o.nib || 1.5, pad = c.rad * 0.12, S = (c.rad + pad) * 2 * U, C = S / 2;
  const X = x => C + (x - c.axis) * U, Y = y => C - (y - c.cyy) * U, d = unitsSVG(c.units, nib, X, Y);
  const gold = o.letters || '#D8AC45', field = o.field || '#0E1736', rim = o.rim || '#D8AC45';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S.toFixed(0)} ${S.toFixed(0)}" width="${S.toFixed(0)}" height="${S.toFixed(0)}">`
    + `<defs><radialGradient id="mf" cx="50%" cy="42%" r="70%"><stop offset="0" stop-color="${o.field2 || '#1c2b5e'}"/><stop offset="1" stop-color="${field}"/></radialGradient></defs>`
    + `<rect width="100%" height="100%" fill="${o.bg || '#0b1029'}"/><circle cx="${C}" cy="${C}" r="${((c.rad + pad * 0.55) * U).toFixed(1)}" fill="${rim}"/><circle cx="${C}" cy="${C}" r="${((c.rad + pad * 0.3) * U).toFixed(1)}" fill="url(#mf)" stroke="${o.line || '#7A5A1C'}" stroke-width="${(0.12 * U).toFixed(1)}"/>`
    // the mirrored half passes over the original with a hairline in the field colour, as where one letter pierces another
    + `<g fill="${gold}"><path d="${d}"/><path transform="translate(${(2 * C).toFixed(1)},0) scale(-1,1)" d="${d}"${o.hairline ? ` stroke="${o.hairlineColour || field}" stroke-width="${(o.hairline * U).toFixed(1)}" stroke-linejoin="round" paint-order="stroke"` : ''}/>`
    + (o.quad ? `<path transform="translate(0,${(2 * C).toFixed(1)}) scale(1,-1)" d="${d}"${o.hairline ? ` stroke="${o.hairlineColour || field}" stroke-width="${(o.hairline * U).toFixed(1)}" stroke-linejoin="round" paint-order="stroke"` : ''}/><path transform="translate(${(2 * C).toFixed(1)},${(2 * C).toFixed(1)}) scale(-1,-1)" d="${d}"${o.hairline ? ` stroke="${o.hairlineColour || field}" stroke-width="${(o.hairline * U).toFixed(1)}" stroke-linejoin="round" paint-order="stroke"` : ''}/>` : '') + `</g></svg>`;
}

// ================= GIRIFT RENDERING =================
// Draw each letter group in reading order, outlined in the field colour beneath its fill, so where a later group passes
// through an earlier one a hairline shows which is on top (the practice of Kazasker Mustafa İzzet's school).
function renderGirift(r, f, o = {}) {
  const nib = o.nib || 1.5, U = o.U || 10, units = roundelParts(r, { ...o, solved: f.solved });
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; units.forEach(u => (u.s || []).forEach(q => { x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); }));
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2; let R0 = 0; units.forEach(u => (u.s || []).forEach(q => { R0 = Math.max(R0, Math.hypot(q.x - cx, q.y - cy)); }));
  R0 += nib * 1.2; const pad = R0 * 0.1, S = (R0 + pad) * 2 * U, C = S / 2, X = x => C + (x - cx) * U, Y = y => C - (y - cy) * U;
  const field = o.field || '#0E1736', gold = o.letters || '#D8AC45', hl = (o.hairline ?? 0.3) * U;
  // a pear field: round below, narrowing to a rounded neck above, drawn round the ink
  let shapeOuter = null, shapeInner = null;
  if (o.shape && SILHOUETTES[o.shape]) { const fw = SILHOUETTES[o.shape], lx0 = Math.min(...r.shapes.map((S2, i) => r.st[i].x + S2.x0)), lx1 = Math.max(...r.shapes.map((S2, i) => r.st[i].x + S2.x1)), ly0 = Math.min(...r.shapes.map((S2, i) => r.st[i].y + S2.y0)), ly1 = Math.max(...r.shapes.map((S2, i) => r.st[i].y + S2.y1));
    const mx = (lx0 + lx1) / 2, my = (ly0 + ly1) / 2, hx = (lx1 - lx0) / 2, hy = (ly1 - ly0) / 2;
    const path = g => { const pts = []; for (let k = 0; k <= 120; k++) { const v = 1 - 2 * k / 120; pts.push([mx + (fw(v) * (hx + 1.6 + g) + 0.25 * (1 - v)), my + v * (hy + 2.2 + g)]); }
      const L = pts.map(([x, y]) => `${X(x).toFixed(1)} ${Y(y).toFixed(1)}`), Rr = pts.slice().reverse().map(([x, y]) => `${X(2 * mx - x).toFixed(1)} ${Y(y).toFixed(1)}`); return 'M' + L.join('L') + 'L' + Rr.join('L') + 'Z'; };
    shapeOuter = path(0.9); shapeInner = path(0.45); }
  // the letters, group by group, with their joins; then dots and marks on top without outlines
  let groups = '';
  r.shapes.forEach((S2, i) => { const { x, y } = r.st[i]; const d = S2.b.strokes.map(st => nibPath(st.s.map(q => ({ x: q.x + x, y: q.y + y, w: q.w })), st.nib || nib, st.ang, X, Y)).join('');
    groups += `<path d="${d}" stroke="${field}" stroke-width="${hl.toFixed(1)}" stroke-linejoin="round" paint-order="stroke"/>`; });
  const marks = units.filter(u => u.dot || (u.s && (u.nib || nib) <= nib * 0.6)).map(u => u.dot ? dotPath(u.dot[0], u.dot[1], nib * u.dot[2], 69, X, Y, u.dot[3] || 0) : nibPath(u.s, u.nib || nib, u.ang, X, Y)).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S.toFixed(0)} ${S.toFixed(0)}" width="${S.toFixed(0)}" height="${S.toFixed(0)}"><defs><radialGradient id="gf" cx="50%" cy="42%" r="70%"><stop offset="0" stop-color="${o.field2 || '#1c2b5e'}"/><stop offset="1" stop-color="${field}"/></radialGradient></defs>`
    + `<rect width="100%" height="100%" fill="${o.bg || '#0b1029'}"/>` + (shapeOuter ? `<path d="${shapeOuter}" fill="${o.rim || gold}"/><path d="${shapeInner}" fill="url(#gf)"/><circle cx="${C}" cy="${(parseFloat(shapeOuter.split(' ')[1]) - 1.2 * U).toFixed(1)}" r="${(0.7 * U).toFixed(1)}" fill="${o.rim || gold}"/>` : `<circle cx="${C}" cy="${C}" r="${((R0 + pad * 0.6) * U).toFixed(1)}" fill="${o.rim || gold}"/><circle cx="${C}" cy="${C}" r="${((R0 + pad * 0.32) * U).toFixed(1)}" fill="url(#gf)"/>`)
    + `<g fill="${gold}">${groups}<path d="${marks}"/></g></svg>`;
}

// a teardrop field: round below, rising to a point above, sized round the mirrored composition's ink
function renderMusennaDrop(c, o = {}) {
  const U = o.U || 10, nib = o.nib || 1.5; let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  c.units.forEach(u => (u.s || []).concat(u.dot ? [{ x: u.dot[0], y: u.dot[1] }] : []).forEach(q => { x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); }));
  const half = Math.max(x1 - c.axis, c.axis - x0) + nib * 1.4, top = y1 + nib, bot = y0 - nib, padB = (o.padB ?? 1.6), rb = half + padB;
  const cyb = bot - padB + rb, tipY = top + (o.tip ?? 0.55) * (top - bot) * 0.6, W = (rb + 3) * 2 * U, H = (tipY - (cyb - rb) + 4) * U;
  const X = x => W / 2 + (x - c.axis) * U, Y = y => (tipY + 2 - y) * U, d = unitsSVG(c.units, nib, X, Y);
  const drop = (g) => { const r = rb + g, cy = cyb, tip = tipY + g * 1.4; // tip, down the right side to the widest point, round the bottom, back up
    return `M${X(c.axis).toFixed(1)} ${Y(tip).toFixed(1)} C${X(c.axis + r * 0.35).toFixed(1)} ${Y(tip - (tip - cy) * 0.35).toFixed(1)} ${X(c.axis + r).toFixed(1)} ${Y(cy + r * 0.75).toFixed(1)} ${X(c.axis + r).toFixed(1)} ${Y(cy).toFixed(1)} A${(r * U).toFixed(1)} ${(r * U).toFixed(1)} 0 0 1 ${X(c.axis - r).toFixed(1)} ${Y(cy).toFixed(1)} C${X(c.axis - r).toFixed(1)} ${Y(cy + r * 0.75).toFixed(1)} ${X(c.axis - r * 0.35).toFixed(1)} ${Y(tip - (tip - cy) * 0.35).toFixed(1)} ${X(c.axis).toFixed(1)} ${Y(tip).toFixed(1)}Z`; };
  const gold = o.letters || '#D8AC45', field = o.field || '#0E1736', hl = o.hairline ? ` stroke="${o.hairlineColour || field}" stroke-width="${(o.hairline * U).toFixed(1)}" stroke-linejoin="round" paint-order="stroke"` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W.toFixed(0)} ${H.toFixed(0)}" width="${W.toFixed(0)}" height="${H.toFixed(0)}"><defs><radialGradient id="df" cx="50%" cy="62%" r="70%"><stop offset="0" stop-color="${o.field2 || '#1c2b5e'}"/><stop offset="1" stop-color="${field}"/></radialGradient></defs>`
    + `<rect width="100%" height="100%" fill="${o.bg || '#0b1029'}"/><path d="${drop(0.9)}" fill="${o.rim || gold}"/><path d="${drop(0.45)}" fill="url(#df)"/>`
    + `<g fill="${gold}"><path d="${d}"/><path transform="translate(${W.toFixed(1)},0) scale(-1,1)" d="${d}"${hl}/>`
    // a finial answering the drop's point: a small eight-petalled rosette with a bead above, on the axis
    + (o.finial ? (() => { const fx = X(c.axis), fy = Y(top + (tipY - top) * 0.42), pr = (o.finial * U); let p = '';
        for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, ex = fx + Math.cos(a) * pr, ey = fy + Math.sin(a) * pr, l = Math.cos(a + 0.5) * pr * 0.4, m = Math.sin(a + 0.5) * pr * 0.4, l2 = Math.cos(a - 0.5) * pr * 0.4, m2 = Math.sin(a - 0.5) * pr * 0.4;
          p += `M${fx.toFixed(1)} ${fy.toFixed(1)}Q${(fx + l2 * 1.6).toFixed(1)} ${(fy + m2 * 1.6).toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}Q${(fx + l * 1.6).toFixed(1)} ${(fy + m * 1.6).toFixed(1)} ${fx.toFixed(1)} ${fy.toFixed(1)}Z`; }
        return `<path d="${p}"/><circle cx="${fx.toFixed(1)}" cy="${fy.toFixed(1)}" r="${(pr * 0.22).toFixed(1)}" fill="${field}"/><circle cx="${fx.toFixed(1)}" cy="${(fy - pr * 1.7).toFixed(1)}" r="${(pr * 0.2).toFixed(1)}"/>`; })() : '')
    + `</g></svg>`;
}

// ================= MÜSENNÂ, COMBINED =================
// In a mirrored composition the halves are one design: what falls on or near an axis is shared, not doubled. Dots that
// overlap their mirror images merge into one dot (a symmetric diamond, at the centre of what merged); vowel marks and
// ornaments that overlap their mirror images are centred on the axis and drawn once; letters fuse where they meet (one
// filled shape, no hairline). Mirrored marks are drawn with the mirrored pen angle, so thick and thin mirror too.
function renderMusennaCombined(c, o = {}) {
  const U = o.U || 10, nib = o.nib || 1.5, pad = c.rad * 0.12, S = (c.rad + pad) * 2 * U, C = S / 2, ax = c.axis, cy0 = c.cyy;
  const X = x => C + (x - ax) * U, Y = y => C - (y - cy0) * U;
  const isLetter = u => u.s && !u.dot && (u.nib || nib) > nib * 0.6, letters = c.units.filter(isLetter);
  const marks = c.units.filter(u => u.s && !u.dot && !isLetter(u)), dots = c.units.filter(u => u.dot);
  // the mirror copies: across the vertical axis, and for double symmetry across the horizontal axis too
  const copies = o.quad ? [[1, 1], [-1, 1], [1, -1], [-1, -1]] : [[1, 1], [-1, 1]];
  const mx = (x, sx) => sx > 0 ? x : 2 * ax - x, my = (y, sy) => sy > 0 ? y : 2 * cy0 - y;
  const mang = (a, sx, sy) => (sx * sy > 0 ? a : 180 - a);
  // dots, group by group (dots within about a dot's reach belong together, like a ya's pair). A group that overlaps its own
  // mirror image becomes one shared group with the same number of dots, arranged symmetrically on that axis.
  const reach = nib * 0.95, groupsD = []; dots.forEach(u => { const d = { x: u.dot[0], y: u.dot[1], s: u.dot[2] }; const g = groupsD.find(G => G.some(e => Math.hypot(e.x - d.x, e.y - d.y) < nib * 1.6)); g ? g.push(d) : groupsD.push([d]); });
  const sym = (n, cx, cy, s, vertical) => { const h = nib * s * 0.62; // n dots, symmetric about the axis through (cx, cy)
    if (n === 1) return [[cx, cy]]; if (n === 2) return vertical ? [[cx, cy - h], [cx, cy + h]] : [[cx - h, cy], [cx + h, cy]];
    return vertical ? [[cx, cy - 2 * h], [cx, cy], [cx, cy + 2 * h]] : [[cx - 1.15 * h, cy - 0.5 * h], [cx + 1.15 * h, cy - 0.5 * h], [cx, cy + 0.85 * h]]; };
  const overlapsMirror = (g, f) => g.some(a2 => g.some(b2 => { const m = f(b2); return Math.hypot(a2.x - m.x, a2.y - m.y) < reach * Math.max(a2.s, b2.s); }));
  const out = []; // [x, y, s, angle]
  groupsD.forEach(g => { const n = g.length, s = Math.max(...g.map(d => d.s)), cx = g.reduce((v, d) => v + d.x, 0) / n, cyy = g.reduce((v, d) => v + d.y, 0) / n;
    const onV = overlapsMirror(g, d => ({ x: 2 * ax - d.x, y: d.y })), onH = o.quad && overlapsMirror(g, d => ({ x: d.x, y: 2 * cy0 - d.y }));
    if (onV && onH) sym(n, ax, cy0, s, false).forEach(([x, y]) => out.push([x, y, s, 45]));
    else if (onV) [1].concat(o.quad ? [-1] : []).forEach(sy => sym(n, ax, my(cyy, sy), s, false).forEach(([x, y]) => out.push([x, y, s, 45])));
    else if (onH) [1, -1].forEach(sx => sym(n, mx(cx, sx), cy0, s, true).forEach(([x, y]) => out.push([x, y, s, 45])));
    else g.forEach(d => copies.forEach(([sx, sy]) => out.push([mx(d.x, sx), my(d.y, sy), d.s, mang(69, sx, sy)]))); });
  const dotD = out.map(([x, y, s, a2]) => dotPath(x, y, nib * s, a2, X, Y, 0)).join('');
  // marks: a mark that overlaps its own mirror image is centred on that axis and drawn once
  let markD = '';
  marks.forEach(u => { let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; u.s.forEach(q => { x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); });
    const cx = (x0 + x1) / 2, cyy = (y0 + y1) / 2, hw = (x1 - x0) / 2 + nib * 0.3, hh = (y1 - y0) / 2 + nib * 0.3;
    const onV = Math.abs(cx - ax) < hw, onH = o.quad && Math.abs(cyy - cy0) < hh;
    const base = u.s.map(q => ({ ...q, x: onV ? q.x + (ax - cx) : q.x, y: onH ? q.y + (cy0 - cyy) : q.y }));
    // a mark on an axis is shared, so it must be symmetric itself; a slanted mark (fatha, kasra) there would break the
    // symmetry, and vowels are optional in decorative work, so it is left out
    if ((onV || onH) && o.keepAsymmetricShared !== true) { const pts = base.map(q => [q.x - (onV ? ax : 0), q.y]); const mirrored = pts.map(([x, y]) => [-x, y]);
      const err = pts.reduce((m, [x, y]) => Math.max(m, Math.min(...mirrored.map(([x2, y2]) => Math.hypot(x - x2, y - y2)))), 0); if (err > nib * 0.45) return; }
    const use = copies.filter(([sx, sy]) => (onV ? sx > 0 : true) && (onH ? sy > 0 : true));
    use.forEach(([sx, sy]) => { markD += nibPath(base.map(q => ({ ...q, x: mx(q.x, sx), y: my(q.y, sy) })), u.nib || nib, mang(u.ang ?? 70, sx, sy), X, Y); }); });
  // letters: the original and its mirror images as one filled shape
  const shared = [], own = [];
  letters.forEach(u => { let x0 = 1e9, x1 = -1e9; u.s.forEach(q => { x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); }); const cx = (x0 + x1) / 2, hw = (x1 - x0) / 2;
    // across the axis: its own mirror image covers most of it (centre within a nib of the axis, and the stroke is narrow)
    if (o.shareStrokes !== false && Math.abs(cx - ax) < nib * 1.1 && hw < nib * 2.2) shared.push({ ...u, s: u.s.map(q => ({ ...q, x: q.x + (ax - cx) })) }); else own.push(u); });
  const letD = unitsSVG(own, nib, X, Y), sharedD = shared.map(u => nibPath(u.s, u.nib || nib, 90, X, Y)).join('');
  const T = ([sx, sy]) => `translate(${sx > 0 ? 0 : (2 * C).toFixed(1)},${sy > 0 ? 0 : (2 * C).toFixed(1)}) scale(${sx},${sy})`;
  const gold = o.letters || '#D8AC45', field = o.field || '#0E1736', rim = o.rim || '#D8AC45';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S.toFixed(0)} ${S.toFixed(0)}" width="${S.toFixed(0)}" height="${S.toFixed(0)}">`
    + `<defs><radialGradient id="mf" cx="50%" cy="42%" r="70%"><stop offset="0" stop-color="${o.field2 || '#1c2b5e'}"/><stop offset="1" stop-color="${field}"/></radialGradient></defs>`
    + `<rect width="100%" height="100%" fill="${o.bg || '#0b1029'}"/><circle cx="${C}" cy="${C}" r="${((c.rad + pad * 0.55) * U).toFixed(1)}" fill="${rim}"/><circle cx="${C}" cy="${C}" r="${((c.rad + pad * 0.3) * U).toFixed(1)}" fill="url(#mf)" stroke="${o.line || '#7A5A1C'}" stroke-width="${(0.12 * U).toFixed(1)}"/>`
    + `<g fill="${gold}">` + copies.map(cp => `<path transform="${T(cp)}" d="${letD}"/>`).join('') + (o.quad ? [[1, 1], [1, -1]].map(cp => `<path transform="${T(cp)}" d="${sharedD}"/>`).join('') : `<path d="${sharedD}"/>`) + `<path d="${dotD}${markD}"/></g></svg>`;
}
