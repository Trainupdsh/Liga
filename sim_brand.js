const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
  const page = await (await browser.newContext({ viewport:{width:390,height:840} })).newPage();
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:4330/prototipo.html', { waitUntil:'domcontentloaded' });
  await page.waitForTimeout(1000);
  const r = await page.evaluate(()=>({
    title: document.title,
    homeH1: document.querySelector('#view-home h1')?.textContent,
    logo: document.querySelector('#view-home .logo-circle')?.textContent,
    anyAtlonis: document.documentElement.textContent.includes('Atlonis'),
  }));
  console.log(JSON.stringify(r,null,2));
  console.log(r.title==='Arenametric'&&r.homeH1==='Arenametric'&&r.logo==='AM'&&!r.anyAtlonis?'✅ Renamed to Arenametric everywhere':'❌ check');
  console.log(errors.length===0?'✅ No JS errors':errors.map(e=>'❌ '+e).join('\n'));
  await browser.close();
})().catch(e=>console.error('FATAL:',e.message));
