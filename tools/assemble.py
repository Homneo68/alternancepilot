import base64, gzip, io

data = open('npec-data.json','rb').read()
gz = gzip.compress(data, 9)
b64 = base64.b64encode(gz).decode()
# wrap for readability / avoid a single multi-hundred-KB line
b64w = '\n'.join(b64[i:i+120] for i in range(0, len(b64), 120))

head = open('tpl_head.html',encoding='utf8').read()
body = open('tpl_body.html',encoding='utf8').read()
js = ''.join(open(f,encoding='utf8').read() for f in ['tpl_js1.js','tpl_js2.js','tpl_js3.js','tpl_js4.js'])

payload = '<script type="text/plain" id="npec-payload">\n' + b64w + '\n</scr'+'ipt>\n'
core = head + '\n' + body + '\n' + payload + '<scr'+'ipt>\n' + js + '\n</scr'+'ipt>\n'

full = ('<!doctype html>\n<html lang="fr">\n<head>\n<meta charset="utf-8" />\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1" />\n'
        + head + '\n</head>\n<body>\n' + body + '\n' + payload + '<scr'+'ipt>\n' + js + '\n</scr'+'ipt>\n</body>\n</html>\n')

open('npec.html','w',encoding='utf8').write(full)
open('npec-artifact.html','w',encoding='utf8').write(core)
print('gz', len(gz), 'b64', len(b64))
print('npec.html', len(full.encode()))
