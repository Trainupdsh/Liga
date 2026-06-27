const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
  const page = await (await browser.newContext({ viewport:{width:1100,height:820} })).newPage();
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:4330/prototipo.html', { waitUntil:'domcontentloaded' });
  await page.waitForTimeout(1200);

  const r = await page.evaluate(() => {
    window.delegadoClub={id:1,nombre:'Mi Club',_equipos:[],_eqDivMap:{}};
    _saveSession({role:'delegado',clubId:1}); _hidePublicChrome();
    showView('view-delegado');
    return {
      statsTabExists: !!document.getElementById('dtab-stats'),
      statsPaneExists: !!document.getElementById('deleg-tab-stats'),
      loadStatsFn: typeof loadDelegStats==='function',
      switchHandlesStats: switchDelegTab.toString().includes("'stats'"),
      plantelShowsDivision: loadDelegPlantel.toString().includes('eqDivMap'),
      partidosSplits: loadDelegPartidos.toString().includes('Próximos') && loadDelegPartidos.toString().includes('Jugados'),
    };
  });
  console.log(JSON.stringify(r,null,2));
  const ok = r.statsTabExists&&r.statsPaneExists&&r.loadStatsFn&&r.switchHandlesStats&&r.plantelShowsDivision&&r.partidosSplits;
  console.log(ok?'✅ all wiring present (stats tab, division-in-plantel, próximos/jugados split)':'❌ wiring incomplete');

  // switch to stats tab -> pane shown
  const sw = await page.evaluate(() => {
    switchDelegTab('stats', document.getElementById('dtab-stats'));
    return {
      statsVisible: getComputedStyle(document.getElementById('deleg-tab-stats')).display!=='none',
      plantelHidden: getComputedStyle(document.getElementById('deleg-tab-plantel')).display==='none',
    };
  });
  console.log('switch to stats:', JSON.stringify(sw));
  console.log(sw.statsVisible && sw.plantelHidden ? '✅ tab switching works' : '❌ tab switch');

  await page.waitForTimeout(300);
  console.log(errors.length===0?'✅ No JS errors':errors.slice(0,5).map(e=>'❌ '+e).join('\n'));
  await browser.close();
})().catch(e=>console.error('FATAL:',e.message));
