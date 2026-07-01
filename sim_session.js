const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:4330/prototipo.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  const adminVisible = () => page.evaluate(() => {
    const va = document.getElementById('view-admin');
    return va && getComputedStyle(va).display !== 'none';
  });

  // 1. LOGIN as demo liga admin (offline, demo league)
  console.log('=== LOGIN ===');
  await page.evaluate(() => {
    document.getElementById('login-email').value='handball@baires.com';
    document.getElementById('login-pass').value='handball2025';
  });
  await page.evaluate(() => doAdminLogin());
  await page.waitForTimeout(1000);
  const loggedIn = await adminVisible();
  const sess1 = await page.evaluate(() => sessionStorage.getItem('liga_session'));
  console.log('admin view visible:', loggedIn, '| session:', sess1);
  console.log(loggedIn && sess1 ? '✅ PASS: logged in + session saved' : '❌ FAIL login');

  // 2. RELOAD → should restore to admin (not home)
  console.log('\n=== RELOAD (should persist) ===');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1800);
  const afterReload = await adminVisible();
  const sess2 = await page.evaluate(() => sessionStorage.getItem('liga_session'));
  console.log('admin view visible after reload:', afterReload, '| session present:', !!sess2);
  console.log(afterReload ? '✅ PASS: session persisted across reload' : '❌ FAIL: logged out on reload');

  // 3. LOGOUT (Salir)
  console.log('\n=== LOGOUT (Salir) ===');
  await page.evaluate(() => logoutAdmin());
  await page.waitForTimeout(500);
  const sess3 = await page.evaluate(() => sessionStorage.getItem('liga_session'));
  const adminAfterLogout = await adminVisible();
  console.log('session after logout:', sess3, '| admin visible:', adminAfterLogout);
  console.log(!sess3 && !adminAfterLogout ? '✅ PASS: logout clears session' : '❌ FAIL logout');

  // 4. RELOAD after logout → stays logged out
  console.log('\n=== RELOAD after logout (stays out) ===');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  const afterLogoutReload = await adminVisible();
  console.log('admin visible after logout+reload:', afterLogoutReload);
  console.log(!afterLogoutReload ? '✅ PASS: stays logged out after reload' : '❌ FAIL');

  // 5. NEW TAB (simulate tab close → sessionStorage not shared) — fresh context has no session
  console.log('\n=== NEW TAB / NEW SESSION (tab close behavior) ===');
  // log in again first
  await page.evaluate(() => { document.getElementById('login-email').value='handball@baires.com'; document.getElementById('login-pass').value='handball2025'; });
  await page.evaluate(() => doAdminLogin());
  await page.waitForTimeout(600);
  const ctx2 = await browser.newContext();
  const page2 = await ctx2.newPage();
  await page2.goto('http://localhost:4330/prototipo.html', { waitUntil: 'domcontentloaded' });
  await page2.waitForTimeout(1500);
  const freshTabAdmin = await page2.evaluate(() => { const va=document.getElementById('view-admin'); return va && getComputedStyle(va).display!=='none'; });
  console.log('admin visible in fresh context (no shared sessionStorage):', freshTabAdmin);
  console.log(!freshTabAdmin ? '✅ PASS: new context/tab starts logged out (matches tab-close behavior)' : '❌ FAIL');

  console.log('\n=== JS ERRORS ===');
  console.log(errors.length===0 ? '✅ No JS errors' : errors.slice(0,5).map(e=>'❌ '+e).join('\n'));

  await browser.close();
})().catch(e=>console.error('FATAL:', e.message));
