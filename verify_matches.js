const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
  const page = await browser.newPage();
  page.on('console', m => { if(m.type()==='error') console.log('JS ERROR:', m.text()); });
  await page.goto('http://localhost:4330/prototipo.html');
  await page.waitForTimeout(1500);

  console.log('Leagues:', await page.locator('.league-card').count());

  await page.evaluate(() => window.openDivision(101));
  await page.waitForTimeout(800);

  const matchGroups = await page.locator('.match-group').count();
  const matchItems  = await page.locator('.match-item').count();
  console.log('Match groups:', matchGroups, '| Match items:', matchItems);

  // Check status dots
  const doneDots     = await page.locator('.status-dot.done').count();
  const liveDots     = await page.locator('.status-dot.live').count();
  const upcomingDots = await page.locator('.status-dot.upcoming').count();
  console.log('Done dots:', doneDots, '| Live dots:', liveDots, '| Upcoming dots:', upcomingDots);

  await page.screenshot({path:'/home/user/Liga/ss_division.png'});

  // Click a done match (one with .status-dot.done)
  const doneItem = page.locator('.match-item').filter({has: page.locator('.status-dot.done')}).first();
  if(await doneItem.count()) {
    await doneItem.click();
    await page.waitForTimeout(600);

    const evContent = await page.locator('#match-events-content').innerHTML().catch(()=>'ERROR');
    console.log('Events - goals:', evContent.includes('⚽'), '| yellows:', evContent.includes('🟡'), '| sections:', evContent.includes('PRIMERA PARTE'));
    console.log('Events snippet:', evContent.substring(0,300).replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim());

    // Info tab
    const infoTab = page.locator('.modal-tab').filter({hasText:'INFO'}).first();
    await infoTab.click();
    await page.waitForTimeout(300);
    const infoHtml = await page.locator('#pane-info').innerHTML();
    console.log('Info tab has "Fecha":', infoHtml.includes('Fecha'), '| "Cancha":', infoHtml.includes('Cancha'));

    await page.screenshot({path:'/home/user/Liga/ss_modal_done.png'});
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  } else {
    console.log('No done match found');
  }

  // Click live match
  await page.evaluate(() => window.openDivision(101));
  await page.waitForTimeout(700);
  const liveItem = page.locator('.match-item').filter({has: page.locator('.status-dot.live')}).first();
  if(await liveItem.count()) {
    await liveItem.click();
    await page.waitForTimeout(500);
    const evContent = await page.locator('#match-events-content').innerHTML().catch(()=>'');
    console.log('Live match - EN CURSO:', evContent.includes('EN CURSO'), '| events:', evContent.includes('⚽'));
    await page.screenshot({path:'/home/user/Liga/ss_modal_live.png'});
    await page.keyboard.press('Escape');
  }

  // Check scorers
  await page.evaluate(() => window.openDivision(101));
  await page.waitForTimeout(700);
  const navItems = page.locator('#view-division .nav-item');
  const navCount = await navItems.count();
  console.log('Nav items:', navCount);
  for(let i=0;i<navCount;i++){
    const txt = await navItems.nth(i).textContent();
    if(txt.includes('Goleador') || txt.includes('goleador')) {
      await navItems.nth(i).click();
      await page.waitForTimeout(400);
      const scorers = await page.locator('.scorer-card').count();
      console.log('Scorer cards:', scorers);
      await page.screenshot({path:'/home/user/Liga/ss_scorers.png'});
      break;
    }
  }

  await browser.close();
  console.log('DONE');
})();
