const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:4330/prototipo.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => ({
    dtLeftVisible: getComputedStyle(document.getElementById('dt-left')).display!=='none',
    dtNavVisible: getComputedStyle(document.getElementById('dt-nav')).display!=='none',
    activeView: document.querySelector('.view.active')?.id,
    ligaNodes: document.querySelectorAll('#dt-left .dt-node-liga').length,
    session: sessionStorage.getItem('liga_session'),
  }));
  console.log('=== PUBLIC DESKTOP (no session) ===');
  console.log(JSON.stringify(r,null,2));
  console.log(r.dtLeftVisible && r.dtNavVisible && r.activeView==='view-matches-today' && r.ligaNodes>0 && !r.session
    ? '✅ PASS: public desktop view intact (tree + partidos, no session)'
    : '❌ FAIL: public view regressed');
  console.log(errors.length===0?'✅ No JS errors':errors.map(e=>'❌ '+e).join('\n'));
  await browser.close();
})().catch(e=>console.error('FATAL:',e.message));
