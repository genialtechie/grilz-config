const { chromium } = require('playwright');
(async () => { const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
await p.goto('file://' + __dirname + '/og.html'); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300);
await p.screenshot({ path: __dirname + '/og-vvslab.png' }); await b.close(); })();
