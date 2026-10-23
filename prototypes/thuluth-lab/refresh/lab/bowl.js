
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
// How a roundel compares with the Husayn benchmark: the share of the disc the name's ink covers, and how far it spans.
function roundelScore(r, f, o = {}) {
  const nib = o.nib || 1.3, units = roundelParts(r, { ...o, solved: f.solved }), d = r.disc, OV = d.oval || 1;
  let R0 = d.r * (f.discScale || 1); units.forEach(u => { if (u.s) u.s.forEach(q => { R0 = Math.max(R0, Math.hypot((q.x - d.cx) / OV, q.y - d.cy) + nib * 0.7); }); });
  const Rin = R0 * 1.03, K = 6, Wd = Math.ceil(2 * Rin * OV * K), Hd = Math.ceil(2 * Rin * K), cv = document.createElement('canvas'); cv.width = Wd; cv.height = Hd; const cx = cv.getContext('2d', { willReadFrequently: true }); cx.fillStyle = '#000';
  const X = x => (x - d.cx + Rin * OV) * K, Y = y => (d.cy + Rin - y) * K;
  units.forEach(u => { if (u.dot) cx.fill(new Path2D(dotPath(u.dot[0], u.dot[1], nib * u.dot[2], o.ang || 69, X, Y))); else if (u.s) cx.fill(new Path2D(nibPath(u.s, u.nib || nib, u.ang, X, Y))); });
  const px = cx.getImageData(0, 0, Wd, Hd).data; let ink = 0, inDisc = 0, x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (let y = 0; y < Hd; y++) for (let x = 0; x < Wd; x++) { const ex = (x / K - Rin * OV) / (Rin * OV), ey = (y / K - Rin) / Rin; if (ex * ex + ey * ey > 1) continue; inDisc++; if (px[(y * Wd + x) * 4 + 3] > 100) { ink++; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } }
  return { fill: ink / inDisc, spanx: (x1 - x0) / Wd, spany: (y1 - y0) / Hd };
}
