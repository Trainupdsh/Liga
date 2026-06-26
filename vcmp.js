const { chromium } = require('playwright');
(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args:['--no-sandbox'] });
  const pg = await (await br.newContext({ viewport:{width:1280,height:900} })).newPage();
  await pg.goto('http://localhost:4330/prototipo.html');
  await pg.waitForTimeout(1500);
  // Partidos view (default)
  await pg.screenshot({ path: '/home/user/Liga/cmp_partidos.png', clip:{x:255,y:45,width:740,height:120} });
  // Open division
  await pg.locator('.dt-node-liga').first().click(); await pg.waitForTimeout(300);
  await pg.locator('.dt-node-torneo').first().click(); await pg.waitForTimeout(300);
  await pg.locator('.dt-node-grupo').first().click(); await pg.waitForTimeout(300);
  await pg.locator('.dt-node-div').first().click(); await pg.waitForTimeout(800);
  await pg.screenshot({ path: '/home/user/Liga/cmp_division.png', clip:{x:255,y:45,width:740,height:120} });
  await br.close();
})();
