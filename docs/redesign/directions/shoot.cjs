// Screens of one direction: node shoot.cjs <name> <phone|desktop>. Saves to ./shots/<name>-<view>-<n>.png
const { chromium } = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path');
const [name, view] = process.argv.slice(2); const dir = __dirname, out = dir + '/shots'; fs.mkdirSync(out, { recursive: true });
const page = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}</style></head><body>' + fs.readFileSync(path.join(dir, name + '.html'), 'utf8') + '</body></html>';
const port = 8600 + Math.floor(Math.random() * 90);
const srv = http.createServer((q, r) => { if (q.url.startsWith('/three.min.js')) { r.writeHead(200, { 'Content-Type': 'text/javascript' }); r.end(fs.readFileSync(dir + '/../creator-lab/test/three.min.js')); return; } r.writeHead(200, { 'Content-Type': 'text/html' }); r.end(page); }).listen(port);
(async () => {
  const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const [w, h] = view === 'phone' ? [390, 844] : [1440, 900];
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: view === 'phone' ? 2 : 1 });
  await p.route('**/three.min.js', r => r.fulfill({ path: dir + '/../creator-lab/test/three.min.js', contentType: 'text/javascript' }));
  await p.emulateMedia({ reducedMotion: 'reduce' });
  await p.goto('http://localhost:' + port + '/', { waitUntil: 'networkidle' });
  await p.waitForFunction(() => window.__vvs && window.__vvs.G.ready, null, { timeout: 120000 });
  const quiet = () => p.evaluate(() => { window.__vvs.ui.quietUntil = performance.now() + 9e6; });
  const shot = async n => { await p.waitForTimeout(900); await p.screenshot({ path: `${out}/${name}-${view}-${n}.png` }); console.log(name, view, n); };
  const c = async s => { if (await p.isVisible('#bubble')) await p.click('#bubble [data-b="x"]').catch(() => {}); await p.click(s, { timeout: 60000 }); };
  try {
    await quiet(); await p.waitForTimeout(2500); await shot('1-home');
    await p.evaluate(() => document.querySelector('.pcards').scrollIntoView({ block: 'center' })); await shot('2-price');
    await p.evaluate(() => window.scrollTo(0, 0)); await c('.home [data-h="design"]'); await quiet(); await shot('3-start');
    await c('[data-build="tone"]'); await quiet(); await c('[data-a="next"]'); await quiet(); await shot('4-builder');
    await c('.strip5 [data-open="extras"]'); await c('[data-a="done"]'); await shot('5-your-grill');
  } catch (e) { console.log('STEP FAIL', e.message.split('\n')[0]); }
  await b.close(); srv.close();
})();
