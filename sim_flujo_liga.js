const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

  // Force demo mode: block the Supabase CDN so window.supabase stays undefined (supa=null)
  await page.route('**/supabase.min.js', r => r.abort());

  await page.goto('http://localhost:4330/prototipo.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);

  // 1) Home renders demo leagues
  const ligaCount = await page.evaluate(() => document.querySelectorAll('.mc-liga, .league-card, [class*=liga]').length);
  console.log('STEP1 home loaded; liga-ish elements:', ligaCount);
  await page.screenshot({ path: 'sim_01_home.png' });

  // helper to open the login modal
  async function openLogin() {
    await page.evaluate(() => { if (typeof showView === 'function') showView('view-login'); });
    await page.waitForTimeout(400);
  }

  // 2) SUPERADMIN login -> Usuarios panel
  await openLogin();
  await page.fill('#login-email', 'lucasmoreno');
  await page.fill('#login-pass', '260110');
  await page.evaluate(() => doAdminLogin());
  await page.waitForTimeout(800);
  const saOk = await page.evaluate(() => document.getElementById('view-superadmin')?.classList.contains('active') || !!document.querySelector('#view-superadmin.active, #saUsuariosPanel'));
  console.log('STEP2 superadmin view reached:', saOk);

  // open usuarios panel + load rows
  const usuarios = await page.evaluate(async () => {
    if (typeof loadSAUsuarios === 'function') { try { await loadSAUsuarios(); } catch(e){} }
    const rows = (typeof saAllRows !== 'undefined' ? saAllRows : []);
    const byRole = {};
    rows.forEach(r => { byRole[r.role] = (byRole[r.role]||0)+1; });
    return { total: rows.length, byRole, hasArbitro: rows.some(r => /rbitro/i.test(r.role||'')) };
  });
  console.log('STEP2 SA usuarios rows:', JSON.stringify(usuarios));

  // 3) liga-admin login -> create-torneo modal client-side validation
  await page.evaluate(() => { if (typeof logoutAdmin==='function') logoutAdmin(); });
  await page.waitForTimeout(500);
  await openLogin();
  await page.fill('#login-email', 'handball@baires.com');
  await page.fill('#login-pass', 'handball2025');
  await page.evaluate(() => doAdminLogin());
  await page.waitForTimeout(700);
  const adminOk = await page.evaluate(() => !!document.querySelector('#view-admin.active, #view-admin'));
  const curLeague = await page.evaluate(() => (typeof currentAdminLeagueId!=='undefined')?currentAdminLeagueId:null);
  console.log('STEP3 admin view; currentAdminLeagueId:', curLeague);

  // open Nuevo Torneo modal + test empty-name validation
  const valEmpty = await page.evaluate(async () => {
    if (typeof openNuevoTorneo === 'function') openNuevoTorneo();
    const n = document.getElementById('nt-nombre'); if (n) n.value = '';
    if (typeof saveNuevoTorneo === 'function') await saveNuevoTorneo();
    const err = document.getElementById('nt-error');
    return { msg: err?.textContent || '', shown: err && err.style.display !== 'none' };
  });
  console.log('STEP3 empty-name torneo validation:', JSON.stringify(valEmpty));

  // test "no días" validation (name present, no days)
  const valDias = await page.evaluate(async () => {
    const n = document.getElementById('nt-nombre'); if (n) n.value = 'Apertura 2026';
    document.querySelectorAll('#nt-dias input[type=checkbox], .nt-dia-chip.selected').forEach(()=>{});
    // try to uncheck all day chips if present
    if (typeof ntGetDias === 'function') {
      const dias = ntGetDias();
      if (typeof saveNuevoTorneo === 'function') await saveNuevoTorneo();
      const err = document.getElementById('nt-error');
      return { diasSelected: dias.length, msg: err?.textContent || '' };
    }
    return { note: 'ntGetDias missing' };
  });
  console.log('STEP3 dias validation:', JSON.stringify(valDias));
  await page.screenshot({ path: 'sim_02_torneo_modal.png' });

  // 4) what happens on a real save attempt with supa=null (network path)
  const saveNull = await page.evaluate(async () => {
    const n = document.getElementById('nt-nombre'); if (n) n.value = 'Apertura 2026';
    // select a day if a chip exists
    const chip = document.querySelector('#nt-dias .nt-dia-chip, #nt-dias [onclick]');
    if (chip) chip.click();
    const err = document.getElementById('nt-error');
    err.textContent=''; err.style.display='none';
    try { if (typeof saveNuevoTorneo==='function') await saveNuevoTorneo(); } catch(e) { return {threw:e.message}; }
    return { msg: err?.textContent || '', shown: err && err.style.display !== 'none' };
  });
  console.log('STEP4 save with supa=null:', JSON.stringify(saveNull));

  console.log('CONSOLE ERRORS (' + errors.length + '):');
  errors.slice(0, 20).forEach(e => console.log('  - ' + e));

  await browser.close();
})();
