import zipfile, re, json, sys, time
from xml.etree.ElementTree import iterparse

NS='{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
z=zipfile.ZipFile('npec.xlsx')

# shared strings
sst=[]
with z.open('xl/sharedStrings.xml') as f:
    for ev,el in iterparse(f, events=('end',)):
        if el.tag==NS+'si':
            sst.append(''.join(t.text or '' for t in el.iter(NS+'t')))
            el.clear()
print('sst', len(sst), file=sys.stderr)

def colnum(ref):
    n=0
    for ch in ref:
        if ch.isalpha(): n=n*26+(ord(ch.upper())-64)
        else: break
    return n-1

def rows(sheet):
    with z.open(sheet) as f:
        for ev,el in iterparse(f, events=('end',)):
            if el.tag==NS+'row':
                out={}
                for c in el:
                    if c.tag!=NS+'c': continue
                    v=c.find(NS+'v')
                    if v is None or v.text is None:
                        isel=c.find(NS+'is')
                        if isel is not None:
                            out[colnum(c.get('r'))]=''.join(t.text or '' for t in isel.iter(NS+'t'))
                        continue
                    t=c.get('t')
                    if t=='s': out[colnum(c.get('r'))]=sst[int(v.text)]
                    elif t=='str': out[colnum(c.get('r'))]=v.text
                    else:
                        s=v.text
                        out[colnum(c.get('r'))]=float(s) if '.' in s or 'E' in s else int(s)
                yield out
                el.clear()

# ---- Onglet 4 : CPNE -> IDCC ----
cpne_idcc={}
cpne_names={}
for i,r in enumerate(rows('xl/worksheets/sheet4.xml')):
    if i<3: continue
    code=r.get(0); name=r.get(1); idcc=r.get(2)
    if code is None: continue
    cpne_names[int(code)]=name
    if idcc is not None:
        cpne_idcc.setdefault(int(code),[]).append(int(idcc))
print('cpne', len(cpne_names), 'idcc links', sum(len(v) for v in cpne_idcc.values()), file=sys.stderr)

# ---- Onglet 3 : référentiel ----
t0=time.time()
certs={}   # rncp -> dict
order=[]
values={}  # rncp -> {cpne: npec}
statuses={} # rncp -> {cpne: statut}
dates=set()
n=0
for i,r in enumerate(rows('xl/worksheets/sheet3.xml')):
    if i<3: continue
    rncp=r.get(0)
    if rncp is None: continue
    n+=1
    if rncp not in certs:
        certs[rncp]={'rncp':rncp,'lib':r.get(1),'cert':r.get(2),'type':r.get(3)}
        order.append(rncp); values[rncp]={}; statuses[rncp]={}
    cp=r.get(4)
    if cp is None: continue
    cp=int(cp)
    if cp not in cpne_names: cpne_names[cp]=r.get(5)
    npec=r.get(6)
    values[rncp][cp]=npec
    statuses[rncp][cp]=r.get(7)
    d=r.get(8)
    if isinstance(d,(int,float)): dates.add(d)
    if n%100000==0: print(n, time.time()-t0, file=sys.stderr)
print('rows',n,'certs',len(certs),'elapsed',time.time()-t0, file=sys.stderr)

json.dump({'statuses':{k:{str(a):b for a,b in v.items()} for k,v in statuses.items()},'certs':certs,'order':order,'values':{k:{str(a):b for a,b in v.items()} for k,v in values.items()},
           'cpne_names':{str(k):v for k,v in cpne_names.items()},
           'cpne_idcc':{str(k):v for k,v in cpne_idcc.items()},
           'dates':sorted(dates)}, open('raw.json','w'))
print('done', file=sys.stderr)
