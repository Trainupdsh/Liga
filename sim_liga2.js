const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium',
    headless: true
  });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  
  await page.goto('http://localhost:4330/prototipo.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  const ss = async (name) => page.screenshot({ path: `/home/user/Liga/${name}.png` });

  // ====== CLICK LIGA TO SHOW STANDINGS ======
  await page.evaluate(() => { document.querySelector('#dt-left .dt-node-liga')?.click(); });
  await page.waitForTimeout(1000);

  // ====== CHECK ACTUAL HTML STRUCTURE OF STANDINGS ROWS ======
  console.log('\n=== STANDINGS ROW STRUCTURE ===');
  const rowHtml = await page.evaluate(() => {
    const row = document.querySelector('.vtd-st-row');
    return row ? row.outerHTML : 'no rows';
  });
  console.log('First row HTML:', rowHtml.slice(0, 600));
  
  // Check all child elements and their text
  const rowContent = await page.evaluate(() => {
    const rows = document.querySelectorAll('.vtd-st-row');
    return Array.from(rows).slice(0, 8).map(r => {
      const children = Array.from(r.children).map(c => ({
        tag: c.tagName,
        cls: c.className,
        text: c.textContent.trim().slice(0, 30),
      }));
      return { id: r.id, children };
    });
  });
  console.log('Row children:', JSON.stringify(rowContent, null, 2));

  // ====== CHECK STANDINGS TABLE HEADER ======
  const vtdInner = await page.evaluate(() => {
    const vtd = document.getElementById('vtd-content');
    return vtd ? vtd.innerHTML.slice(0, 2000) : 'none';
  });
  console.log('\n=== VTD CONTENT (first 2000 chars) ===');
  console.log(vtdInner);

  // ====== ADMIN VIEW - TEST CREAR LIGA FORM ======
  console.log('\n\n=== ADMIN: CREAR LIGA FORM ===');
  await page.evaluate(() => { if(window.showView) showView('view-superadmin'); });
  await page.waitForTimeout(500);
  
  // Click "+ Nueva Liga"
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('#view-superadmin button')).find(b => b.textContent.includes('Liga'));
    if (btn) btn.click();
  });
  await page.waitForTimeout(500);
  
  const ligaFormState = await page.evaluate(() => {
    const modal = document.querySelector('.modal.show, .modal:not([style*="none"]):not([style*="display:none"]), dialog[open]');
    const ligaInputs = document.querySelectorAll('input[placeholder*="liga"], input[placeholder*="nombre"], input[id*="liga"], input[name*="liga"]');
    const allInputs = modal ? Array.from(modal.querySelectorAll('input, select, textarea'))
                             .map(i => ({ type: i.type, placeholder: i.placeholder, id: i.id, name: i.name })) : [];
    return {
      hasModal: !!modal,
      modalClass: modal?.className,
      ligaInputCount: ligaInputs.length,
      allInputs,
    };
  });
  console.log('Liga form:', JSON.stringify(ligaFormState, null, 2));
  await ss('admin_01_crear_liga_form');

  // ====== TEST CREAR TORNEO FORM ======
  console.log('\n=== ADMIN: CREAR TORNEO FORM ===');
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Crear Torneo' && b.offsetParent !== null);
    if (btn) btn.click();
  });
  await page.waitForTimeout(500);
  
  const torneoFormState = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('input:not([type=hidden]), select, textarea'))
      .filter(i => i.offsetParent !== null)
      .map(i => ({ type: i.type, placeholder: i.placeholder, id: i.id, value: i.value }));
    return { inputs };
  });
  console.log('Torneo form inputs:', JSON.stringify(torneoFormState, null, 2));
  await ss('admin_02_crear_torneo');

  // ====== CHECK DIVISION CLICK ======
  console.log('\n=== DIVISION CLICK ===');
  // Go back to standings
  await page.evaluate(() => { document.querySelector('#dt-left .dt-node-liga')?.click(); });
  await page.waitForTimeout(600);
  // Click torneo chevron to expand
  await page.evaluate(() => { document.querySelector('.dt-chev')?.click(); });
  await page.waitForTimeout(400);
  
  const divNodes = await page.evaluate(() => {
    const nodes = document.querySelectorAll('.dt-node-div');
    return nodes.length + ' div nodes: ' + Array.from(nodes).map(n => n.textContent.trim().slice(0,25)).join(', ');
  });
  console.log('Div nodes:', divNodes);
  
  // Click first division
  await page.evaluate(() => { document.querySelector('.dt-node-div')?.click(); });
  await page.waitForTimeout(800);
  
  const divView = await page.evaluate(() => {
    const v = document.querySelector('.view.active');
    return {
      view: v?.id,
      content: v?.textContent?.slice(0, 400),
      matchItems: document.querySelectorAll('.match-item, .partido-item, .fixture-row, [class*="match-row"]').length,
    };
  });
  console.log('Division view:', JSON.stringify(divView, null, 2));
  await ss('div_01_division');

  // ====== ÁRBITRO VIEW - LOAD STATE ======
  console.log('\n=== ÁRBITRO VIEW DETAIL ===');
  await page.evaluate(() => showView('view-arbitro'));
  await page.waitForTimeout(500);
  
  const arbDetail = await page.evaluate(() => {
    const v = document.getElementById('view-arbitro');
    return {
      content: v?.textContent?.slice(0, 800),
      matches: document.querySelectorAll('#view-arbitro .match-item, #view-arbitro .partido, #view-arbitro .fixture').length,
    };
  });
  console.log('Árbitro view:', arbDetail.content);
  await ss('arb_01_arbitro');

  // ====== DELEGADO: ADD JUGADOR ======
  console.log('\n=== DELEGADO: JUGADOR FORM ===');
  await page.evaluate(() => showView('view-delegado'));
  await page.waitForTimeout(500);
  
  // Click "Agregar jugador"
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('#view-delegado button')).find(b => b.textContent.includes('jugador'));
    if (btn) btn.click();
  });
  await page.waitForTimeout(500);
  
  const jugadorForm = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('input:not([type=hidden]), select'))
      .filter(i => i.offsetParent !== null)
      .map(i => ({ type: i.type, placeholder: i.placeholder || i.id }));
    const modal = document.querySelector('.modal.show, [class*="modal"][class*="open"]');
    return { modalFound: !!modal, inputs };
  });
  console.log('Jugador form:', JSON.stringify(jugadorForm, null, 2));
  await ss('del_01_jugador_form');

  // ====== MESA VIEW ======
  console.log('\n=== MESA VIEW ===');
  await page.evaluate(() => showView('view-mesa'));
  await page.waitForTimeout(500);
  
  const mesaContent = await page.evaluate(() => ({
    view: document.querySelector('.view.active')?.id,
    content: document.getElementById('view-mesa')?.textContent?.slice(0, 400),
  }));
  console.log('Mesa:', mesaContent.content);
  await ss('mesa_01');

  await browser.close();
  console.log('\nAll screenshots saved.');
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
