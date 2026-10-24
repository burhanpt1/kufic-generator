import json, numpy as np, collections
LET = {'ا': 'alif', 'ل': 'lam', 'ٮ': 'tooth', 'ى': 'ya', 'ں': 'nun', 'م': 'mim', 'ه': 'ha', 'ر': 'ra', 'و': 'waw', 'د': 'dal', 'ح': 'hah', 'ٯ': 'fa', 'ع': 'ain', 'س': 'sin', 'ص': 'sad', 'ﺻ': 'sad', 'ﻛ': 'kaf'}
NONJOIN = {'alif', 'ra', 'waw', 'dal'}
files = json.load(open('/home/claude/thuluth_labelled.json'))
pairs = collections.Counter(); stacks = collections.Counter(); dys = collections.defaultdict(list)
for f in files:
    d = json.load(open(f)); S = [(LET[k], np.asarray(v, float)) for s in d for k, v in s.items() if k in LET and len(v) > 3]
    al = [s for k, s in S if k == 'alif']
    if not al: continue
    H = np.median([s[:, 1].max() - s[:, 1].min() for s in al]); tol = 0.055 * H
    for i, (fa, a) in enumerate(S):
        if fa in NONJOIN: continue
        for j, (fb, b) in enumerate(S):
            if i == j: continue
            # a joins b when one of a's ends touches one of b's ends, and b lies to the left (b comes after a)
            ends_a, ends_b = [a[0], a[-1]], [b[0], b[-1]]
            if min(np.hypot(*(ea - eb)) for ea in ends_a for eb in ends_b) > tol: continue
            if b[:, 0].mean() >= a[:, 0].mean(): continue
            pairs[(fa, fb)] += 1
            # stacked: b's body sits clearly lower than a's, and reaches under a (image y grows downward)
            dy = (np.median(b[:, 1]) - np.median(a[:, 1])) / H
            under = b[:, 0].max() > a[:, 0].min() + 0.02 * H
            dys[(fa, fb)].append(round(float(dy), 3))
            if dy > 0.22 and under: stacks[(fa, fb)] += 1
rows = sorted(((k, pairs[k], stacks[k], (stacks[k] + 0.5) / (pairs[k] + 2)) for k in pairs), key=lambda r: -r[3])
print('joined pairs:', sum(pairs.values()), 'stacked:', sum(stacks.values()))
for k, n, s, p in rows[:28]: print(f'{k[0]:>6} -> {k[1]:<6} n={n:3d} stacked={s:3d} p={p:.2f}')
json.dump({f'{k[0]}|{k[1]}': {'n': n, 'stacked': s, 'p': round(p, 3), 'dy_median': float(np.median(dys[k]))} for k, n, s, p in rows}, open('/home/claude/lab2/stack_prior.json', 'w'), indent=0)
