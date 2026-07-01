const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
  const page = await (await browser.newContext({ viewport:{width:1100,height:900} })).newPage();
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:4330/prototipo.html', { waitUntil:'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.evaluate(()=>{ document.getElementById('login-email').value='handball@baires.com'; document.getElementById('login-pass').value='handball2025'; doAdminLogin(); });
  await page.waitForTimeout(900);
  const r = await page.evaluate(()=>({
    menuIconSvgs: document.querySelectorAll('#view-admin .menu-icon svg').length,
    anyMenuEmoji: /🏆|🏟️|📅|🔄|📢|💰|🟡|🏅|🎯|📄|⚙️/.test(document.querySelector('#view-admin')?.textContent||''),
  }));
  console.log(JSON.stringify(r));
  console.log(r.menuIconSvgs>=12 && !r.anyMenuEmoji ? '✅ admin menu = line SVGs, no emoji' : '⚠️ check: '+r.menuIconSvgs+' svgs');
  console.log(errors.length===0?'✅ No JS errors':errors.slice(0,5).map(e=>'❌ '+e).join('\n'));
  await page.screenshot({ path:'/home/user/Liga/adminmenu_icons.png' });
  await browser.close();
})().catch(e=>console.error('FATAL:',e.message));
