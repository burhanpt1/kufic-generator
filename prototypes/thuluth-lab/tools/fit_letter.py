"""Fit one engine letter to a photo target (analysis by synthesis), in headless Chromium.

The engine draws the letter with the photo's pen; a search adjusts its control points, size and position until its ink
matches the target's (intersection over union), holding points that fall outside the box, and the joins, in place.

  python fit_letter.py TARGET.json LETTER FORM NIB_PX --out fit.json
  e.g. python fit_letter.py ../data/targets/waw.json و fin 14 --out waw.json

NIB_PX is the photo's widest stroke in pixels (measure it from the mask's distance transform along its skeleton).
Converting a fit into engine units (see HANDOVER.md, 'Master fits'): k = engine_nib * fit.s / NIB_PX / BODY, then put the
join at the origin (final and medial forms) or the exit on the baseline (initial forms).
"""
import argparse, json, os
from playwright.sync_api import sync_playwright
here = os.path.dirname(os.path.abspath(__file__)); lab = os.path.join(here, '..', 'lab')
ap = argparse.ArgumentParser(); ap.add_argument('target'); ap.add_argument('letter'); ap.add_argument('form'); ap.add_argument('nibpx', type=float)
ap.add_argument('--iters', type=int, default=9000); ap.add_argument('--out', required=True); o = ap.parse_args()
js = ''.join(open(os.path.join(lab, f)).read() for f in ['engine3.js', 'tarkib.js', 'roundel.js', 'ring.js', 'marks2.js', 'iznik.js', 'counters.js', 'multigrid.js', 'fitted.js', 'learned.js', 'bowl.js', 'fit.js'])
tgt = json.load(open(o.target))
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(); pg.set_content('<body></body>'); pg.add_script_tag(content=js)
    r = pg.evaluate("""([tgt, c, form, nibPx, iters]) => { BODY = 1.25; NIB_FLOOR = 0.43; useLearned(true, 1 / 1.25 * 1.12); gcache.clear();
      const g = glyphFor(c, form), before = fitGlyph(tgt, JSON.parse(JSON.stringify(g)), { nibPx, iters: 2500, shapeFrozen: true }), res = fitGlyph(tgt, JSON.parse(JSON.stringify(g)), { nibPx, iters });
      return { iouBefore: before.iou, iou: res.iou, s: res.s, tx: res.tx, ty: res.ty, fitted: res.fitted, original: g.s.map(s => s.pts) }; }""", [tgt, o.letter, o.form, o.nibpx, o.iters])
    b.close()
json.dump(r, open(o.out, 'w')); print(f"IoU {r['iouBefore']:.3f} -> {r['iou']:.3f}, scale {r['s']:.1f} px/unit")
