// Exports the landing page as one static HTML file (no 3D, no scripts) plus full-page screenshots, for design tools like Variant.
// node export.cjs  -> vvs-landing.html, vvs-landing-phone.png, vvs-landing-desktop.png
const { chromium } = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path');
const dir = __dirname, lab = path.join(dir, '../creator-lab/src/creator.html');
const page = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}</style></head><body>' + fs.readFileSync(lab, 'utf8') + '</body></html>';
const port = 8500 + Math.floor(Math.random() * 90);
const srv = http.createServer((q, r) => { r.writeHead(200, { 'Content-Type': 'text/html' }); r.end(page); }).listen(port);
const launch = () => chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
async function open(b, w, h) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  await p.route('**/three.min.js', r => r.fulfill({ path: dir + '/../creator-lab/test/three.min.js', contentType: 'text/javascript' }));
  await p.emulateMedia({ reducedMotion: 'reduce' });
  await p.goto('http://localhost:' + port + '/', { waitUntil: 'networkidle' });
  await p.waitForFunction(() => window.__vvs && window.__vvs.G.ready && document.querySelector('.leadcard img'), null, { timeout: 180000 });
  await p.evaluate(() => { window.__vvs.ui.quietUntil = performance.now() + 9e6; }); await p.waitForFunction(() => ((document.getElementById('nowshow') || {}).textContent || '').indexOf('Two-tone') === 0, null, { timeout: 240000, polling: 200 });
  return p;
}
// the 3D as a still: hide everything over the canvas, screenshot the stage at 2x
async function still(b, w, h) {
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  await p.route('**/three.min.js', r => r.fulfill({ path: dir + '/../creator-lab/test/three.min.js', contentType: 'text/javascript' }));
  await p.emulateMedia({ reducedMotion: 'reduce' });
  await p.goto('http://localhost:' + port + '/', { waitUntil: 'networkidle' });
  await p.waitForFunction(() => window.__vvs && window.__vvs.G.ready, null, { timeout: 180000 }); await p.waitForFunction(() => ((document.getElementById('nowshow') || {}).textContent || '').indexOf('Two-tone') === 0, null, { timeout: 240000, polling: 200 }); await p.evaluate(() => { window.__vvs.ui.showSnap = false; }); await p.waitForTimeout(5000);
  await p.addStyleTag({ content: '.stage > :not(canvas){visibility:hidden!important}' }); await p.waitForTimeout(600);
  const box = await p.locator('#stage').boundingBox(); const buf = await p.screenshot({ type: 'jpeg', quality: 88, clip: box, timeout: 180000 }); await p.close();
  return 'data:image/jpeg;base64,' + buf.toString('base64');
}
(async () => {
  const b = await launch();
  const imgPhone = await still(b, 390, 844), imgDesk = await still(b, 1440, 900);
  const p = await open(b, 1440, 900);
  const html = await p.evaluate(([ph, dk]) => {
    const d = document.documentElement.cloneNode(true);
    d.querySelectorAll('script, #proto, #protobtn, #bubble, #toast, .tray, .openA, .tools, .selbtn, .selpop, .selchip, .load, link[rel=preconnect]').forEach(n => n.remove());
    const cv = d.querySelector('#stage canvas'); if (cv) { const pic = document.createElement('picture'); pic.innerHTML = '<source media="(max-width: 699px)" srcset="' + ph + '"><img alt="Two-tone 6 × 6 gold grillz on a clear model of teeth" src="' + dk + '" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block">'; cv.replaceWith(pic); }
    d.querySelectorAll('[aria-hidden="true"][hidden], [hidden]').forEach(n => n.remove());
    d.querySelector('head').insertAdjacentHTML('afterbegin', '<title>VVS Lab · Design your grillz in 3D</title><meta name="description" content="Design your grillz in 3D and see the price as you go. Jewelers: put the builder on your Instagram and get orders with a deposit.">');
    return '<!doctype html>\n' + d.outerHTML;
  }, [imgPhone, imgDesk]);
  fs.writeFileSync(dir + '/vvs-landing.html', html); console.log('html', (html.length / 1024 | 0) + ' KB');
  await p.close(); await b.close(); srv.close();
  // screenshots of the static file itself, so they match what the tool gets
  const b2 = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
  for (const [n, w, h] of [['phone', 390, 844], ['desktop', 1440, 900]]) {
    const q = await b2.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
    await q.goto('file://' + dir + '/vvs-landing.html', { waitUntil: 'networkidle' }); await q.waitForTimeout(800);
    await q.screenshot({ path: `${dir}/vvs-landing-${n}.png`, fullPage: true }); console.log('shot', n); await q.close();
  }
  await b2.close();
})();
