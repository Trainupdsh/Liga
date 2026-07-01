const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:4330/prototipo.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);

  // ISSUE 1: public ligas list should show the uploaded logo
  console.log('=== ISSUE 1: LOGO IN PUBLIC LIGAS LIST ===');
  const logoTest = await page.evaluate(async () => {
    // make a tiny data-url logo
    const c = document.createElement('canvas'); c.width=64; c.height=64;
    const cx=c.getContext('2d'); cx.fillStyle='#e11'; cx.fillRect(0,0,64,64);
    const dataUrl = c.toDataURL('image/png');
    // assign to first league and render public list
    leagues[0].logoUrl = dataUrl;
    renderLeagues(leagues);
    const firstCard = document.querySelector('#leaguesList .league-card .league-icon');
    const img = firstCard?.querySelector('img');
    // also desktop tree
    if (typeof _renderDtLeft === 'function') _renderDtLeft();
    const treeImg = document.querySelector('#dt-left .dt-li-ico img');
    return {
      publicHasImg: !!img,
      publicImgSrcOk: img?.getAttribute('src')?.startsWith('data:image/'),
      treeHasImg: !!treeImg,
      // a league WITHOUT logo still shows emoji
      secondCardText: document.querySelectorAll('#leaguesList .league-card .league-icon')[1]?.textContent?.trim(),
    };
  });
  console.log(JSON.stringify(logoTest, null, 2));
  console.log(logoTest.publicHasImg && logoTest.publicImgSrcOk ? '✅ PASS: public list shows logo image' : '❌ FAIL: public list logo');
  console.log(logoTest.treeHasImg ? '✅ PASS: desktop tree shows logo image' : '❌ FAIL: tree logo');

  // ISSUE 2: edit torneo wiring present and graceful
  console.log('\n=== ISSUE 2: EDIT TORNEO ===');
  const editTest = await page.evaluate(async () => {
    return {
      openEditTorneoDefined: typeof openEditTorneo === 'function',
      editVarExists: typeof _editTorneoId !== 'undefined',
      editBtnInDom: !!document.querySelector('[onclick="openEditTorneo()"]'),
      modalTitleEl: !!document.getElementById('nt-modal-title'),
      saveBtnEl: !!document.getElementById('nt-save-btn'),
    };
  });
  console.log(JSON.stringify(editTest, null, 2));
  const allWired = editTest.openEditTorneoDefined && editTest.editBtnInDom && editTest.modalTitleEl;
  console.log(allWired ? '✅ PASS: edit-torneo button + function + title wired' : '❌ FAIL: edit wiring');

  // openEditTorneo without a selected torneo → graceful toast, no crash
  const graceful = await page.evaluate(async () => {
    try { window.currentAdminTorneoId=null; await openEditTorneo(); return 'ok'; }
    catch(e){ return 'threw: '+e.message; }
  });
  console.log('openEditTorneo (no torneo):', graceful);
  console.log(graceful==='ok' ? '✅ PASS: handles missing torneo gracefully' : '❌ FAIL');

  console.log('\n=== JS ERRORS ===');
  console.log(errors.length===0 ? '✅ No JS errors' : errors.map(e=>'❌ '+e).join('\n'));

  // screenshot of public list with logo
  await page.evaluate(()=>{ showView && showView('view-home'); });
  await page.waitForTimeout(300);
  await page.screenshot({ path: '/home/user/Liga/logo_01_public_list.png' });
  await browser.close();
})().catch(e=>console.error('FATAL:', e.message));
