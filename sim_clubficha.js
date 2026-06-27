const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
  const page = await (await browser.newContext({ viewport:{width:1400,height:900} })).newPage();
  await page.goto('http://localhost:4330/prototipo.html', { waitUntil:'domcontentloaded' });
  await page.waitForTimeout(1500);

  // public: open liga standings, then dblclick a team -> club ficha
  await page.evaluate(() => document.querySelector('#dt-left .dt-node-liga')?.click());
  await page.waitForTimeout(700);
  await page.evaluate(() => {
    const row = document.querySelector('.vtd-st-row');
    row?.dispatchEvent(new MouseEvent('dblclick',{bubbles:true}));
  });
  await page.waitForTimeout(700);

  const state = await page.evaluate(() => ({
    activeView: document.querySelector('.view.active')?.id,
    bodyHasRoleSession: document.body.classList.contains('role-session'),
    session: sessionStorage.getItem('liga_session'),
    dtLeftDisplay: getComputedStyle(document.getElementById('dt-left')).display,
    dtNavDisplay: getComputedStyle(document.getElementById('dt-nav')).display,
    appGridAreas: getComputedStyle(document.getElementById('app')).gridTemplateAreas,
  }));
  console.log(JSON.stringify(state,null,2));
  await page.screenshot({ path: '/home/user/Liga/clubficha_pub.png' });
  await browser.close();
})().catch(e=>console.error('FATAL:',e.message));
