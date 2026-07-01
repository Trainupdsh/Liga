const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
  for (const [w,h,tag] of [[1100,820,'desktop'],[390,780,'mobile']]) {
    const page = await (await browser.newContext({ viewport:{width:w,height:h} })).newPage();
    await page.goto('http://localhost:4330/prototipo.html', { waitUntil:'domcontentloaded' });
    await page.waitForTimeout(1200);
    const info = await page.evaluate(() => {
      window.delegadoClub={id:1,nombre:'Mi Club',abreviacion:'MC',color_principal:'#1a2150',_equipos:[]};
      _saveSession({role:'delegado',clubId:1}); _hidePublicChrome();
      document.getElementById('deleg-club-name').textContent='Mi Club';
      showView('view-delegado');
      const btns = Array.from(document.querySelectorAll('#view-delegado header button'));
      const salir = btns.find(b=>b.textContent.trim()==='Salir');
      let r = null;
      if (salir) { const rect = salir.getBoundingClientRect(); r = {x:Math.round(rect.x),y:Math.round(rect.y),w:Math.round(rect.width),visible: rect.width>0 && rect.x>=0 && rect.x < window.innerWidth}; }
      return { headerBtns: btns.map(b=>b.textContent.trim()), salirRect: r, headerWidth: document.querySelector('#view-delegado header')?.getBoundingClientRect().width };
    });
    console.log(`[${tag} ${w}px]`, JSON.stringify(info));
    await page.screenshot({ path: `/home/user/Liga/delegview_${tag}.png` });
    await page.close();
  }
  await browser.close();
})().catch(e=>console.error('FATAL:',e.message));
