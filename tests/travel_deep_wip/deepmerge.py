import json,re,sys,os
lang=sys.argv[1]; D=os.path.dirname(os.path.abspath(__file__))
en=json.load(open(D+"/deep_miss.json"))
tr=[]
for i in range(6):
    p=json.load(open(f"{D}/dp/{lang}_{i}.json"))
    exp=len(en[i*190:(i+1)*190])
    if len(p)!=exp: sys.exit(f"part {i}: {len(p)} != {exp}")
    tr+=p
dig=lambda t: re.sub(r'(\d)[.,](?=\d)',r'\1',t)
def pmh(x):
    s=set()
    for m in re.finditer(r'(\d{1,2})(?:–(\d{1,2}))?\s*pm',x):
        s.update(g for g in m.groups() if g)
    return s
bad=[]
for e,t in zip(en,tr):
    if not t.strip(): bad.append((e,t)); continue
    dt=dig(t)
    for d in re.findall(r'\d+',dig(e)):
        if d not in dt and not (d in pmh(e) and str(int(d)+12) in dt): bad.append((e,t)); break
if bad:
    for e,t in bad[:40]: print("NUM",e,"=>",t)
    sys.exit(f"{len(bad)} bad")
f=f"/home/user/attune-/web-src/i18n-{lang}.js"; s=open(f,encoding="utf8").read()
k=s.rstrip().rfind("};")
body="  // v10.8 the travel guides' deeper sections (money, manners, health, costs, getting around, food, laws, dangers, holidays, customs, numbers)\n"
body+="".join(f"  {json.dumps(e,ensure_ascii=False)}: {json.dumps(t,ensure_ascii=False)},\n" for e,t in zip(en,tr))
s=s[:k]+body+s[k:]
open(f,"w",encoding="utf8").write(s); print("merged",len(tr))
