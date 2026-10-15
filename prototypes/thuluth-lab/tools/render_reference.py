"""Render the reference set from the lab bundle, twice, and check the output is identical (determinism).

  python render_reference.py            # writes ../reference/golden/*.svg and reports any run-to-run difference

These are the 'lab golden' references for the port: the TypeScript engine should match them by pixel diff within a
tolerance (they will not match byte-for-byte once the canvas rasteriser is replaced).
"""
import json, os, re, hashlib
from playwright.sync_api import sync_playwright
here = os.path.dirname(os.path.abspath(__file__)); root = os.path.join(here, '..'); lab = os.path.join(root, 'lab')
js = ''.join(open(os.path.join(lab, f)).read() for f in ['engine3.js', 'tarkib.js', 'roundel.js', 'ring.js', 'marks2.js', 'iznik.js', 'counters.js', 'multigrid.js', 'fitted.js', 'learned.js', 'bowl.js'])
recipe = json.load(open(os.path.join(root, 'layouts', 'zainab-qusay.json')))
SPEC = ['زينب وقصي', 'بسم الله الرحمن الرحيم', 'محمد رسول الله', 'الحمد لله', 'قصي', 'صبر', 'سبحان الله', 'حافظوا على', 'مودة ورحمة']
def run():
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page(); pg.set_content('<body></body>'); pg.add_script_tag(content=js)
        out = pg.evaluate("""([SPEC, rc]) => { const res = {};
          // line specimens: the current letter set at the roundel pen and at the tile pen
          BODY = 1.45; NIB_FLOOR = 0.3; LOOP_GAP = 1.8; useLearned(true, 1 / 1.25 * 1.12);
          SPEC.forEach((t, i) => { res['line-' + String(i).padStart(2, '0') + '-roundel'] = renderLine(t, { U: 10, nib: 1.6, ang: 69, pad: 2 }); });
          BODY = 1.25; NIB_FLOOR = 0.43; LOOP_GAP = 0.9; useLearned(true, 1 / 1.25 * 1.12);
          SPEC.forEach((t, i) => { res['line-' + String(i).padStart(2, '0') + '-tile'] = renderLine(t, { U: 10, nib: 0.95, ang: 69, pad: 2 }); });
          // the pinned wedding cartouche
          BODY = 1.45; NIB_FLOOR = 0.3; LOOP_GAP = 1.8; useLearned(true, 1 / 1.25 * 1.12); const pen = { nib: 1.6, ang: 69 };
          useGreat(true, { ya: true, yaWide: 2.6, yaDeep: 1.3 }); const fx = JSON.parse(JSON.stringify(rc.layout)); fx.wp[0].y += 1.4;
          const r = composeRoundel(rc.text, { ...pen, elongate: true, cross: true, fillTarget: 0.5, noRise: true, cradle: true, oval: 1.45, emph: 'ب', kern: true, tries: 1, fixed: fx })[0];
          const wi = r.groups.findIndex(g => g.s === 'و'); scaleGroup(r, wi, 0.62, pen.nib); r.groups[wi].tint = '#2aa6a0'; placeUnder(r, wi, 1, 0.7, 0);
          shapeBowl(r, { oval: 1.45, clear: 5.6, autoOval: true }); const f = fitFrame(r, { ...pen, markReach: 2.2, ornaments: true, density: 0.6 });
          res['cartouche-zainab-qusay'] = renderRoundel(r, { ...pen, U: 12, field: '#1f3f8f', gold: '#f4f6f7', goldDark: '#16306e', outline: '#16306e', bg: '#f4f6f7', solved: f.solved, discScale: 1.0, noOutline: true, counters: '#2aa6a0' });
          useGreat(false);
          // the tilings
          [8, 10, 12].forEach(fold => { res['tiling-' + fold + 'fold'] = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="800" height="800">${iznikField(800, { fold, density: 3 })}</svg>`; });
          return res; }""", [SPEC, recipe])
        b.close(); return out
norm = lambda s: re.sub(r'\b(gd|fd|r)\d+\b', 'id', s)  # renderer ids are counters, not content
a, b2 = run(), run(); diff = [k for k in a if norm(a[k]) != norm(b2[k])]
os.makedirs(os.path.join(root, 'reference', 'golden'), exist_ok=True)
for k, v in a.items(): open(os.path.join(root, 'reference', 'golden', k + '.svg'), 'w').write(v)
print(len(a), 'references written;', 'deterministic' if not diff else 'NOT deterministic: ' + ', '.join(diff))
