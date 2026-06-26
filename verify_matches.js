const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']});
  const page = await browser.newPage();
  page.on('console', m => { if(m.type()==='error') console.log('JS ERROR:', m.text()); });
  await page.goto('http://localhost:4330/prototipo.html');
  await page.waitForTimeout(1500);

  // Open division 101 directly
  await page.evaluate(() => window.openDivision(101));
  await page.waitForTimeout(1000);

  const groups = await page.locator('.match-group').count();
  const items  = await page.locator('.match-item').count();
  const doneDots = await page.locator('.status-dot.done').count();
  const liveDots = await page.locator('.status-dot.live').count();
  const upDots   = await page.locator('.status-dot.upcoming').count();
  console.log('Groups:', groups, '| Items:', items, '| done:', doneDots, '| live:', liveDots, '| upcoming:', upDots);

  // Check division header shows
  const headerName = await page.locator('#division-header-name').textContent();
  console.log('Division header:', headerName);

  // Check standings tab
  await page.locator('#view-division .nav-item').nth(1).click();
  await page.waitForTimeout(400);
  const rows = await page.locator('.standing-row').count();
  console.log('Standing rows:', rows);

  // Check scorers tab
  await page.locator('#view-division .nav-item').nth(2).click();
  await page.waitForTimeout(400);
  const scorers = await page.locator('.scorer-card').count();
  console.log('Scorer cards:', scorers);

  await page.screenshot({path:'/home/user/Liga/ss_final.png'});
  await browser.close();
  console.log('DONE');
})();
