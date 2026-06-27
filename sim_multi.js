const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
  const page = await (await browser.newContext({ viewport:{width:1400,height:900} })).newPage();
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:4330/prototipo.html', { waitUntil:'domcontentloaded' });
  await page.waitForTimeout(1500);

  // ===== #5 + player photo: inject real team with players, open club card =====
  console.log('=== #5 PLAYERS IN TEAM CARD + PHOTO ===');
  const r5 = await page.evaluate(() => {
    const RID=10000000;
    const c=document.createElement('canvas');c.width=40;c.height=40;c.getContext('2d').fillRect(0,0,40,40);
    const foto=c.toDataURL('image/png');
    teamsData.push({id:50+RID,name:'Boca Real',short:'BR',color:'#003',text:'#fff',logoUrl:null});
    standings.push({teamId:50+RID,divId:10+RID,pj:0,pg:0,pe:0,pp:0,gf:0,gc:0,pts:0});
    divisiones.push({id:10+RID,_rid:10,torneoId:3+RID,name:'Primera',grupo:'Mayores',teams:1,rounds:10,currentRound:0,icon:'📋'});
    torneos.push({id:3+RID,_rid:3,leagueId:5,name:'Apertura',status:'active',start:'2026',divsCount:0,logoUrl:null});
    leagues.push({id:5,name:'Mi Liga Real',sport:'Fútbol',color:'#1a3d20',icon:'⚽',_real:true});
    // real players for the team
    players.push({id:90+RID,name:'Juan Pérez',jersey:10,team:50+RID,goals:5,yellows:1,reds:0,fotoUrl:foto,pos:'Delantero',suspended:false});
    players.push({id:91+RID,name:'Luis Gómez',jersey:4,team:50+RID,goals:0,yellows:0,reds:0,fotoUrl:null,pos:'Defensor',suspended:false});
    // open full club card
    _dtDblClickClub(50+RID);
    const plantelRows = document.querySelectorAll('#vcd-content [onclick^="_dtClickPlayer"]');
    // open a player card and check photo
    _dtClickPlayer(90+RID);
    const playerImg = document.querySelector('#dt-rc img');
    return {
      plantelCount: plantelRows.length,
      plantelHasJuan: document.getElementById('vcd-content').textContent.includes('Juan Pérez'),
      playerCardPhoto: !!playerImg && playerImg.getAttribute('src').startsWith('data:image/'),
    };
  });
  console.log(JSON.stringify(r5,null,2));
  console.log(r5.plantelCount>=2 && r5.plantelHasJuan ? '✅ team card shows real players' : '❌ players missing');
  console.log(r5.playerCardPhoto ? '✅ player card shows photo' : '❌ player photo');

  // ===== #4 session + hide chrome on login =====
  console.log('\n=== #4 LOGIN HIDES PUBLIC NAV (no accidental logout) ===');
  const r4 = await page.evaluate(() => {
    document.getElementById('login-email').value='handball@baires.com';
    document.getElementById('login-pass').value='handball2025';
    doAdminLogin();
    return {
      navHidden: getComputedStyle(document.getElementById('dt-nav')).display==='none',
      leftHidden: getComputedStyle(document.getElementById('dt-left')).display==='none',
      session: !!sessionStorage.getItem('liga_session'),
      adminVisible: getComputedStyle(document.getElementById('view-admin')).display!=='none',
    };
  });
  console.log(JSON.stringify(r4,null,2));
  console.log(r4.navHidden && r4.leftHidden && r4.session && r4.adminVisible ? '✅ public nav hidden + admin shown + session saved' : '❌ FAIL');

  // ===== #2 + #3 wiring =====
  console.log('\n=== #2/#3 EDIT WIRING ===');
  const rw = await page.evaluate(() => ({
    editJugadorFn: typeof openEditDelegJugador==='function',
    djModalTitle: !!document.getElementById('dj-modal-title'),
    editClubFn: typeof openEditClub==='function',
    ecPreviewEl: !!document.getElementById('ec-logo-preview'),
    saveDelegJugadorHasUpdate: saveDelegJugador.toString().includes('_editJugadorId'),
    openEditClubPrefills: openEditClub.toString().includes('ec-logo-preview'),
  }));
  console.log(JSON.stringify(rw,null,2));
  console.log(rw.editJugadorFn && rw.djModalTitle && rw.saveDelegJugadorHasUpdate && rw.openEditClubPrefills ? '✅ edit player + escudo-prefill wired' : '❌ wiring');

  // ===== logout restores chrome =====
  console.log('\n=== LOGOUT RESTORES PUBLIC NAV ===');
  const rl = await page.evaluate(() => { logoutAdmin(); return {
    navShown: getComputedStyle(document.getElementById('dt-nav')).display!=='none',
    session: sessionStorage.getItem('liga_session'),
  };});
  console.log(JSON.stringify(rl));
  console.log(rl.navShown && !rl.session ? '✅ logout restores public nav + clears session' : '❌ FAIL');

  console.log('\n=== JS ERRORS ===');
  console.log(errors.length===0?'✅ No JS errors':errors.slice(0,6).map(e=>'❌ '+e).join('\n'));
  await browser.close();
})().catch(e=>console.error('FATAL:',e.message));
