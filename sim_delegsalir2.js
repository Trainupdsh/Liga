const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
  const page = await (await browser.newContext({ viewport:{width:1100,height:800} })).newPage();
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:4330/prototipo.html', { waitUntil:'domcontentloaded' });
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    window.delegadoClub={id:1,nombre:'Club Atlético Ejemplo',abreviacion:'CAE',color_principal:'#1a3d20',_equipos:[],_eqDivMap:{}};
    _saveSession({role:'delegado',clubId:1}); _hidePublicChrome();
    document.getElementById('deleg-club-name').textContent='Club Atlético Ejemplo';
    showView('view-delegado');
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path:'/home/user/Liga/delegsalir_desktop.png', clip:{x:0,y:0,width:1100,height:90} });
  // click Salir (real click, not JS)
  const before = await page.evaluate(()=>!!sessionStorage.getItem('liga_session'));
  await page.click('#view-delegado header button:has-text("Salir")');
  await page.waitForTimeout(400);
  const after = await page.evaluate(()=>({session:sessionStorage.getItem('liga_session'),roleClass:document.body.classList.contains('role-session'),view:document.querySelector('.view.active')?.id}));
  console.log('session before click:', before);
  console.log('after click Salir:', JSON.stringify(after));
  console.log((before && !after.session && !after.roleClass) ? '✅ Salir (real click) logs out on desktop' : '❌ FAIL');
  console.log(errors.length===0?'✅ No JS errors':errors.map(e=>'❌ '+e).join('\n'));
  await browser.close();
})().catch(e=>console.error('FATAL:',e.message));
