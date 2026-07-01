const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
  const page = await (await browser.newContext({ viewport:{width:1100,height:820} })).newPage();
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:4330/prototipo.html', { waitUntil:'domcontentloaded' });
  await page.waitForTimeout(1200);
  // force-render delegado shell + role-session
  const r = await page.evaluate(() => {
    _saveSession({role:'delegado',clubId:999}); _hidePublicChrome();
    showView('view-delegado');
    const salirBtns = Array.from(document.querySelectorAll('#view-delegado header button')).map(b=>b.textContent.trim());
    // check all role headers have a Salir button
    const headerHasSalir = id => Array.from(document.querySelectorAll('#'+id+' header button')).some(b=>b.textContent.trim()==='Salir');
    return {
      delegSalir: salirBtns.includes('Salir'),
      arbitroSalir: headerHasSalir('view-arbitro'),
      mesaSalir: headerHasSalir('view-mesa'),
    };
  });
  console.log(JSON.stringify(r,null,2));
  console.log(r.delegSalir && r.arbitroSalir && r.mesaSalir ? '✅ Salir button present in club/árbitro/mesa headers' : '❌ missing');
  // click Salir -> logs out
  const out = await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('#view-delegado header button')).find(x=>x.textContent.trim()==='Salir');
    b.click();
    return { session: sessionStorage.getItem('liga_session'), roleClass: document.body.classList.contains('role-session') };
  });
  console.log('After Salir:', JSON.stringify(out));
  console.log(!out.session && !out.roleClass ? '✅ Salir logs out + restores chrome' : '❌ logout failed');
  await page.evaluate(()=>{ _saveSession({role:'delegado',clubId:999}); _hidePublicChrome(); showView('view-delegado'); });
  await page.waitForTimeout(300);
  await page.screenshot({ path: '/home/user/Liga/salir_deleg.png' });
  console.log(errors.length===0?'✅ No JS errors':errors.map(e=>'❌ '+e).join('\n'));
  await browser.close();
})().catch(e=>console.error('FATAL:',e.message));
