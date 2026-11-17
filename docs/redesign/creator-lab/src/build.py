import sys
page=open('page.html').read()
js=''.join(open(f).read() for f in ['10-core.js','20-three.js','25-teeth.js','30-sculpt.js','40-scene.js','50-ui.js'])
# pictures the page shows (assets/), inlined so the lab stays one file
import os, base64, json
_m={'jpg':'image/jpeg','jpeg':'image/jpeg','webp':'image/webp','png':'image/png'}
_a={f:'data:%s;base64,%s'%(_m[f.rsplit('.',1)[-1].lower()],base64.b64encode(open(os.path.join('assets',f),'rb').read()).decode()) for f in sorted(os.listdir('assets')) if f.rsplit('.',1)[-1].lower() in _m} if os.path.isdir('assets') else {}
js='window.VVS_ASSETS='+json.dumps(_a)+';\n'+js
out=page+'\n<script src="https://cdn.jsdelivr.net/npm/three@0.147.0/build/three.min.js"></script>\n<script>\n'+js+'</script>\n'
open('creator.html','w').write(out)
open('engine.js','w').write(js)
print('built', len(out))
