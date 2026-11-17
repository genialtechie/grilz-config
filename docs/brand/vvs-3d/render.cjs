const { chromium } = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path');
const dir = __dirname; const srv = http.createServer((q, r) => { fs.readFile(path.join(dir, q.url.split('?')[0]), (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': q.url.endsWith('.json') ? 'application/json' : q.url.endsWith('.js') ? 'text/javascript' : 'text/html' }); r.end(d); }); }).listen(8798);
(async () => { const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const jobs = JSON.parse(process.argv[2]);
  for (const j of jobs) { const p = await b.newPage({ viewport: { width: j.w, height: j.h } });
    p.on('pageerror', e => console.log('ERR', e.message));
    await p.goto(`http://localhost:8798/logo.html?bg=${j.bg}&w=${j.w}&h=${j.h}&yaw=${j.yaw}&pitch=${j.pitch}&dist=${j.dist||7}`); await p.waitForFunction(() => window.DONE, null, { timeout: 300000 });
    const url = await p.evaluate(() => document.getElementById('c').toDataURL('image/png')); fs.writeFileSync(path.join(dir, j.out), Buffer.from(url.split(',')[1], 'base64')); console.log('saved', j.out); await p.close(); }
  await b.close(); srv.close(); })();
