const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
  const page = await (await browser.newContext({ viewport:{width:1400,height:900} })).newPage();
  await page.goto('http://localhost:4330/prototipo.html', { waitUntil:'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.evaluate(() => { document.getElementById('login-email').value='handball@baires.com'; document.getElementById('login-pass').value='handball2025'; doAdminLogin(); });
  await page.waitForTimeout(800);
  await page.screenshot({ path: '/home/user/Liga/admin_fullscreen.png' });
  await browser.close();
})().catch(e=>console.error(e.message));
