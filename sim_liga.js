const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium',
    headless: true
  });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  
  const errors = [];
  page.on('pageerror', e => errors.push(`JS: ${e.message}`));
  page.on('console', m => { if(m.type()==='error') errors.push(`CON: ${m.text()}`); });

  await page.goto('http://localhost:4330/prototipo.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  const ss = async (name) => page.screenshot({ path: `/home/user/Liga/${name}.png` });

  // ====== STEP 1: DATA INVENTORY ======
  console.log('\n=== STEP 1: DATA INVENTORY ===');
  const data = await page.evaluate(() => {
    // Find all global array variables that could be data
    const globals = {};
    for (const key of Object.keys(window)) {
      const v = window[key];
      if (Array.isArray(v) && v.length > 0 && key !== 'frames') {
        globals[key] = v.length;
      }
    }
    return globals;
  });
  console.log('Global arrays:', JSON.stringify(data, null, 2));

  // ====== STEP 2: LIGA CLICK → STANDINGS ======
  console.log('\n=== STEP 2: LIGA CLICK → STANDINGS ===');
  await page.evaluate(() => { document.querySelector('#dt-left .dt-node-liga')?.click(); });
  await page.waitForTimeout(1000);
  
  const ligaResult = await page.evaluate(() => ({
    view: document.querySelector('.view.active')?.id,
    teamRows: document.querySelectorAll('.vtd-st-row').length,
  }));
  console.log(`✅ Liga click: ${ligaResult.view}, ${ligaResult.teamRows} team rows`);
  await ss('sim_01_liga_standings');

  // ====== STEP 3: TORNEO CLICK → STANDINGS ======
  await page.evaluate(() => { document.querySelector('#dt-left .dt-node-torneo')?.click(); });
  await page.waitForTimeout(600);
  const torneoResult = await page.evaluate(() => ({
    view: document.querySelector('.view.active')?.id,
    rows: document.querySelectorAll('.vtd-st-row').length,
  }));
  console.log(`✅ Torneo click: ${torneoResult.view}, ${torneoResult.rows} rows`);
  await ss('sim_02_torneo_standings');

  // ====== STEP 4: STANDINGS CONTENT ======
  console.log('\n=== STEP 4: STANDINGS CONTENT ===');
  const standingsContent = await page.evaluate(() => {
    const rows = document.querySelectorAll('.vtd-st-row');
    return Array.from(rows).slice(0, 12).map(r => {
      const cells = r.querySelectorAll('.vtd-st-cell, td, [class*="cell"]');
      return Array.from(cells).map(c => c.textContent.trim()).join(' | ');
    });
  });
  console.log('Standings rows:');
  standingsContent.forEach((r, i) => console.log(`  ${i+1}. ${r}`));

  // ====== STEP 5: NAVIGATE TO SUPERADMIN ======
  console.log('\n=== STEP 5: SUPERADMIN VIEW ===');
  await page.evaluate(() => { if(window.showView) showView('view-superadmin'); });
  await page.waitForTimeout(500);
  const superadminState = await page.evaluate(() => ({
    view: document.querySelector('.view.active')?.id,
    hasLigaCreator: document.querySelectorAll('input, select, textarea').length,
    btns: Array.from(document.querySelectorAll('#view-superadmin button')).map(b => b.textContent.trim()).slice(0,10),
  }));
  console.log('Superadmin:', JSON.stringify(superadminState, null, 2));
  await ss('sim_03_superadmin');

  // ====== STEP 6: NAVIGATE TO ADMIN ======
  console.log('\n=== STEP 6: ADMIN VIEW ===');
  await page.evaluate(() => { if(window.showView) showView('view-admin'); });
  await page.waitForTimeout(500);
  const adminState = await page.evaluate(() => ({
    view: document.querySelector('.view.active')?.id,
    btns: Array.from(document.querySelectorAll('#view-admin button')).map(b => b.textContent.trim()).slice(0,10),
    tabs: Array.from(document.querySelectorAll('#view-admin .tab, #view-admin .tab-btn, #view-admin [onclick*="tab"]'))
         .map(t => t.textContent.trim()).slice(0,10),
  }));
  console.log('Admin:', JSON.stringify(adminState, null, 2));
  await ss('sim_04_admin');

  // ====== STEP 7: ÁRBITROS VIEW ======
  console.log('\n=== STEP 7: ÁRBITROS VIEW ===');
  await page.evaluate(() => { if(window.showView) showView('view-arbitro'); });
  await page.waitForTimeout(500);
  const arbState = await page.evaluate(() => ({
    view: document.querySelector('.view.active')?.id,
    content: document.getElementById('view-arbitro')?.textContent?.slice(0,500),
    inputCount: document.querySelectorAll('#view-arbitro input').length,
    btns: Array.from(document.querySelectorAll('#view-arbitro button')).map(b => b.textContent.trim()).slice(0,5),
  }));
  console.log('Árbitro view:', JSON.stringify(arbState, null, 2));
  await ss('sim_05_arbitro');

  // ====== STEP 8: DELEGADO VIEW ======
  console.log('\n=== STEP 8: DELEGADO VIEW ===');
  await page.evaluate(() => { if(window.showView) showView('view-delegado'); });
  await page.waitForTimeout(500);
  const delState = await page.evaluate(() => ({
    view: document.querySelector('.view.active')?.id,
    content: document.getElementById('view-delegado')?.textContent?.slice(0,500),
    btns: Array.from(document.querySelectorAll('#view-delegado button')).map(b => b.textContent.trim()).slice(0,5),
  }));
  console.log('Delegado view:', JSON.stringify(delState, null, 2));
  await ss('sim_06_delegado');

  // ====== STEP 9: CLUB DETAIL (6 teams check) ======
  console.log('\n=== STEP 9: CLUBES VIEW ===');
  await page.evaluate(() => { if(window.showView) showView('view-clubes'); });
  await page.waitForTimeout(500);
  const clubesState = await page.evaluate(() => ({
    view: document.querySelector('.view.active')?.id,
    clubCards: document.querySelectorAll('.club-card, .club-item, [class*="club-row"]').length,
    content: document.getElementById('view-clubes')?.textContent?.slice(0,300),
    btns: Array.from(document.querySelectorAll('#view-clubes button')).map(b => b.textContent.trim()).slice(0,5),
  }));
  console.log('Clubes:', JSON.stringify(clubesState, null, 2));
  await ss('sim_07_clubes');

  // ====== STEP 10: CLICK DIVISION TO SEE MATCHES ======
  console.log('\n=== STEP 10: DIVISION CLICK ===');
  // First go back to torneo view and expand divisions
  await page.evaluate(() => { document.querySelector('#dt-left .dt-node-liga')?.click(); });
  await page.waitForTimeout(600);
  // Expand chevron to show divisions
  await page.evaluate(() => { document.querySelector('#dt-left .dt-node-torneo .dt-chev')?.click(); });
  await page.waitForTimeout(400);
  
  const afterExpand = await page.evaluate(() => {
    const divNodes = document.querySelectorAll('#dt-left .dt-node-div');
    return { divCount: divNodes.length, text: Array.from(divNodes).map(d => d.textContent.trim().slice(0,30)) };
  });
  console.log('Division nodes after expand:', JSON.stringify(afterExpand));
  
  // Click first division
  await page.evaluate(() => { document.querySelector('#dt-left .dt-node-div')?.click(); });
  await page.waitForTimeout(800);
  
  const divResult = await page.evaluate(() => ({
    view: document.querySelector('.view.active')?.id,
    matchCount: document.querySelectorAll('.match-row, .partido-row, [class*="match-item"]').length,
    content: document.querySelector('.view.active')?.textContent?.slice(0, 300),
  }));
  console.log('Division click result:', JSON.stringify({
    view: divResult.view,
    matches: divResult.matchCount,
    content: divResult.content?.slice(0,200),
  }, null, 2));
  await ss('sim_08_division');

  // ====== STEP 11: FULL DATA SEARCH ======
  console.log('\n=== STEP 11: DATA SEARCH ===');
  const fullData = await page.evaluate(() => {
    // Search for data in different possible variable names
    const tryFind = (names) => {
      for (const n of names) {
        if (window[n] && Array.isArray(window[n]) && window[n].length > 0) return { name: n, count: window[n].length, sample: window[n][0] };
      }
      return null;
    };
    
    const players = tryFind(['playersData','players','jugadores','playersList']);
    const matches = tryFind(['matchesData','matches','partidos','fixtures','games']);
    const refs = tryFind(['referees','arbitros','refereesList','refs']);
    const teams = tryFind(['teamsData','teams','equipos','clubs','clubsList']);
    
    return { players, matches, refs, teams };
  });
  console.log('Data found:', JSON.stringify(fullData, null, 2));

  // Check generateDemoData
  const demoDataInfo = await page.evaluate(() => {
    const hasFunc = typeof generateDemoData === 'function';
    return {
      hasGenerateDemoData: hasFunc,
      hasDivTeams: typeof _DIV_TEAMS !== 'undefined',
      divTeams: typeof _DIV_TEAMS !== 'undefined' ? _DIV_TEAMS : null,
    };
  });
  console.log('Demo data functions:', JSON.stringify(demoDataInfo, null, 2));

  // ====== STEP 12: JS ERROR SUMMARY ======
  console.log('\n=== JS ERRORS ===');
  if (errors.length === 0) {
    console.log('✅ No JavaScript errors detected');
  } else {
    console.log(`❌ ${errors.length} errors:`);
    errors.slice(0,10).forEach(e => console.log(' -', e));
  }
  
  await ss('sim_09_final');
  await browser.close();
  console.log('\nDone.');
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
