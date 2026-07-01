const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  
  await page.goto('http://localhost:4330/prototipo.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  const ss = async (name) => page.screenshot({ path: `/home/user/Liga/${name}.png` });

  // ====== CHECK LIGA NODE HTML STRUCTURE ======
  console.log('\n=== LIGA NODE STRUCTURE ===');
  const ligaHtml = await page.evaluate(() => {
    const liga = document.querySelector('#dt-left .dt-node-liga');
    return liga ? liga.outerHTML.slice(0, 400) : 'not found';
  });
  console.log('Liga node HTML:', ligaHtml);

  // ====== FRESH LIGA CLICK ======
  await page.evaluate(() => { document.querySelector('#dt-left .dt-node-liga')?.click(); });
  await page.waitForTimeout(800);
  
  // Examine tree state
  const treeState = await page.evaluate(() => {
    const ligaNodes = document.querySelectorAll('.dt-node-liga');
    const torneoNodes = document.querySelectorAll('.dt-node-torneo');
    const divNodes = document.querySelectorAll('.dt-node-div');
    return {
      ligas: ligaNodes.length,
      torneos: torneoNodes.length,
      divs: divNodes.length,
      torneoHtml: torneoNodes[0]?.outerHTML?.slice(0,300),
    };
  });
  console.log('\nTree state after liga click:', JSON.stringify(treeState, null, 2));
  await ss('tree_01_after_liga_click');

  // ====== CLICK TORNEO CHEVRON SPECIFICALLY ======
  console.log('\n=== TORNEO CHEVRON CLICK ===');
  // The torneo chevron is the .dt-chev inside .dt-node-torneo
  const torneoChevHtml = await page.evaluate(() => {
    const torneoChev = document.querySelector('.dt-node-torneo .dt-chev');
    return torneoChev?.outerHTML || 'not found';
  });
  console.log('Torneo chev:', torneoChevHtml);
  
  await page.evaluate(() => { document.querySelector('.dt-node-torneo .dt-chev')?.click(); });
  await page.waitForTimeout(400);
  
  const afterTorneoChev = await page.evaluate(() => ({
    view: document.querySelector('.view.active')?.id,
    divNodes: document.querySelectorAll('.dt-node-div').length,
    divTexts: Array.from(document.querySelectorAll('.dt-node-div')).map(d => d.textContent.trim().slice(0,30)),
  }));
  console.log('After torneo chevron click:', JSON.stringify(afterTorneoChev, null, 2));
  await ss('tree_02_after_torneo_chev');

  // ====== CLICK DIVISION NODE ======
  console.log('\n=== DIVISION CLICK ===');
  if (afterTorneoChev.divNodes > 0) {
    await page.evaluate(() => { document.querySelector('.dt-node-div')?.click(); });
    await page.waitForTimeout(800);
    
    const divView = await page.evaluate(() => ({
      view: document.querySelector('.view.active')?.id,
      content: document.querySelector('.view.active')?.textContent?.slice(0, 300),
    }));
    console.log('Division view:', JSON.stringify({ view: divView.view, content: divView.content?.slice(0, 200) }));
    await ss('tree_03_division_view');
  }

  // ====== TEST ALL DIVISION VIEWS ======
  console.log('\n=== ALL DIVISION VIEWS ===');
  await page.evaluate(() => { document.querySelector('#dt-left .dt-node-liga')?.click(); });
  await page.waitForTimeout(600);
  await page.evaluate(() => { document.querySelector('.dt-node-torneo .dt-chev')?.click(); });
  await page.waitForTimeout(400);
  
  const allDivs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.dt-node-div')).map(d => ({
      text: d.textContent.trim().slice(0,30),
      onclick: d.getAttribute('onclick'),
    }));
  });
  console.log('All division nodes:', JSON.stringify(allDivs, null, 2));

  // ====== NAVIGATE TO ADMIN AND TEST USER EDIT ======
  console.log('\n=== ADMIN: TEST EDIT USUARIO/CONTRASEÑA ===');
  await page.evaluate(() => showView('view-admin'));
  await page.waitForTimeout(500);
  
  // Check for user edit form
  const adminContent = await page.evaluate(() => {
    const el = document.getElementById('view-admin');
    return {
      text: el?.textContent?.slice(0, 600),
      tabs: Array.from(el?.querySelectorAll('.tab-btn, .tab, [class*="tab"]')||[]).map(t => t.textContent.trim().slice(0,30)),
    };
  });
  console.log('Admin content:', adminContent.text?.slice(0, 400));
  console.log('Admin tabs:', adminContent.tabs);
  await ss('admin_edit_user');

  // ====== CHECK FIXTURE GENERATOR ======
  console.log('\n=== FIXTURE GENERATOR ===');
  await page.evaluate(() => {
    // Find "Generar Fixture" button in admin
    const btn = Array.from(document.querySelectorAll('#view-admin button')).find(b => b.textContent.includes('Fixture') || b.textContent.includes('fixture'));
    if (btn) { console.log('Found fixture btn:', btn.textContent); btn.click(); }
  });
  await page.waitForTimeout(500);
  await ss('admin_fixture');

  // ====== SCREENSHOT: FULL STANDINGS ======
  console.log('\n=== FINAL STANDINGS SCREENSHOT ===');
  await page.evaluate(() => { document.querySelector('#dt-left .dt-node-liga')?.click(); });
  await page.waitForTimeout(800);
  await ss('final_standings_full');
  
  // Scroll down to see more teams
  await page.evaluate(() => {
    document.getElementById('vtd-content')?.scrollTo(0, 500);
  });
  await page.waitForTimeout(300);
  await ss('final_standings_scrolled');

  await browser.close();
  console.log('\nDone.');
})().catch(e => console.error('FATAL:', e.message));
