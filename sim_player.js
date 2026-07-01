const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  await page.goto('http://localhost:4330/prototipo.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const ss = async (n) => page.screenshot({ path: `/home/user/Liga/${n}.png` });

  // 1. Click liga to show standings
  await page.evaluate(() => { document.querySelector('#dt-left .dt-node-liga')?.click(); });
  await page.waitForTimeout(800);

  // 2. Click a team row → right panel club summary (with goleadores)
  console.log('=== CLICK TEAM ROW ===');
  await page.evaluate(() => { document.querySelector('.vtd-st-row')?.click(); });
  await page.waitForTimeout(600);
  const rightAfterTeam = await page.evaluate(() => ({
    rightVisible: document.getElementById('dt-right')?.style.display,
    hasGoleadores: document.getElementById('dt-rc')?.textContent?.includes('Goleadores'),
    scorerClickable: !!document.querySelector('#dt-rc [onclick^="_dtClickPlayer"]'),
  }));
  console.log('Right panel after team click:', JSON.stringify(rightAfterTeam));
  await ss('player_01_club_summary');

  // 3. Click a goleador (player) → right panel player summary
  console.log('\n=== CLICK PLAYER (single) ===');
  const clickedPlayer = await page.evaluate(() => {
    const el = document.querySelector('#dt-rc [onclick^="_dtClickPlayer"]');
    if (el) { el.click(); return true; }
    return false;
  });
  console.log('Player row clicked:', clickedPlayer);
  await page.waitForTimeout(600);
  const playerSummary = await page.evaluate(() => {
    const rc = document.getElementById('dt-rc');
    return {
      view: document.querySelector('.view.active')?.id,
      rightVisible: document.getElementById('dt-right')?.style.display,
      hasGoles: rc?.textContent?.includes('Goles'),
      hasDivisiones: rc?.textContent?.includes('Divisiones'),
      hasFichaBtn: !!rc?.querySelector('[onclick^="_dtDblClickPlayer"]'),
      title: rc?.querySelector('[style*="font-size:15px"]')?.textContent?.trim(),
    };
  });
  console.log('Player summary (right panel):', JSON.stringify(playerSummary, null, 2));
  if (playerSummary.hasFichaBtn && playerSummary.hasGoles) console.log('✅ PASS: Single click shows player summary in right panel');
  else console.log('❌ FAIL: player summary missing');
  await ss('player_02_summary_right');

  // 4. Double-click a player → full card in center
  console.log('\n=== DOUBLE-CLICK PLAYER ===');
  // Use the "Ver ficha completa" button equivalent: dispatch dblclick on a scorer row
  await page.evaluate(() => { document.querySelector('.vtd-st-row')?.click(); });
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    const el = document.querySelector('#dt-rc [ondblclick^="_dtDblClickPlayer"]');
    if (el) {
      const ev = new MouseEvent('dblclick', { bubbles: true, cancelable: true });
      el.dispatchEvent(ev);
    }
  });
  await page.waitForTimeout(800);
  const fullCard = await page.evaluate(() => {
    const v = document.getElementById('vpd-content');
    return {
      view: document.querySelector('.view.active')?.id,
      hasEstadisticas: v?.textContent?.includes('Estadísticas'),
      hasDatos: v?.textContent?.includes('Datos del jugador'),
      hasID: v?.textContent?.includes('ID Jugador'),
      hasPosicion: v?.textContent?.includes('Posición'),
      hasRanking: v?.textContent?.includes('Ranking'),
      name: v?.querySelector('[style*="font-size:17px"]')?.textContent?.trim(),
    };
  });
  console.log('Full player card:', JSON.stringify(fullCard, null, 2));
  if (fullCard.view === 'view-player-detail' && fullCard.hasEstadisticas && fullCard.hasDatos) {
    console.log('✅ PASS: Double-click shows full player card with stats');
  } else {
    console.log('❌ FAIL: full card incomplete');
  }
  await ss('player_03_full_card');

  // 5. Also test via club full card plantel
  console.log('\n=== CLUB FULL CARD → PLANTEL PLAYER ===');
  await page.evaluate(() => { document.querySelector('.vtd-st-row')?.click(); });
  await page.waitForTimeout(400);
  // dbl-click team to open club full card
  await page.evaluate(() => {
    const el = document.querySelector('.vtd-st-row');
    const ev = new MouseEvent('dblclick', { bubbles: true });
    el?.dispatchEvent(ev);
  });
  await page.waitForTimeout(800);
  const plantelClickable = await page.evaluate(() => ({
    view: document.querySelector('.view.active')?.id,
    plantelPlayers: document.querySelectorAll('#vcd-content [onclick^="_dtClickPlayer"]').length,
  }));
  console.log('Club full card:', JSON.stringify(plantelClickable));
  if (plantelClickable.plantelPlayers >= 6) console.log('✅ PASS: Plantel players are clickable');
  await ss('player_04_plantel');

  console.log('\n=== JS ERRORS ===');
  if (errors.length === 0) console.log('✅ No JavaScript errors');
  else errors.forEach(e => console.log('❌', e));

  await browser.close();
  console.log('\nDone.');
})().catch(e => console.error('FATAL:', e.message));
