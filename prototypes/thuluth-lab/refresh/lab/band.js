
// ================= READING-ORDER BAND COMPOSER =================
// Long inscriptions: each word is composed on its own (stacked inside), then the words are placed strictly right to left:
// every word starts left of where the one before it started, slides as far right as it can without touching anything
// already placed (so it may tuck under a bowl or an elongation), and chooses among a few heights within the band.
function maskOverlap(A, ax, ay, B, bx, by, K) {
  const dx = Math.round((bx + B.x0 - (ax + A.x0)) * K), dy = Math.round(((ay + A.y1) - (by + B.y1)) * K);
  const xs = Math.max(0, dx), xe = Math.min(A.W, dx + B.W), ys = Math.max(0, dy), ye = Math.min(A.H, dy + B.H); if (xs >= xe || ys >= ye) return 0;
  let c = 0; for (let y = ys; y < ye; y++) { const ra = y * A.W, rb = (y - dy) * B.W - dx; for (let x = xs; x < xe; x++) if (A.dil[ra + x] && B.mask[rb + x]) c++; }
  return c;
}
function bandCompose(text, o = {}) {
  bandCompose.dropped = []; const K = o.K || 1.6, words = text.trim().split(/\s+/), tier = o.tier ?? 3.2, minStep = o.minStep ?? 1.2, placed = [], groupsOut = [], shapesOut = [], stOut = [];
  let prevStart = 0, prevLeft = 0, first = true;
  words.forEach((w, wi) => {
    // candidates for this word: its own best stacked arrangements
    const rs = composeRoundel(w, { ...o, tries: o.wordTries || 3, iters: o.wordIters || 1800, seed: (o.seed || 11) + wi * 101, oval: o.wordOval || 1.4 });
    const cands = []; rs.sort((a, b) => a.E - b.E).forEach(r => { if (cands.length < (o.cands || 2) && !cands.some(c => Math.abs(c.E - r.E) < 0.5)) cands.push(r); });
    let best = null;
    cands.forEach(r => {
      // the word's own frame: its start is its rightmost ink
      let wx1 = -1e9, wy0 = 1e9, wy1 = -1e9; r.shapes.forEach((S, i) => { wx1 = Math.max(wx1, r.st[i].x + S.x1); wy0 = Math.min(wy0, r.st[i].y + S.y0); wy1 = Math.max(wy1, r.st[i].y + S.y1); });
      const midY = (wy0 + wy1) / 2;
      (o.heights || [0, tier, -tier]).forEach(h => {
        const half = Math.max(o.bandHalf || 9, (wy1 - wy0) / 2 + 0.3), oy = h - midY; if (wy0 + oy < -half || wy1 + oy > half) return; // the band grows to hold its tallest word
        // slide in from the right limit until nothing collides
        // a word may tuck only a little way under the end of the one before it, never into its interior
        let limit = first ? 0 : Math.min(prevStart - minStep, prevLeft + (o.tuck ?? 2.5)), x = null;
        for (let ox = limit - wx1; ox > limit - wx1 - 120; ox -= 0.35) {
          // a word must sit clear of everything placed, with a perceptible gap: test it nudged right by the word gap too
          let hit = 0; for (const gx of [0, o.wordGap ?? 1.0, (o.wordGap ?? 1.0) * 0.5]) { for (let i = 0; i < r.shapes.length && !hit; i++) for (const p of placed) { hit += maskOverlap(p.S, p.x, p.y, r.shapes[i], r.st[i].x + ox + gx, r.st[i].y + oy, K) + maskOverlap(r.shapes[i], r.st[i].x + ox + gx, r.st[i].y + oy, p.S, p.x, p.y, K); if (hit) break; } if (hit) break; }
          if (!hit) { x = ox; break; } }
        if (x == null) return;
        const score = x + wx1 - 0.55 * Math.abs(h) - 0.25 * r.E; // as far right as possible, near the middle line, a good word shape
        let wx0 = 1e9; r.shapes.forEach((S, i) => { wx0 = Math.min(wx0, r.st[i].x + S.x0); });
        if (!best || score > best.score) best = { score, r, ox: x, oy, start: x + wx1, left: x + wx0 };
      });
    });
    if (!best) { (bandCompose.dropped = bandCompose.dropped || []).push(w); return; } // never silently: the caller reports dropped words
    best.r.shapes.forEach((S, i) => { const x = best.r.st[i].x + best.ox, y = best.r.st[i].y + best.oy; placed.push({ S, x, y }); shapesOut.push(S); stOut.push({ x, y }); groupsOut.push({ ...best.r.groups[i], word: wi }); });
    prevStart = best.start; prevLeft = best.left; first = false;
  });
  // the result looks like a composed roundel, so the mark solver and the band renderer can finish it
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; shapesOut.forEach((S, i) => { x0 = Math.min(x0, stOut[i].x + S.x0); x1 = Math.max(x1, stOut[i].x + S.x1); y0 = Math.min(y0, stOut[i].y + S.y0); y1 = Math.max(y1, stOut[i].y + S.y1); });
  const hh = (y1 - y0) / 2 + 2.5, ov = ((x1 - x0) / 2 + 3) / hh;
  return { shapes: shapesOut, st: stOut, groups: groupsOut, disc: { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, r: hh * 1.05, oval: ov, ink: 0 }, E: 0, width: x1 - x0, height: y1 - y0 };
}
