const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
// Screenshots the Grill Creator Lab in headless Chromium (software WebGL, so it is slow).
// Usage: node ctest.cjs <width> <height> <tag> <plan>   plans: l (the front door: the hero, the page below, Start free goes to sign-up), o (the start page), v (the build strip: Next, Back, Select teeth, quick-question Undo), w (Select teeth), g (after Done), i (the AI path)
// Build first: cd ../src && python3 build.py. Shots land in ./shots (not committed).
const dir = __dirname, out = __dirname + '/shots';
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(dir + '/_p.html', '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>body{margin:0}</style></head><body>' + fs.readFileSync(path.join(__dirname, '../src/creator.html'), 'utf8') + '</body></html>');
const port = 8700 + Math.floor(Math.random() * 90);
const srv = http.createServer((q, r) => { fs.readFile(path.join(dir, q.url.split('?')[0]), (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': 'text/html' }); r.end(d); }); }).listen(port);
const [vw, vh, tag, plan] = [+(process.argv[2] || 1100), +(process.argv[3] || 800), process.argv[4] || 'd', process.argv[5] || 'a'];
(async () => {
  const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });   // PW_CHROMIUM=/opt/pw-browsers/chromium when the repo's Playwright has no browser
  const p = await b.newPage({ viewport: { width: vw, height: vh } });
  await p.route('**/three.min.js', r => r.fulfill({ path: __dirname + '/three.min.js', contentType: 'text/javascript' }));
  const errs = []; p.on('pageerror', e => errs.push('PAGEERR ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
  await p.emulateMedia({ reducedMotion: 'reduce' });
  await p.goto('http://localhost:' + port + '/_p.html', { waitUntil: 'networkidle' });
  await p.waitForFunction(() => window.__vvs && window.__vvs.G.ready, null, { timeout: 120000 });
  const st = p.locator('#stage'); const t0 = Date.now();
  const shot = async n => { await p.waitForTimeout(700); await st.screenshot({ path: out + '/' + tag + '-' + n + '.png', timeout: 60000 }); console.log(n, Date.now() - t0); };
  const c = async s => { if (await p.isVisible('#bubble')) await p.click('#bubble [data-b="x"]').catch(() => {}); await p.click(s, { timeout: 60000 }); };
  const proto = async (k, v) => { await c('#protobtn'); await c('[data-p="' + k + '"][data-v="' + v + '"]'); await c('#protobtn'); };
  try {
    if (plan !== 'l' && await p.isVisible('.home [data-h="design"]')) await c('.home [data-h="design"]');   // past the front door to the start page
    if (plan === 'g') {
      await p.evaluate(() => { try { localStorage.removeItem('vvs-verified'); } catch (e) {} window.__vvs.ui.verified = null; window.__vvs.ui.quietUntil = performance.now() + 9e6; });
      await shot('g0-door');
      await c('[data-build="tone"]'); await p.evaluate(() => { window.__vvs.ui.quietUntil = performance.now() + 9e6; }); await shot('g1-your-build');
      await c('.strip5 [data-open="extras"]'); await c('[data-a="done"]'); await shot('g2-your-grill');
      await p.evaluate(() => { document.querySelector('#tray .tbody').scrollTop = 230; }); await shot('g3-your-grill-mid');
      await c('#tray [data-x="go"]'); await shot('g4-your-grill-error');
      await p.fill('#aname', 'Marcus'); await p.fill('#aphone', '5550123456'); await c('[data-fit="own"]'); await shot('g5-your-grill-filled');
      await c('#tray [data-x="go"]'); await p.waitForTimeout(2600); await shot('g6-code');
      await c('[data-x="fill"]'); await p.waitForTimeout(1500);
      await p.evaluate(() => { window.__vvs.ui.devAt = performance.now() - 4000; }); await shot('g7-sent-developing');
      await p.evaluate(() => { window.__vvs.ui.devAt = performance.now() - 20000; }); await p.waitForTimeout(500); await shot('g8-sent');
      await p.evaluate(() => { document.querySelector('#tray .tbody').scrollTop = 250; }); await shot('g9-sent-mid');
      await p.evaluate(() => { document.querySelector('#tray .tbody').scrollTop = 9999; }); await shot('g10-sent-bottom');
      await p.evaluate(() => { document.querySelector('#tray .tbody').scrollTop = 0; }); await c('[data-x="pay"]'); await p.waitForTimeout(1900); await shot('g11-paid');
      await c('#protobtn'); await c('[data-p="site"][data-v="shop"]'); await c('[data-p="restart"]'); await c('#protobtn');
      await c('[data-build="iced8"]'); await p.evaluate(() => { window.__vvs.ui.quietUntil = performance.now() + 9e6; }); await c('.strip5 [data-open="extras"]'); await c('[data-a="done"]'); await shot('g12-jeweler-returning');
      await p.evaluate(() => { document.querySelector('#tray .tbody').scrollTop = 9999; }); await shot('g13-jeweler-returning-bottom');
    } else if (plan === 'v') {
      const quiet = () => p.evaluate(() => { window.__vvs.ui.quietUntil = performance.now() + 9e6; });
      await c('[data-build="tone"]'); await quiet(); await shot('v1-strip-teeth');
      await c('[data-a="next"]'); await shot('v2-strip-metal');
      await c('#selbtn'); await shot('v3-select-open');
      await c('#selpop [data-k="front"]'); await shot('v4-front-picked');
      await c('.strip5 [data-open="extras"]'); await shot('v5-extras-done');
      await c('[data-a="sback"]'); await shot('v6-back-to-metal');
      await c('[data-a="sback"]'); await c('[data-a="sback"]'); await shot('v7-back-to-start');
      await c('#goA'); await quiet(); await c('[data-a="next"]');
      await p.evaluate(() => { const u = window.__vvs.ui; u.quietUntil = 0; u.lastTouch = 0; window.__vvs.G.touched = 0; }); await p.waitForTimeout(1600);
      const k = await p.evaluate(() => window.__vvs.ui.bub); console.log('bubble', k); await shot('v8-question');
      await p.evaluate(() => { window.__vvs.ui.undoMs = 9e6; });
      await p.click('#bubble .chip:not(.more)'); await shot('v9-answered-undo');
      await p.click('#bubble [data-b="undo"]'); await shot('v10-question-back');
    } else if (plan === 'w') {
      await c('[data-build="tone"]'); await p.evaluate(() => { window.__vvs.ui.quietUntil = performance.now() + 9e6; });
      await c('[data-a="next"]'); await shot('w1-select-label');
      await c('#selbtn'); await c('#selpop [data-k="front"]'); await shot('w2-select-picked');
    } else if (plan === 'x') {   // the start panel: roomier spacing; the handle grows it to show every build, and shrinks it again
      await shot('x1-start'); await c('#grabA'); await p.waitForTimeout(600); await shot('x2-start-all-builds'); await p.keyboard.press('Escape'); await shot('x3-start-again');
    } else if (plan === 'o') {   // the start page (v12): the doors, one tap into a popular build, and the way back
      await shot('o1-door'); await c('[data-build="tone"]'); await shot('o2-one-tap-builder'); await c('[data-a="sback"]'); await shot('o3-door-waiting');
    } else if (plan === 'i') {   // the AI path: Describe it from the start page, the sign-up, the code, the build and its note; keep talking; the free builds; a picture
      await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} window.__vvs.ui.verified = null; window.__vvs.ui.quietUntil = performance.now() + 9e6; window.__vvs.ui.undoMs = 9e6; });
      await shot('i0-door');
      await p.fill('#doortext', 'iced out bottom 8 in white gold with fangs and rubies'); await shot('i1-door-typed');
      await c('.openA [data-x="go"]'); await shot('i2-ai-contact');
      await p.fill('#aname', 'Marcus'); await p.fill('#aphone', '5550123456'); await c('#tray [data-x="go"]'); await p.waitForTimeout(2600); await shot('i3-ai-code');
      await c('[data-x="fill"]'); await p.waitForTimeout(1500); await shot('i4-built-note');
      await p.click('#bubble [data-b="x"]').catch(() => {});
      await c('#aibtn'); await shot('i5-keep-talking');
      await p.fill('#aitext', 'make it 18k rose gold with my initials MJ'); await c('#tray [data-x="go"]'); await p.waitForTimeout(700); await shot('i6-rose-built');
      await p.click('#bubble [data-b="undo"]'); await p.waitForTimeout(500); await shot('i7-undone');
      await c('#aibtn'); await p.fill('#aitext', 'two tone open face on a cuban link'); await c('#tray [data-x="go"]'); await p.waitForTimeout(700); await p.click('#bubble [data-b="x"]').catch(() => {});
      await c('#aibtn'); await shot('i8-out-of-builds');
      await c('[data-x="hand"]'); await c('.strip5 [data-open="extras"]'); await shot('i9-extras-idea');
      await c('#protobtn'); await c('[data-p="aireset"]'); await c('[data-p="restart"]'); await c('#protobtn');
      await p.setInputFiles('.openA input[data-up="ai"]', out + '/' + tag + '-i0-door.png'); await p.waitForTimeout(900); await shot('i10-picture-ready');
      await c('.openA [data-x="go"]'); await p.waitForTimeout(900); await shot('i11-built-from-picture');
      await p.click('#bubble [data-b="x"]').catch(() => {}); await c('.strip5 [data-open="extras"]'); await c('[data-a="done"]'); await shot('i12-done-verified');
    } else if (plan === 'l') {   // the front door: v6's layout with words for both audiences; Design your grillz; the price versions; the questions; the jeweler's trial
      const full = async n => { await p.waitForTimeout(700); await p.screenshot({ path: out + '/' + tag + '-' + n + '.png', fullPage: true }); console.log(n, Date.now() - t0); };
      await p.evaluate(() => { window.__vvs.ui.quietUntil = performance.now() + 9e6; });
      await p.waitForTimeout(2200); await shot('l1-home'); await full('l2-home-page');
      await c('.home [data-h="design"]'); await shot('l3-start-page');
      await p.click('.bar .mark'); await p.waitForTimeout(600);
      if (await p.isVisible('.qtabs')) { await c('.qtabs [data-q2="sell"]'); await p.evaluate(() => document.querySelector('.qtabs').scrollIntoView({ block: 'start' })); await p.waitForTimeout(500); await p.screenshot({ path: out + '/' + tag + '-l5-questions-sell.png' }); console.log('l5-questions-sell'); }
      await p.evaluate(() => window.scrollTo(0, 0)); await c('.home [data-t="start"]'); await shot('l6-start-free');
    }
  } catch (e) { console.log('STEP FAIL', e.message.split('\n')[0]); }
  console.log(errs.slice(0, 8).join('\n') || 'no errors');
  await b.close(); srv.close(); try { fs.unlinkSync(dir + '/_p.html'); } catch (e) {}
})();
