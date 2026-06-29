const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
  const page = await (await browser.newContext({ viewport:{width:390,height:844} })).newPage();
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:4330/prototipo.html', { waitUntil:'domcontentloaded' });
  await page.waitForTimeout(1200);
  const r = await page.evaluate(()=>({
    navIconSvgs: document.querySelectorAll('.bottom-nav .nav-icon svg').length,
    searchSvgs: document.querySelectorAll('.si svg, .search-icon svg').length,
    anyNavEmoji: /⚡|📊|🔍/.test(document.querySelector('.bottom-nav')?.textContent||''),
  }));
  console.log(JSON.stringify(r));
  console.log(r.navIconSvgs===4 && !r.anyNavEmoji ? '✅ bottom nav = 4 line SVGs, no emoji' : '❌ check');
  console.log(errors.length===0?'✅ No JS errors':errors.slice(0,5).map(e=>'❌ '+e).join('\n'));
  // screenshot bottom nav
  await page.screenshot({ path:'/home/user/Liga/nav_mobile.png', clip:{x:0,y:744,width:390,height:100} });
  await browser.close();
})().catch(e=>console.error('FATAL:',e.message));
