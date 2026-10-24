"""Rank compositions from pairwise ratings (Bradley-Terry by minorise-maximise, ties as half wins, a light prior so
unbeaten items stay finite). Usage: python bradley_terry.py data/ratings/votes.json data/ratings/items.json"""
import json, sys, numpy as np
V, items = json.load(open(sys.argv[1])), json.load(open(sys.argv[2])); ids = [i['id'] for i in items]; ix = {k: n for n, k in enumerate(ids)}; tag = {i['id']: i['tag'] for i in items}
n = len(ids); W = np.zeros((n, n))
for v in V:
    if v['a'] not in ix or v['b'] not in ix: continue
    a, b = ix[v['a']], ix[v['b']]
    if v['w'] == 'a': W[a, b] += 1
    elif v['w'] == 'b': W[b, a] += 1
    else: W[a, b] += 0.5; W[b, a] += 0.5
p = np.ones(n)
for _ in range(800):
    den = np.array([sum((W[i, j] + W[j, i]) / (p[i] + p[j]) for j in range(n) if j != i) + 1 / (p[i] + 1) for i in range(n)]); p = (W.sum(1) + 0.5) / den; p /= np.exp(np.mean(np.log(p)))
for r, i in enumerate(np.argsort(-np.log(p))): print(f'{r + 1:3d}. {np.log(p)[i]:+.2f}  {tag[ids[i]]}')
