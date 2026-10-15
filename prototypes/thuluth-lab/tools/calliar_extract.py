import json, glob, collections, numpy as np
LET = {'ا': 'alif', 'ل': 'lam', 'ٮ': 'tooth', 'ى': 'ya', 'ں': 'nun', 'م': 'mim', 'ه': 'ha', 'ر': 'ra', 'و': 'waw', 'د': 'dal', 'ح': 'hah', 'ٯ': 'fa', 'ع': 'ain', 'س': 'sin', 'ص': 'sad', 'ﺻ': 'sad', 'ﻛ': 'kaf'}
NONJOIN = {'alif', 'ra', 'waw', 'dal'}
def resample(p, n=48):
    p = np.asarray(p, float); d = np.r_[0, np.cumsum(np.hypot(*np.diff(p, axis=0).T))]
    if d[-1] < 1e-6: return None
    t = np.linspace(0, d[-1], n); return np.c_[np.interp(t, d, p[:, 0]), np.interp(t, d, p[:, 1])]
inst = collections.defaultdict(list)
for f in glob.glob('calliar_dataset/ds/dataset/*/*.json'):
    d = json.load(open(f)); strokes = [(k, np.asarray(v, float)) for s in d for k, v in s.items() if k in LET and len(v) > 3]
    alifs = [s for k, s in strokes if k == 'ا']
    if not alifs: continue
    H = np.median([s[:, 1].max() - s[:, 1].min() for s in alifs])
    if H < 10: continue
    sc = 10.0 / H; tol = 0.55 / sc  # connection tolerance: about half a unit
    for i, (k, s) in enumerate(strokes):
        fam = LET[k]; ends = [s[0], s[-1]]; conn = [None, None]
        for e_i, e in enumerate(ends):
            for j, (k2, s2) in enumerate(strokes):
                if j == i: continue
                dmin = np.min(np.hypot(s2[:, 0] - e[0], s2[:, 1] - e[1]))
                if dmin < tol: conn[e_i] = s2.mean(axis=0); break
        nc = sum(c is not None for c in conn)
        # form from the connections: a neighbour to the right is the letter before (Arabic runs right to left)
        if nc == 0: form = 'iso'
        elif nc == 2: form = 'med'
        else:
            ci = 0 if conn[0] is not None else 1; nb = conn[ci]
            form = 'fin' if nb[0] > s[:, 0].mean() else 'ini'
        if fam in NONJOIN and form in ('ini', 'med'): continue
        # orient: start where the pen enters (the join from the previous letter, or the free end for an initial)
        if form in ('fin', 'med'):
            if nc == 2: start_right = s[0][0] > s[-1][0]; pts = s if start_right else s[::-1]
            else: pts = s if conn[0] is not None else s[::-1]
        elif form == 'ini': pts = s if conn[1] is not None else s[::-1]
        else: pts = s if (s[0][0] * 0.3 - s[0][1]) >= (s[-1][0] * 0.3 - s[-1][1]) else s[::-1]
        r = resample(pts)
        if r is None: continue
        r = (r - r[0]) * sc; r[:, 1] *= -1  # entry at the origin, y up, alif = 10 units
        inst[(fam, form)].append(r)
print({f'{k[0]}:{k[1]}': len(v) for k, v in sorted(inst.items())})
np.save('/home/claude/inst.npy', {f'{k[0]}|{k[1]}': np.array(v) for k, v in inst.items()}, allow_pickle=True)
