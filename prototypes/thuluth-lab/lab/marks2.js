
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
