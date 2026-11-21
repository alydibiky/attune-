import json,re,sys,os
D=os.path.dirname(os.path.abspath(__file__)); en=json.load(open(D+"/deep_miss.json"))
dig=lambda t: re.sub(r'(\d)[.,](?=\d)',r'\1',t)
def pmh(x):
    s=set()
    for m in re.finditer(r'(\d{1,2})(?:–(\d{1,2}))?\s*pm',x): s.update(g for g in m.groups() if g)
    return s
for a in sys.argv[1:]:
    lang,i=a.split("_"); i=int(i)
    try: p=json.load(open(f"{D}/dp/{a}.json"))
    except Exception as e: print(a,"JSON",e); continue
    E=en[i*190:(i+1)*190]
    if len(p)!=len(E): print(a,"COUNT",len(p),len(E)); continue
    bad=[(j+i*190,e,t) for j,(e,t) in enumerate(zip(E,p)) if not t.strip() or any(d not in dig(t) and not (d in pmh(e) and str(int(d)+12) in dig(t)) for d in re.findall(r'\d+',dig(e)))]
    print(a,"OK" if not bad else bad)
