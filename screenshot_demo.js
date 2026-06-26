const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  page.on('pageerror', e => console.log('ERR:', e.message.substring(0,100)));
  
  // Desktop home - todas las ligas
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('http://127.0.0.1:4325/prototipo.html');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: '/tmp/d1_desktop.png' });
  
  // Mobile home
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: '/tmp/d2_mobile_home.png' });
  
  // Scroll para ver todas las ligas
  await page.evaluate(() => window.scrollTo(0, 500));
  await page.waitForTimeout(300);
  await page.screenshot({ path: '/tmp/d2b_ligas_scroll.png' });
  await page.evaluate(() => window.scrollTo(0, 0));
  
  // Click Liga Fútbol CABA (2nd demo league)
  const leagueCards = await page.$$('.league-card');
  console.log('Total leagues:', leagueCards.length);
  if(leagueCards[1]) {
    await leagueCards[1].click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: '/tmp/d3_liga_detail.png' });
    
    const divCards = await page.$$('.div-card');
    console.log('Div cards:', divCards.length);
    if(divCards[0]) {
      await divCards[0].click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: '/tmp/d4_partidos.png' });
      
      const navs = await page.$$('.nav-item');
      if(navs.length > 1) {
        await navs[1].click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: '/tmp/d5_tabla.png' });
        await navs[2].click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: '/tmp/d6_goleadores.png' });
      }
    }
  }
  
  await browser.close();
  console.log('Done');
})();
