const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
  const page = await (await browser.newContext({ viewport:{width:390,height:840} })).newPage();
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:4330/prototipo.html', { waitUntil:'domcontentloaded' });
  await page.waitForTimeout(1200);

  // functions defined?
  const defs = await page.evaluate(()=>({
    openClubProfile: typeof openClubProfile==='function',
    closeClubProfile: typeof closeClubProfile==='function',
    openPlayerProfile: typeof openPlayerProfile==='function',
    clubModalEl: !!document.getElementById('clubProfileModal'),
  }));
  console.log('defs:', JSON.stringify(defs));

  // open a demo division (supa null -> local fallback)
  await page.evaluate(()=>openDivision(101));
  await page.waitForTimeout(600);
  // go to tabla tab
  await page.evaluate(()=>{ const t=document.querySelectorAll('#view-division .nav-item'); if(t[1]) t[1].click(); });
  await page.waitForTimeout(400);
  const tabla = await page.evaluate(()=>({
    rows: document.querySelectorAll('#standingsList .standing-row').length,
    firstHasOnclick: !!document.querySelector('#standingsList .standing-row')?.getAttribute('onclick'),
    onclickSample: document.querySelector('#standingsList .standing-row')?.getAttribute('onclick'),
  }));
  console.log('tabla:', JSON.stringify(tabla));

  // click first standings row -> should open club detail (demo -> _dtDblClickClub -> view-club-detail)
  await page.evaluate(()=>document.querySelector('#standingsList .standing-row')?.click());
  await page.waitForTimeout(500);
  const afterClub = await page.evaluate(()=>document.querySelector('.view.active')?.id);
  console.log('after club tap, view:', afterClub);

  // goleadores tab
  await page.evaluate(()=>openDivision(101));
  await page.waitForTimeout(500);
  await page.evaluate(()=>{ const t=document.querySelectorAll('#view-division .nav-item'); if(t[2]) t[2].click(); });
  await page.waitForTimeout(400);
  const scorer = await page.evaluate(()=>({
    cards: document.querySelectorAll('#scorersList .scorer-card').length,
    firstOnclick: document.querySelector('#scorersList .scorer-card')?.getAttribute('onclick'),
  }));
  console.log('scorers:', JSON.stringify(scorer));
  await page.evaluate(()=>document.querySelector('#scorersList .scorer-card')?.click());
  await page.waitForTimeout(500);
  const afterPlayer = await page.evaluate(()=>document.querySelector('.view.active')?.id);
  console.log('after player tap, view:', afterPlayer);

  console.log(defs.openClubProfile&&defs.closeClubProfile&&defs.clubModalEl?'✅ club modal + functions present':'❌ club modal missing');
  console.log(tabla.firstHasOnclick?'✅ standings rows clickable':'❌ standings not clickable');
  console.log(afterClub==='view-club-detail'?'✅ tap club → club ficha':'⚠️ club view: '+afterClub);
  console.log(scorer.firstOnclick?'✅ scorer rows clickable':'❌ scorers not clickable');
  console.log(afterPlayer==='view-player-detail'?'✅ tap player → player ficha':'⚠️ player view: '+afterPlayer);
  console.log(errors.length===0?'✅ No JS errors':errors.slice(0,5).map(e=>'❌ '+e).join('\n'));
  await browser.close();
})().catch(e=>console.error('FATAL:',e.message));
