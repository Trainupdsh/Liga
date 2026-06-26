const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  
  await page.goto('http://localhost:4330/prototipo.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  const ss = async (name) => page.screenshot({ path: `/home/user/Liga/${name}.png` });

  // ====== LIGA CLICK → STANDINGS + DIVISIONS ======
  console.log('=== LIGA CLICK ===');
  await page.evaluate(() => { document.querySelector('#dt-left .dt-node-liga')?.click(); });
  await page.waitForTimeout(1000);
  
  const state1 = await page.evaluate(() => ({
    view: document.querySelector('.view.active')?.id,
    teamRows: document.querySelectorAll('.vtd-st-row').length,
    divNodes: document.querySelectorAll('.dt-node-div').length,
    groupNodes: document.querySelectorAll('.dt-node-grupo').length,
    divTexts: Array.from(document.querySelectorAll('.dt-node-div')).map(d => d.textContent.trim().slice(0,30)),
  }));
  console.log('After liga click:', JSON.stringify(state1, null, 2));
  
  if (state1.view === 'view-torneo-detail' && state1.teamRows >= 6) {
    console.log('✅ PASS: Standings shown after liga click');
  } else {
    console.log('❌ FAIL: standings not shown');
  }
  
  if (state1.divNodes >= 4) {
    console.log(`✅ PASS: ${state1.divNodes} division nodes visible in tree`);
  } else {
    console.log(`⚠️  Only ${state1.divNodes} div nodes (groups: ${state1.groupNodes})`);
  }
  
  await ss('final_01_liga_click');

  // ====== DIVISION CLICK → DIVISION VIEW ======
  console.log('\n=== DIVISION CLICK ===');
  await page.evaluate(() => { document.querySelector('.dt-node-div')?.click(); });
  await page.waitForTimeout(1000);
  
  const state2 = await page.evaluate(() => ({
    view: document.querySelector('.view.active')?.id,
    content: document.querySelector('.view.active')?.textContent?.slice(0, 200),
  }));
  console.log('After division click:', state2.view);
  console.log('Content preview:', state2.content?.slice(0, 150));
  await ss('final_02_division_click');

  // ====== TORNEO CLICK → STANDINGS ======
  console.log('\n=== TORNEO CLICK ===');
  await page.evaluate(() => { document.querySelector('.dt-node-torneo')?.click(); });
  await page.waitForTimeout(800);
  const state3 = await page.evaluate(() => ({
    view: document.querySelector('.view.active')?.id,
    rows: document.querySelectorAll('.vtd-st-row').length,
  }));
  console.log(`Torneo click: ${state3.view}, ${state3.rows} rows`);
  if (state3.view === 'view-torneo-detail') console.log('✅ PASS: Torneo click shows standings');
  await ss('final_03_torneo_standings');

  // ====== DATA SUMMARY ======
  console.log('\n=== DATA SUMMARY ===');
  const data = await page.evaluate(() => {
    const divTeams = Object.values(_DIV_TEAMS || {});
    const teamSizes = divTeams.map(arr => arr.length);
    return {
      totalLigas: leagues.length,
      totalTorneos: torneos.length,
      totalDivisiones: divisiones.length,
      divisionTeams: {
        min: Math.min(...teamSizes),
        max: Math.max(...teamSizes),
        all6: teamSizes.every(s => s === 6),
      },
      // Check arbitro form fields
      arbForm: {
        nombre: !!document.getElementById('arb-nombre'),
        email: !!document.getElementById('arb-email'),
        tel: !!document.getElementById('arb-telefono'),
        pass: !!document.getElementById('arb-password'),
      },
      // Check jugador form fields
      jugForm: {
        nombre: !!document.getElementById('nj-nombre'),
        numero: !!document.getElementById('nj-numero'),
        posicion: !!document.getElementById('nj-posicion'),
        equipo: !!document.getElementById('nj-equipo'),
      },
      // Check torneo form
      torneoForm: {
        nombre: !!document.getElementById('nt-nombre'),
        inicio: !!document.getElementById('nt-fecha-inicio'),
        formato: !!document.getElementById('nt-formato'),
      },
    };
  });
  console.log('Data summary:', JSON.stringify(data, null, 2));
  
  // ====== VALIDATE FORMS ======
  console.log('\n=== FORM VALIDATION ===');
  const formChecks = [
    ['Árbitro form (nombre)', data.arbForm.nombre],
    ['Árbitro form (email)', data.arbForm.email],
    ['Árbitro form (password)', data.arbForm.pass],
    ['Jugador form (nombre)', data.jugForm.nombre],
    ['Jugador form (número)', data.jugForm.numero],
    ['Jugador form (equipo)', data.jugForm.equipo],
    ['Torneo form (nombre)', data.torneoForm.nombre],
    ['Torneo form (fecha inicio)', data.torneoForm.inicio],
    ['6 teams per division', data.divisionTeams.all6],
  ];
  formChecks.forEach(([label, pass]) => console.log(pass ? `✅ ${label}` : `❌ ${label}`));

  // ====== JS ERRORS ======
  console.log('\n=== JS ERRORS ===');
  if (errors.length === 0) console.log('✅ No JavaScript errors');
  else errors.forEach(e => console.log('❌', e));
  
  await ss('final_04_end');
  await browser.close();
  console.log('\nDone. Screenshots at /home/user/Liga/final_*.png');
})().catch(e => console.error('FATAL:', e.message));
