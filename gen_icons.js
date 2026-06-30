const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const svg = fs.readFileSync('/home/user/Liga/icon.svg','utf8');
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', headless:true });
  for (const size of [192, 512]) {
    const page = await (await b.newContext({ viewport:{width:size,height:size}, deviceScaleFactor:1 })).newPage();
    await page.setContent(`<!doctype html><html><body style="margin:0">${svg.replace('width="512" height="512"',`width="${size}" height="${size}"`)}</body></html>`);
    await page.screenshot({ path:`/home/user/Liga/icon-${size}.png`, omitBackground:true });
    await page.close();
  }
  await b.close();
  console.log('icons generated');
})().catch(e=>console.error('FATAL:',e.message));
