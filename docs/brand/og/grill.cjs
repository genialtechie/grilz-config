const { chromium } = require('playwright'); const http = require('http'), fs = require('fs');
const lab = '/home/user/grilz-config/docs/redesign/creator-lab/creator.html', three = '/home/user/grilz-config/docs/redesign/creator-lab/test/three.min.js';
const page = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}</style></head><body>' + fs.readFileSync(lab, 'utf8') + '</body></html>';
const srv = http.createServer((q, r) => { r.writeHead(200, { 'Content-Type': 'text/html' }); r.end(page); }).listen(8477);
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  await p.route('**/three.min.js', r => r.fulfill({ path: three, contentType: 'text/javascript' }));
  await p.emulateMedia({ reducedMotion: 'reduce' });
  await p.goto('http://localhost:8477/', { waitUntil: 'networkidle' });
  await p.waitForFunction(() => window.__vvs && window.__vvs.G.ready, null, { timeout: 180000 });
  for (const want of process.argv.slice(2)) {
    await p.waitForFunction(w => ((document.getElementById('nowshow') || {}).textContent || '').indexOf(w) === 0, want, { timeout: 300000, polling: 100 });
    await p.waitForTimeout(1600);
    const ok = await p.evaluate(w => document.getElementById('nowshow').textContent.indexOf(w) === 0, want);
    await p.addStyleTag({ content: '.stage > :not(canvas){visibility:hidden!important}' });
    await p.screenshot({ path: `grill-${want.split(' ')[0]}.png`, clip: { x: 0, y: 0, width: 1440, height: 560 }, timeout: 120000 });
    await p.addStyleTag({ content: '.stage > :not(canvas){visibility:visible!important}' });
    console.log(want, ok);
  }
  await b.close(); srv.close();
})();
