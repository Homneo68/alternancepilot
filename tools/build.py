import json, base64, collections, gzip

d=json.load(open('raw.json'))
V=d['values']; S=d['statuses']; certs=d['certs']; order=d['order']
cpne_names=d['cpne_names']; cpne_idcc=d['cpne_idcc']

codes=sorted(int(c) for c in cpne_names)
assert len(codes)==203
cpne=[[c, cpne_names[str(c)], sorted(cpne_idcc.get(str(c),[]))] for c in codes]

ALPHA='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_'
assert len(ALPHA)==64

certifiers=[]; ci={}
types=[]; ti={}
out_certs=[]; vals=[]; maps=[]; decs=[]

for rncp in order:
    c=certs[rncp]
    ce=c['cert'] or ''
    if ce not in ci: ci[ce]=len(certifiers); certifiers.append(ce)
    ty=c['type'] or ''
    if ty not in ti: ti[ty]=len(types); types.append(ty)
    out_certs.append([rncp, c['lib'], ci[ce], ti[ty]])

    row={k:(v if isinstance(v,(int,float)) else None) for k,v in V[rncp].items()}
    st=S[rncp]
    uniq=sorted({row[str(k)] for k in codes}, key=lambda x:(x is None, x))
    idx={v:i for i,v in enumerate(uniq)}
    assert len(uniq)<=64, (rncp, len(uniq))
    maps.append(''.join(ALPHA[idx[row[str(k)]]] for k in codes))
    bits=bytearray((len(codes)+7)//8)
    for i,k in enumerate(codes):
        if st[str(k)]=='D': bits[i>>3] |= 1<<(7-(i&7))
    decs.append(base64.b64encode(bytes(bits)).decode())
    vals.append(uniq)

payload={
 'meta':{'titre':"Référentiel unique des NPEC — applicable au 1er septembre 2026",
         'source':"France compétences — Référentiel unique des NPEC (décret n° 2026-832 du 29 août 2026), mise à jour du 16 octobre 2026",
         'dateApplicabilite':"2026-09-01",
         'nCert':len(out_certs),'nCpne':len(cpne),
         'nIdcc':len({i for c in cpne for i in c[2]}),
         'nCouples':len(out_certs)*len(cpne)},
 'cpne':cpne,'certifiers':certifiers,'types':types,
 'certs':out_certs,'vals':vals,'map':maps,'dec':decs}

s=json.dumps(payload, ensure_ascii=False, separators=(',',':'))
open('npec-data.json','w').write(s)
print('raw json bytes', len(s.encode()))
print('gzip bytes', len(gzip.compress(s.encode(),9)))
print('b64(gzip) bytes', len(base64.b64encode(gzip.compress(s.encode(),9))))
