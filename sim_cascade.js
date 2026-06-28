const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
  const page = await (await browser.newContext({ viewport:{width:390,height:840} })).newPage();
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:4330/prototipo.html', { waitUntil:'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.evaluate(()=>{ showView('view-home'); });
  await page.waitForTimeout(300);

  const s0 = await page.evaluate(()=>({ ligas: document.querySelectorAll('#leaguesList .mc-liga').length, torneos: document.querySelectorAll('#leaguesList .mc-torneo').length }));
  console.log('initial:', JSON.stringify(s0));

  // expand first liga
  await page.evaluate(()=>document.querySelector('#leaguesList .mc-liga')?.click());
  await page.waitForTimeout(400);
  const s1 = await page.evaluate(()=>({ torneos: document.querySelectorAll('#leaguesList .mc-torneo').length, divs: document.querySelectorAll('#leaguesList .mc-div').length }));
  console.log('after expand liga:', JSON.stringify(s1));

  // expand first torneo
  await page.evaluate(()=>document.querySelector('#leaguesList .mc-torneo')?.click());
  await page.waitForTimeout(300);
  const s2 = await page.evaluate(()=>({ divs: document.querySelectorAll('#leaguesList .mc-div').length, divTexts: Array.from(document.querySelectorAll('#leaguesList .mc-div .mc-div-name')).slice(0,3).map(x=>x.textContent.trim()) }));
  console.log('after expand torneo:', JSON.stringify(s2));

  console.log(s0.ligas>=8 ? '✅ ligas as cascade rows' : '❌ ligas');
  console.log(s1.torneos>=1 ? '✅ expand liga shows torneos' : '❌ torneos');
  console.log(s2.divs>=1 ? '✅ expand torneo shows divisiones/categorías' : '❌ divs');
  console.log(errors.length===0?'✅ No JS errors':errors.slice(0,5).map(e=>'❌ '+e).join('\n'));

  await page.screenshot({ path:'/home/user/Liga/cascade_mobile.png', clip:{x:0,y:330,width:390,height:510} });
  await browser.close();
})().catch(e=>console.error('FATAL:',e.message));
