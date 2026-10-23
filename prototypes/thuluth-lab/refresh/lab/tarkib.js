
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
// Stacking learned from 70 master thuluth compositions (Calliar, hand-labelled): how often a join is stacked, by the letter
// after it. With LEARNED_STACK on, any join whose next letter stacks at least STACK_MIN of the time may be stacked, weighted
// by that frequency relative to mim; off, the original rule (only before hah and mim).
const STACK_PRIOR = {"ra": 0.559, "dal": 0.5, "hah": 0.438, "mim": 0.402, "nun": 0.306, "waw": 0.268, "ya": 0.216, "sin": 0.125, "ain": 0.125, "sad": 0.083, "lam": 0.071, "kaf": 0.062, "fa": 0.031, "ha": 0.026, "alif": 0.024, "tooth": 0.015};
let LEARNED_STACK = false, STACK_MIN = 0.2;
const stackFam = f => { const fam = FAM[f.c]; if (f.form === 'fin' && (f.c === 'ي' || f.c === 'ى')) return 'ya'; if (fam === 'nun' && f.form === 'fin') return 'nun'; return fam; };
function stackWeight(s, i) { if (!LEARNED_STACK) return 1; const f = forms(s)[i]; return Math.min(1.4, (STACK_PRIOR[stackFam(f)] || 0) / 0.4); }
// the letters whose final forms are bowls that can hold another word (Derman: the kâse of ra, nun, waw; the çanak of ya)
const NEST_BOWLS = new Set(['ر', 'ز', 'و', 'ن', 'ي', 'ى']);
function stackable(s) {
  const fs = forms(s), out = [];
  for (let i = 1; i < fs.length; i++) { const f = fs[i], fam = FAM[f.c]; if (!(f.form === 'med' || f.form === 'fin') || fs[i - 1].form === 'iso') continue;
    if (LEARNED_STACK ? (STACK_PRIOR[stackFam(f)] || 0) >= STACK_MIN : (fam === 'hah' || fam === 'mim')) out.push(i); }
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
      const v3 = groupShape(g, L, o, K, st, joins[c]); if (v3 && groupShapeOk(g, L, o, st, joins[a])) { v3.cost = 0.3 * L - 0.9 * (stackWeight(g.s, joins[a]) + stackWeight(g.s, joins[c])) * (o.stackPull ?? 1.6); v3.stacked = true; out.push(v3); }
    }
    if (o.towers && joins.length >= 3) { const J = joins.slice(0, 6), TO = [DEEP_OFFSETS[0], DEEP_OFFSETS[1]];
      for (let a = 0; a < J.length; a++) for (let c = a + 1; c < J.length; c++) for (let e = c + 1; e < J.length; e++) for (const oa of TO) for (const oc of TO) for (const oe of TO) {
        const off = q => ({ dx: q.dx * BODY / 1.25, dy: q.dy * BODY / 1.25 }), st = { [J[a]]: off(oa), [J[c]]: off(oc), [J[e]]: off(oe) };
        if (!groupShapeOk(g, L, o, st, J[a]) || !groupShapeOk(g, L, o, st, J[c])) continue;
        const v4 = groupShape(g, L, o, K, st, J[e]); if (v4) { v4.cost = 0.3 * L - (o.towerPull ?? 1.0) * (stackWeight(g.s, J[a]) + stackWeight(g.s, J[c]) + stackWeight(g.s, J[e])) * (o.stackPull ?? 1.6); v4.stacked = true; v4.tower = 3; out.push(v4); } } }
    joins.forEach(j => (o.deep ? STACK_OFFSETS.concat(DEEP_OFFSETS) : STACK_OFFSETS).forEach(off => {
      const v2 = groupShape(g, L, o, K, { [j]: { dx: off.dx * BODY / 1.25, dy: off.dy * BODY / 1.25 } }, j);
      if (v2) { v2.cost = 0.3 * L - stackWeight(g.s, j) * (o.stackPull ?? 1.6); v2.stacked = true; out.push(v2); }
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
      if (Math.min(...ys) - (last.oy || 0) < (o.nest && NEST_BOWLS.has(last.c) ? -1.8 : -3.2)) { const xs = ps.map(q => q[0]); shelves.push({ x0: Math.min(...xs) + 1.2, x1: Math.max(...xs) - 1.2, y: Math.min(...ys) + 1.1, cradle: true }); } } }
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
