const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
// Screenshots the Grill Creator Lab in headless Chromium (software WebGL, so it is slow).
// Usage: node ctest.cjs <width> <height> <tag> <plan>   e.g. node ctest.cjs 390 780 m s (the three structures), m g (after Done), m k (Select teeth and Undo)
// Build first: cd ../src && python3 build.py. Shots land in ./shots (not committed).
const dir = __dirname, out = __dirname + '/shots';
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(dir + '/_p.html', '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>body{margin:0}</style></head><body>' + fs.readFileSync(path.join(__dirname, '../src/creator.html'), 'utf8') + '</body></html>');
const port = 8700 + Math.floor(Math.random() * 90);
const srv = http.createServer((q, r) => { fs.readFile(path.join(dir, q.url.split('?')[0]), (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': 'text/html' }); r.end(d); }); }).listen(port);
const [vw, vh, tag, plan] = [+(process.argv[2] || 1100), +(process.argv[3] || 800), process.argv[4] || 'd', process.argv[5] || 'a'];
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: vw, height: vh } });
  await p.route('**/three.min.js', r => r.fulfill({ path: __dirname + '/three.min.js', contentType: 'text/javascript' }));
  const errs = []; p.on('pageerror', e => errs.push('PAGEERR ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
  await p.emulateMedia({ reducedMotion: 'reduce' });
  await p.goto('http://localhost:' + port + '/_p.html', { waitUntil: 'networkidle' });
  await p.waitForFunction(() => window.__vvs && window.__vvs.G.ready, null, { timeout: 120000 });
  const st = p.locator('#stage'); const t0 = Date.now();
  const shot = async n => { await p.waitForTimeout(700); await st.screenshot({ path: out + '/' + tag + '-' + n + '.png' }); console.log(n, Date.now() - t0); };
  const c = async s => { if (await p.isVisible('#bubble')) await p.click('#bubble [data-b="x"]').catch(() => {}); await p.click(s, { timeout: 20000 }); };
  const proto = async (k, v) => { await c('#protobtn'); await c('[data-p="' + k + '"][data-v="' + v + '"]'); await c('#protobtn'); };
  try {
    if (plan === 'a') {
      await shot('1-openA');
      await c('[data-build="iced8"]'); await shot('2-openA-iced8');
      await c('#goA'); await shot('3-menu');
      await p.evaluate(() => window.__vvs.G.tap(24)); await shot('4-glow');
      await c('[data-a="menu"]').catch(() => {}); await c('[data-open="metal"]'); await c('[data-g="metal"][data-k="rose"]'); await shot('5-metal-onetooth');
      await c('#selchip'); await p.evaluate(() => { window.__vvs.ui.quietUntil = 0; window.__vvs.ui.lastTouch = 0; window.__vvs.G.touched = 0; }); await p.waitForTimeout(1600); await shot('6-guide'); await p.click('#bubble [data-b="x"]').catch(() => {});
      await c('[data-a="done"]'); await shot('7-done');
    } else if (plan === 'd') {
      await c('[data-build="tone"]'); await c('#goA'); await shot('d1-menu-tone');
      await c('[data-open="finish"]'); await c('[data-g="pick"][data-k="canines"]'); await c('[data-g="style"][data-k="cut"]'); await shot('d2-finish-canines');
      await c('[data-g="pick"][data-k="front"]'); await c('[data-g="style"][data-k="engr"]');
      await c('[data-a="menu"]'); await shot('d3-menu-mixed');
      await p.evaluate(() => { window.__vvs.G.tap(7); window.__vvs.G.tap(23); }); await shot('d4-two-picked');
    } else if (plan === 'e') {
      await c('[data-build="tone"]'); await c('#goA'); await c('[data-open="finish"]');
      await c('[data-g="pick"][data-k="canines"]'); await c('[data-g="style"][data-k="cut"]');
      await c('[data-g="pick"][data-k="front"]'); await c('[data-g="style"][data-k="engr"]');
      await c('[data-g="pick"][data-k="all"]'); await c('[data-a="menu"]'); await p.evaluate(() => { window.__vvs.ui.quietUntil = performance.now() + 600000; }); await c('#bubble [data-b="x"]').catch(() => {});
      await shot('e1-menu-whole-mixed');
    } else if (plan === 'f') {
      await p.evaluate(() => { window.__vvs.ui.undoMs = 600000; }); await p.click('[data-build="empty"]'); await p.click('#goA'); await p.waitForTimeout(1500); await shot('f1-empty-menu');
      await p.click('#bubble [data-b="top"]'); await p.click('#bubble [data-b="6"]'); await shot('f2-undo');
      await p.click('#bubble [data-b="undo"]'); await p.evaluate(() => { window.__vvs.ui.quietUntil = performance.now() + 600000; }); await p.click('#bubble [data-b="x"]').catch(() => {}); await shot('f3-after-undo');
      await c('.rows [data-open="teeth"]'); await shot('f4-teeth-empty');
      await c('[data-g="set"]'); await shot('f5-teeth-picked');
      await c('[data-a="next"]'); await shot('f6-metal');
      await c('.stages [data-open="extras"]'); await shot('f7-extras');
      await p.evaluate(() => { const u = window.__vvs.ui; u.quietUntil = 0; u.lastTouch = 0; window.__vvs.G.touched = 0; }); await p.waitForTimeout(1600);
      const k = await p.evaluate(() => window.__vvs.ui.bub); console.log('bubble now', k);
      if (k === 'metal' || k === 'finish' || k === 'stones') { await p.click('#bubble .chip:not(.more)'); await shot('f8-undo-' + k); }
    } else if (plan === 'g') {
      await p.evaluate(() => { try { localStorage.removeItem('vvs-verified'); } catch (e) {} window.__vvs.ui.verified = null; window.__vvs.ui.quietUntil = performance.now() + 9e6; });
      await shot('g0-door');
      await c('[data-build="tone"]'); await c('#goA'); await p.evaluate(() => { window.__vvs.ui.quietUntil = performance.now() + 9e6; }); await shot('g1-your-build');
      await c('[data-a="done"]'); await shot('g2-your-grill');
      await p.evaluate(() => { document.querySelector('#tray .tbody').scrollTop = 230; }); await shot('g3-your-grill-mid');
      await c('[data-x="go"]'); await shot('g4-your-grill-error');
      await p.fill('#aname', 'Marcus'); await p.fill('#aphone', '5550123456'); await c('[data-fit="own"]'); await shot('g5-your-grill-filled');
      await c('[data-x="go"]'); await p.waitForTimeout(2600); await shot('g6-code');
      await c('[data-x="fill"]'); await p.waitForTimeout(1500);
      await p.evaluate(() => { window.__vvs.ui.devAt = performance.now() - 4000; }); await shot('g7-sent-developing');
      await p.evaluate(() => { window.__vvs.ui.devAt = performance.now() - 20000; }); await p.waitForTimeout(500); await shot('g8-sent');
      await p.evaluate(() => { document.querySelector('#tray .tbody').scrollTop = 250; }); await shot('g9-sent-mid');
      await p.evaluate(() => { document.querySelector('#tray .tbody').scrollTop = 9999; }); await shot('g10-sent-bottom');
      await p.evaluate(() => { document.querySelector('#tray .tbody').scrollTop = 0; }); await c('[data-x="pay"]'); await p.waitForTimeout(1900); await shot('g11-paid');
      await c('#protobtn'); await c('[data-p="site"][data-v="shop"]'); await c('[data-p="restart"]'); await c('#protobtn');
      await c('[data-build="iced8"]'); await c('#goA'); await p.evaluate(() => { window.__vvs.ui.quietUntil = performance.now() + 9e6; }); await c('[data-a="done"]'); await shot('g12-jeweler-returning');
      await p.evaluate(() => { document.querySelector('#tray .tbody').scrollTop = 9999; }); await shot('g13-jeweler-returning-bottom');
    } else if (plan === 'k') {
      await c('[data-build="tone"]'); await c('#goA'); await p.evaluate(() => { window.__vvs.ui.quietUntil = performance.now() + 9e6; });
      await c('.rows [data-open="metal"]'); await shot('k1-metal-changebar');
      await c('#changebar [data-k="front"]'); await c('[data-g="metal"][data-k="rose"]'); await shot('k2-front-rose');
      await c('#undobtn'); await shot('k3-undone');
      await c('[data-a="menu"]'); await p.evaluate(() => { window.__vvs.G.tap(7); }); await shot('k4-menu-one-picked');
    } else if (plan === 's') {
      const quiet = () => p.evaluate(() => { window.__vvs.ui.quietUntil = performance.now() + 9e6; });
      await c('[data-build="tone"]'); await c('#goA'); await quiet(); await shot('s1-sheet-yourbuild');
      await c('.rows [data-open="metal"]'); await shot('s2-sheet-metal');
      await c('.psheet .tfoot [data-a="menu"]'); await shot('s3-sheet-upnext');
      await proto('nextp', 'nextbtn'); await c('.rows [data-open="finish"]'); await shot('s4-sheet-finish-nextbtn');
      await c('.psheet [data-a="menu"].x');
      await proto('struct', 'expand'); await proto('nextp', 'upnext'); await c('.rows [data-open="stones"]'); await shot('s5-expand-stones');
      await proto('nextp', 'nextbtn'); await shot('s6-expand-stones-nextbtn');
      await proto('struct', 'strip'); await proto('nextp', 'upnext'); await c('.strip5 [data-open="metal"]'); await shot('s7-strip-metal');
      await proto('nextp', 'nextbtn'); await c('.strip5 [data-open="finish"]'); await shot('s8-strip-finish-nextbtn');
    } else if (plan === 'c') {
      await c('[data-build="iced8"]'); await c('#goA'); await shot('c1-menu-game');
      await c('[data-open="stones"]'); await shot('c2-stones-game');
      await c('[data-a="menu"]'); await c('[data-open="finish"]'); await shot('c3-finish-game');
      await c('[data-a="menu"]'); await proto('menu', 'jeweler'); await shot('c4-menu-jeweler');
      await c('[data-open="metal"]'); await c('[data-g="metal"][data-k="platinum"]'); await shot('c5-metal-jeweler');
    } else {
      await proto('open', 'b'); await shot('1-openB');
      await proto('layout', 'steps'); await proto('guide', 'start');
      await c('[data-pick="empty"]'); await shot('2-q1');
      await c('[data-q="bottom"]'); await c('[data-q="8"]'); await shot('3-q3');
      await c('[data-q="white"]'); await shot('4-steps-finish');
      await c('[data-g="setting"][data-k="mosaic"]').catch(e => console.log('no mosaic in finish (expected)'));
      await c('[data-open="stones"]'); await c('[data-g="setting"][data-k="prong"]'); await shot('5-steps-stones');
      await c('[data-a="next"]'); await c('[data-g="x"][data-k="fangs"]'); await shot('6-steps-extras');
    }
  } catch (e) { console.log('STEP FAIL', e.message.split('\n')[0]); }
  console.log(errs.slice(0, 8).join('\n') || 'no errors');
  await b.close(); srv.close(); try { fs.unlinkSync(dir + '/_p.html'); } catch (e) {}
})();
