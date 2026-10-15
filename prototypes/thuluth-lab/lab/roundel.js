
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
