import json, base64, io, sys, numpy as np
from PIL import Image
from scipy import ndimage as ndi
from playwright.sync_api import sync_playwright
js = open('/tmp/deco.js').read(); D = np.array(json.load(open('debris.json'))['F']); mu, sd = D[:, 1:3].mean(0), D[:, 1:3].std(0)
CP = {p['name']: p['subpaths'] for p in json.load(open('calliar_picks.json'))}
disk = lambda r: (lambda y, x: x * x + y * y <= r * r)(*np.mgrid[-r:r + 1, -r:r + 1])
def noise(png):
    a = np.asarray(Image.open(io.BytesIO(png)).convert('RGB').resize((480, 480))).astype(int); ink = (a[..., 0] > 150) & (a[..., 0] - a[..., 2] > 60)
    yy, xx = np.mgrid[0:480, 0:480]; ink &= ((xx - 240) ** 2 + (yy - 240) ** 2) < (240 * 0.87) ** 2; A = ink.sum() + 1
    notch = (ndi.binary_closing(ink, disk(2)) & ~ink).sum() / A * 100; holes = ndi.binary_fill_holes(ink) & ~ink; hl, hn = ndi.label(holes)
    pin = ((ndi.sum(holes, hl, range(1, hn + 1)) < 40).sum() if hn else 0) / (A / 10000); return float((notch - mu[0]) / sd[0] + (pin - mu[1]) / sd[1])
text, label, names = sys.argv[1], sys.argv[2], sys.argv[3].split(',')
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 560, 'height': 560}); out = []
    for nm in names:
        pg.set_content('<body></body>'); pg.add_script_tag(content=js)
        path = CP.get(nm); lanes = {'deg': float(nm.split(':')[1])} if nm.startswith('lanes:') else None
        r = pg.evaluate("""([text, nm, path, lanes]) => { BODY = 1.45; NIB_FLOOR = 0.3; LOOP_GAP = 1.4; LEARNED_STACK = true; useLearned(true, 1 / 1.25 * 1.12); const pen = { nib: 1.5, ang: 69 };
          const P = lanes ? null : (path || PATHS[nm]); const r = composeRoundel(text, { ...pen, tries: 1, iters: 4500, seed: 29, elongate: true, cross: true, merge: true, deep: true, fillTarget: 0.5, oval: 1.0, girift: 0.05, towers: true, path: P, lanes, pathTol: 1.4, pathFill: 0.7 })[0]; const fit = composeRoundel.lanes; composeRoundel.lanes = null;
          const f = finishRoundel(r, '', { ...pen, ornaments: true, density: 0.35 }); LEARNED_STACK = false;
          return { svg: renderGirift(r, f, { ...pen, U: 9, hairline: 0 }), stacked: r.shapes.filter(S => S.stacked).length, towers: r.shapes.filter(S => S.tower).length, fit }; }""", [text, nm, path, lanes])
        pg.set_content(f'<body style="margin:0;background:#0b1029;display:grid;place-items:center;width:560px;height:560px"><img src="data:image/svg+xml;base64,{base64.b64encode(r["svg"].encode()).decode()}" style="width:540px;height:540px"></body>'); pg.wait_for_timeout(250)
        png = pg.screenshot(type='png'); r['noise'] = noise(png); r['jpg'] = 'data:image/jpeg;base64,' + base64.b64encode(pg.screenshot(type='jpeg', quality=80)).decode(); r['path'] = nm
        out.append(r); print(f'  {label:8} {nm:11} lanes {r.get("fit")} stacked {r["stacked"]}, towers {r["towers"]}, noise {r["noise"]:+.2f}', flush=True)
    b.close()
json.dump(out, open(f'path_{label}.json', 'w'))
