import json,glob,sys
tags=sys.argv[1:]
def load(tag):
    S=f'/tmp/claude-0/-home-user-kufic-generator/2a7d609e-93f7-5222-9a56-18f446e09f2f/scratchpad/bench/{tag}'
    rows={}
    for f in sorted(glob.glob(S+'/*.json')):
        for r in json.load(open(f)): rows[r['name']]=r
    return rows
data={t:load(t) for t in tags}
names=sorted(set().union(*[set(d) for d in data.values()]))
cols=['reading','clash','wordSpace','stray','fill','unity','noise','lines','stacked','elong','missing','marks','secs']
print('name'.ljust(22)+' tag  '+' '.join(c[:6].rjust(6) for c in cols))
for n in names:
    for t in tags:
        r=data[t].get(n)
        if not r: continue
        print(n.ljust(22)+f' {t:4} '+' '.join((f'{r[c]:6.2f}' if isinstance(r[c],float) else str(r[c]).rjust(6)) for c in cols))
