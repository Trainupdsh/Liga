const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
  const page = await (await browser.newContext({ viewport:{width:390,height:780} })).newPage();
  await page.goto('http://localhost:4330/prototipo.html', { waitUntil:'domcontentloaded' });
  await page.waitForTimeout(1000);
  await page.evaluate(()=>{ if(typeof showView==='function') showView('view-home'); });
  await page.waitForTimeout(400);
  // check computed visibility of the h2
  const info = await page.evaluate(() => {
    const h2 = document.querySelector('.home-banner h2');
    const cs = getComputedStyle(h2);
    const r = h2.getBoundingClientRect();
    return { text:h2.textContent, zIndex:cs.zIndex, position:cs.position, w:Math.round(r.width), h:Math.round(r.height) };
  });
  console.log(JSON.stringify(info));
  await page.screenshot({ path:'/home/user/Liga/banner_mobile.png', clip:{x:0,y:120,width:390,height:240} });
  await browser.close();
})().catch(e=>console.error('FATAL:',e.message));
