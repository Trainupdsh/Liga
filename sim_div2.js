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

  // Click Liga Fútbol CABA — find it by text
  console.log('=== CLICK LIGA FÚTBOL CABA ===');
  await page.evaluate(() => {
    const ligas = Array.from(document.querySelectorAll('#dt-left .dt-node-liga'));
    const caba = ligas.find(l => l.textContent.includes('Fútbol CABA'));
    if (caba) caba.click();
  });
  await page.waitForTimeout(1000);

  const afterLiga = await page.evaluate(() => ({
    view: document.querySelector('.view.active')?.id,
    divNodes: Array.from(document.querySelectorAll('.dt-node-div')).map(d => d.textContent.trim().slice(0,20)),
  }));
  console.log('After liga click:', JSON.stringify(afterLiga, null, 2));

  // Click "Sub-20" division
  console.log('\n=== CLICK SUB-20 DIVISION ===');
  const clicked = await page.evaluate(() => {
    const divs = Array.from(document.querySelectorAll('.dt-node-div'));
    const sub20 = divs.find(d => d.textContent.includes('Sub-20'));
    if (sub20) { sub20.click(); return true; }
    return false;
  });
  console.log('Sub-20 found and clicked:', clicked);
  await page.waitForTimeout(1000);

  const afterSub20 = await page.evaluate(() => ({
    view: document.querySelector('.view.active')?.id,
    teamRows: document.querySelectorAll('.vtd-st-row').length,
    title: document.querySelector('#vtd-content [style*="font-size:17px"]')?.textContent?.trim(),
    hasPartidosBtn: !!Array.from(document.querySelectorAll('#vtd-content .vtd-div-hdr')).find(h => h.textContent.includes('PARTIDOS')),
    selDiv: document.querySelector('.dt-node-div.sel')?.textContent?.trim().slice(0,20),
  }));
  console.log('After Sub-20 click:', JSON.stringify(afterSub20, null, 2));

  if (afterSub20.view === 'view-torneo-detail' && afterSub20.teamRows >= 6) {
    console.log('✅ PASS: Sub-20 click shows STANDINGS table (not partidos)');
  } else {
    console.log('❌ FAIL: view=' + afterSub20.view + ' rows=' + afterSub20.teamRows);
  }
  await ss('subdiv_01_standings');

  // Click "PARTIDOS →" button to verify partidos still reachable
  console.log('\n=== CLICK PARTIDOS BUTTON ===');
  await page.evaluate(() => {
    const hdr = Array.from(document.querySelectorAll('#vtd-content .vtd-div-hdr')).find(h => h.textContent.includes('PARTIDOS'));
    if (hdr) hdr.click();
  });
  await page.waitForTimeout(1000);
  const afterPartidos = await page.evaluate(() => ({
    view: document.querySelector('.view.active')?.id,
  }));
  console.log('After PARTIDOS click:', JSON.stringify(afterPartidos));
  if (afterPartidos.view === 'view-division') console.log('✅ PASS: Partidos still reachable via button');
  await ss('subdiv_02_partidos');

  // Verify other divisions also work
  console.log('\n=== CLICK PRIMERA DIVISIÓN ===');
  await page.evaluate(() => {
    const divs = Array.from(document.querySelectorAll('.dt-node-div'));
    const pd = divs.find(d => d.textContent.includes('Primera'));
    if (pd) pd.click();
  });
  await page.waitForTimeout(800);
  const afterPD = await page.evaluate(() => ({
    view: document.querySelector('.view.active')?.id,
    rows: document.querySelectorAll('.vtd-st-row').length,
  }));
  console.log('Primera División:', JSON.stringify(afterPD));
  if (afterPD.view === 'view-torneo-detail' && afterPD.rows >= 6) console.log('✅ PASS: Primera División shows standings');
  await ss('subdiv_03_primera');

  console.log('\n=== JS ERRORS ===');
  if (errors.length === 0) console.log('✅ No JavaScript errors');
  else errors.forEach(e => console.log('❌', e));

  await browser.close();
  console.log('\nDone.');
})().catch(e => console.error('FATAL:', e.message));
