const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
  for (const vp of [{w:390,h:780,name:'mobile'},{w:1100,h:800,name:'desktop'}]) {
    const page = await (await browser.newContext({ viewport:{width:vp.w,height:vp.h} })).newPage();
    await page.goto('http://localhost:4330/prototipo.html', { waitUntil:'domcontentloaded' });
    await page.waitForTimeout(1000);
    const info = await page.evaluate(() => {
      window.delegadoClub={id:1,nombre:'Club Atlético Ejemplo',abreviacion:'CAE',color_principal:'#1a3d20',_equipos:[],_eqDivMap:{}};
      _saveSession({role:'delegado',clubId:1}); _hidePublicChrome();
      document.getElementById('deleg-club-name').textContent='Club Atlético Ejemplo';
      document.getElementById('deleg-subtitle').textContent='Delegado';
      showView('view-delegado');
      const btns = Array.from(document.querySelectorAll('#view-delegado header *')).map(b=>({tag:b.tagName,txt:b.textContent.trim().slice(0,20)}));
      const salir = Array.from(document.querySelectorAll('#view-delegado header button')).find(b=>b.textContent.trim()==='Salir');
      let rect=null;
      if(salir){const r=salir.getBoundingClientRect();rect={x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),visible:r.width>0&&r.x>=0&&r.x<window.innerWidth};}
      return { headerChildren:btns, salirRect:rect, headerW: document.querySelector('#view-delegado header').getBoundingClientRect().width };
    });
    console.log(`\n=== ${vp.name} (${vp.w}px) ===`);
    console.log('header children:', JSON.stringify(info.headerChildren));
    console.log('Salir rect:', JSON.stringify(info.salirRect), 'headerW:', info.headerW);
    await page.screenshot({ path: `/home/user/Liga/delegheader_${vp.name}.png`, clip:{x:0,y:0,width:vp.w,height:120} });
    await page.close();
  }
  await browser.close();
})().catch(e=>console.error('FATAL:',e.message));
