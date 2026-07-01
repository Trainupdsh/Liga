const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  page.on('console', m => { if(m.type()==='error') console.log('JS ERR:',m.text()); });
  
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('http://127.0.0.1:4324/prototipo.html');
  await page.waitForTimeout(3500);
  const cards = await page.$$('.league-card');
  console.log('League cards:', cards.length);
  await page.screenshot({ path: '/tmp/demo_desktop.png' });
  
  // Mobile
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: '/tmp/demo_mobile.png' });
  
  // Click first league
  if(cards.length > 0) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.click('.league-card');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: '/tmp/demo_league.png' });
    
    const divCards = await page.$$('.div-card');
    console.log('Div cards:', divCards.length);
    if(divCards.length > 0) {
      await page.click('.div-card');
      await page.waitForTimeout(1500);
      await page.screenshot({ path: '/tmp/demo_partidos.png' });
      
      const navItems = await page.$$('.nav-item');
      if(navItems.length > 1) {
        await navItems[1].click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: '/tmp/demo_tabla.png' });
        await navItems[2].click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: '/tmp/demo_goleadores.png' });
      }
    }
  }
  
  await browser.close();
})();
