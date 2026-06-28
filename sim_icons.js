const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
  const page = await (await browser.newContext({ viewport:{width:390,height:840} })).newPage();
  await page.goto('http://localhost:4330/prototipo.html', { waitUntil:'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.evaluate(()=>{ showView('view-home'); document.querySelector('#leaguesList .mc-liga')?.click(); });
  await page.waitForTimeout(400);
  await page.evaluate(()=>document.querySelector('#leaguesList .mc-torneo')?.click());
  await page.waitForTimeout(300);
  const svgs = await page.evaluate(()=>({
    bannerSvgs: document.querySelectorAll('.sport-icons svg').length,
    ligaSvgs: document.querySelectorAll('#leaguesList .mc-liga-ico svg').length,
    torneoSvgs: document.querySelectorAll('#leaguesList .mc-torneo-ico svg').length,
    divSvgs: document.querySelectorAll('#leaguesList .mc-div svg').length,
    anyEmoji: /🤾|⚽|🏀|🏐|🏆|📋/.test(document.getElementById('leaguesList').textContent),
  }));
  console.log(JSON.stringify(svgs,null,2));
  console.log(svgs.bannerSvgs>=4&&svgs.ligaSvgs>=1&&svgs.torneoSvgs>=1&&svgs.divSvgs>=1&&!svgs.anyEmoji?'✅ SVG line icons everywhere, no emojis in cascade':'⚠️ check');
  await page.screenshot({ path:'/home/user/Liga/icons_mobile.png', clip:{x:0,y:120,width:390,height:600} });
  await browser.close();
})().catch(e=>console.error('FATAL:',e.message));
