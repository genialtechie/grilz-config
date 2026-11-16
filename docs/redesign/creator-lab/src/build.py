import sys
page=open('page.html').read()
js=''.join(open(f).read() for f in ['10-core.js','20-three.js','25-teeth.js','30-sculpt.js','40-scene.js','50-ui.js'])
out=page+'\n<script src="https://cdn.jsdelivr.net/npm/three@0.147.0/build/three.min.js"></script>\n<script>\n'+js+'</script>\n'
open('creator.html','w').write(out)
open('engine.js','w').write(js)
print('built', len(out))
